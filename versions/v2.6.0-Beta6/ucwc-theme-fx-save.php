<?php
/**
 * ThemeEffects: Theme Effects AJAX save endpoint.
 * Standalone (not embedded in page layout) so we can return clean JSON.
 */
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

if (function_exists("session_status") && session_status() === PHP_SESSION_ACTIVE) {
    @session_write_close();
} elseif (function_exists("session_write_close")) {
    @session_write_close();
}

$fx_path = "/boot/config/plugins/theme.effects/theme-effects.cfg";
$assets_f = "/boot/config/plugins/theme.effects/assets";
$assets_r = "/usr/local/emhttp/plugins/theme.effects/assets";
$log_path = "/tmp/ucwc-theme-fx-save.log";
$f1 = "background-1.jpg";
$f2 = "background-2.jpg";
$fc = "background-custom.jpg";
$fd = "background-dynamic.jpg";

function ucwc_json($payload, $http = 200) {
    if (!headers_sent()) {
        http_response_code($http);
        header("Content-Type: application/json; charset=utf-8");
        header("Cache-Control: no-store");
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ucwc_log($path, $line) {
    @file_put_contents($path, date("c") . " " . $line . "\n", FILE_APPEND);
}

function ucwc_fx_defaults() {
    return [
        "PARTICLES" => "no",
        "PARTICLES_COUNT" => "60",
        "HUTAO" => "yes",
        "HUTAO_SIZE" => "medium",
        "HUTAO_POS" => "br",
        "HUTAO_TYPE" => "hutao",
        "HUTAO_BLUR" => "no",
        "HUTAO_BLUR_LEVEL" => "md",
        "REDUCE_MOTION" => "no",
        "BG_MODE" => "local",
        "BG_LOCAL_SLOT" => "1",
        "BG_GALLERY" => "photo",
        "BG_CUSTOM_API" => "",
        "BG_BLUR" => "no",
        "BG_BLUR_LEVEL" => "md",
        "FONT_BODY" => "rajdhani",
        "FONT_TITLE" => "orbitron",
        "FONT_TITLE_UPPER" => "no",
        "FONT_SIZE" => "14",
        "FONT_TITLE_SIZE" => "default",
        "FONT_CUSTOM_BODY" => "",
        "FONT_CUSTOM_TITLE" => "",
        "FONT_LOCAL_BODY" => "",
        "FONT_LOCAL_TITLE" => "",
        "COLOR_PRESET" => "cyber",
        "COLOR_TEXT" => "",
        "COLOR_TITLE" => "",
        "COLOR_LABEL" => "",
        "PERF_PROFILE" => "auto",
        "CLIENT_OPTIMIZED" => "no",
        "MOUSE_FX" => "no",
        "MOUSE_STYLE" => "glow",
        "MOUSE_SIZE" => "80",
        "MOUSE_INTENSITY" => "55",
        "MOUSE_COLOR" => "",
        "MOUSE_CLICK_RIPPLE" => "yes",
        "MOUSE_CURSOR" => "system",
        "MOUSE_CURSOR_HOTSPOT_X" => "4",
        "MOUSE_CURSOR_HOTSPOT_Y" => "2",
        "MUSIC_ENABLE" => "no",
        "MUSIC_UI" => "card",
        "MUSIC_SOURCE" => "local",
        "MUSIC_LOCAL_DIR" => "",
        "MUSIC_VOLUME" => "70",
        "MUSIC_AUTOPLAY" => "no",
        "MUSIC_SHUFFLE" => "no",
        "MUSIC_REPEAT" => "off",
        "MUSIC_DASH_ONLY" => "yes",
    ];
}

function ucwc_hex_ok($v) {
    $v = trim((string)$v);
    if ($v === "") return "";
    if (preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $v)) return strtolower($v);
    return "";
}

/** Sanitize freeform CSS font-family name (no quotes/semicolons). */
function ucwc_font_family_ok($v) {
    $v = trim((string)$v);
    $v = str_replace(["\"", "'", ";", "{", "}", "<", ">", "\\"], "", $v);
    $v = preg_replace('/\s+/u', " ", $v);
    if ($v === null) $v = "";
    if (function_exists("mb_substr")) $v = mb_substr($v, 0, 48, "UTF-8");
    else $v = substr($v, 0, 48);
    $v = trim($v);
    if ($v === "") return "";
    // allow letters/numbers/CJK/spaces/hyphen/underscore/period
    if (!preg_match('/^[\p{L}\p{N} ._\-]+$/u', $v)) return "";
    return $v;
}

function ucwc_font_local_name_ok($v) {
    $v = strtolower(trim((string)$v));
    if ($v === "") return "";
    if (!preg_match('/^(body|title)-custom\.(woff2|woff|ttf|otf)$/', $v)) return "";
    return $v;
}


function ucwc_blur_level_ok($v) {
    $v = strtolower(trim((string)$v));
    return in_array($v, ["sm", "md", "lg"], true) ? $v : "md";
}


/** Map PERF_PROFILE to concrete theme-effect keys (particles / blur / motion).
 *  Called on section=perf (or all) when profile is high|balanced|low.
 *  auto leaves knobs alone (Loader still classifies runtime soft-caps). */
function ucwc_fx_apply_perf_profile(&$fx, $profile) {
    $profile = strtolower(trim((string)$profile));
    if ($profile === "auto" || $profile === "") return;
    if ($profile === "low") {
        $fx["PARTICLES"] = "no";
        $fx["MOUSE_FX"] = "no";
        $fx["REDUCE_MOTION"] = "yes";
        $n = intval($fx["PARTICLES_COUNT"] ?? 40);
        if ($n > 40) $n = 40;
        if ($n < 30) $n = 30;
        $fx["PARTICLES_COUNT"] = (string)$n;
        // Keep blur on but weak when already enabled — cheaper than forcing off
        if (($fx["BG_BLUR"] ?? "no") === "yes") $fx["BG_BLUR_LEVEL"] = "sm";
        $fx["HUTAO_BLUR"] = "no";
        $fx["HUTAO_BLUR_LEVEL"] = "sm";
        return;
    }
    if ($profile === "balanced") {
        $fx["REDUCE_MOTION"] = "no";
        $n = intval($fx["PARTICLES_COUNT"] ?? 60);
        if ($n > 80) $n = 80;
        if ($n < 40) $n = 60;
        $fx["PARTICLES_COUNT"] = (string)$n;
        // Cap strong blur only; do not force particles on/off
        if (($fx["BG_BLUR"] ?? "no") === "yes") {
            $lv = $fx["BG_BLUR_LEVEL"] ?? "md";
            if ($lv === "lg") $fx["BG_BLUR_LEVEL"] = "md";
        }
        if (($fx["HUTAO_BLUR"] ?? "no") === "yes") {
            $lv = $fx["HUTAO_BLUR_LEVEL"] ?? "md";
            if ($lv === "lg") $fx["HUTAO_BLUR_LEVEL"] = "md";
        }
        return;
    }
    if ($profile === "high") {
        $fx["PARTICLES"] = "yes";
        $fx["REDUCE_MOTION"] = "no";
        $n = intval($fx["PARTICLES_COUNT"] ?? 80);
        if ($n < 80) $n = 80;
        if ($n > 120) $n = 120;
        $fx["PARTICLES_COUNT"] = (string)$n;
        if (($fx["BG_BLUR"] ?? "no") === "yes") {
            $lv = $fx["BG_BLUR_LEVEL"] ?? "md";
            if ($lv === "sm") $fx["BG_BLUR_LEVEL"] = "md";
        }
        return;
    }
}



function ucwc_fx_normalize_mouse(&$fx) {
    $fx["MOUSE_FX"] = (($fx["MOUSE_FX"] ?? "no") === "yes") ? "yes" : "no";
    $st = strtolower(trim((string)($fx["MOUSE_STYLE"] ?? "glow")));
    $fx["MOUSE_STYLE"] = in_array($st, ["glow", "ring", "trail", "spark"], true) ? $st : "glow";
    $sz = intval($fx["MOUSE_SIZE"] ?? 80);
    if ($sz < 40) $sz = 40;
    if ($sz > 160) $sz = 160;
    $fx["MOUSE_SIZE"] = (string)$sz;
    $it = intval($fx["MOUSE_INTENSITY"] ?? 55);
    if ($it < 15) $it = 15;
    if ($it > 100) $it = 100;
    $fx["MOUSE_INTENSITY"] = (string)$it;
    $c = trim((string)($fx["MOUSE_COLOR"] ?? ""));
    if ($c !== "" && function_exists("ucwc_hex_ok")) $c = ucwc_hex_ok($c);
    elseif ($c !== "" && !preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $c)) $c = "";
    $fx["MOUSE_COLOR"] = $c;
    $fx["MOUSE_CLICK_RIPPLE"] = (($fx["MOUSE_CLICK_RIPPLE"] ?? "yes") === "no") ? "no" : "yes";
    $cur = strtolower(trim((string)($fx["MOUSE_CURSOR"] ?? "system")));
    if ($cur === "auto" || $cur === "default" || $cur === "" || $cur === "custom") $cur = ($cur === "custom") ? "upload" : "system";
    if (in_array($cur, ["dot", "cross", "neon", "none"], true)) $cur = "neon3d";
    $fx["MOUSE_CURSOR"] = in_array($cur, ["system", "neon3d", "holo", "cyber", "crystal", "upload"], true) ? $cur : "system";
    $hx = intval($fx["MOUSE_CURSOR_HOTSPOT_X"] ?? 4);
    $hy = intval($fx["MOUSE_CURSOR_HOTSPOT_Y"] ?? 2);
    if ($hx < 0) $hx = 0;
    if ($hx > 128) $hx = 128;
    if ($hy < 0) $hy = 0;
    if ($hy > 128) $hy = 128;
    $fx["MOUSE_CURSOR_HOTSPOT_X"] = (string)$hx;
    $fx["MOUSE_CURSOR_HOTSPOT_Y"] = (string)$hy;
}

function ucwc_music_dir_ok($v) {
    $v = trim(str_replace("\\", "/", (string)$v));
    $v = rtrim($v, "/");
    if ($v === "") return "";
    if ($v[0] !== "/") return "";
    if (strpos($v, "..") !== false) return "";
    if (strpos($v . "/", "/mnt/") !== 0 && strpos($v . "/", "/boot/config/plugins/theme.effects/") !== 0) {
        return "";
    }
    if (strlen($v) > 512) $v = substr($v, 0, 512);
    return $v;
}

function ucwc_fx_normalize_music(&$fx) {
    $fx["MUSIC_ENABLE"] = (($fx["MUSIC_ENABLE"] ?? "no") === "yes") ? "yes" : "no";
    $ui = strtolower(trim((string)($fx["MUSIC_UI"] ?? "card")));
    // V1 only card; keep key for V2/V3
    $fx["MUSIC_UI"] = in_array($ui, ["card", "float", "statusbar"], true) ? $ui : "card";
    if ($fx["MUSIC_UI"] !== "card") $fx["MUSIC_UI"] = "card";
    $src = strtolower(trim((string)($fx["MUSIC_SOURCE"] ?? "local")));
    $fx["MUSIC_SOURCE"] = in_array($src, ["local", "navidrome", "emby", "jellyfin"], true) ? $src : "local";
    if ($fx["MUSIC_SOURCE"] !== "local") $fx["MUSIC_SOURCE"] = "local";
    $fx["MUSIC_LOCAL_DIR"] = ucwc_music_dir_ok($fx["MUSIC_LOCAL_DIR"] ?? "");
    $vol = intval($fx["MUSIC_VOLUME"] ?? 70);
    if ($vol < 0) $vol = 0;
    if ($vol > 100) $vol = 100;
    $fx["MUSIC_VOLUME"] = (string)$vol;
    $fx["MUSIC_AUTOPLAY"] = (($fx["MUSIC_AUTOPLAY"] ?? "no") === "yes") ? "yes" : "no";
    $fx["MUSIC_SHUFFLE"] = (($fx["MUSIC_SHUFFLE"] ?? "no") === "yes") ? "yes" : "no";
    $rp = strtolower(trim((string)($fx["MUSIC_REPEAT"] ?? "off")));
    $fx["MUSIC_REPEAT"] = in_array($rp, ["off", "one", "all"], true) ? $rp : "off";
    $fx["MUSIC_DASH_ONLY"] = (($fx["MUSIC_DASH_ONLY"] ?? "yes") === "no") ? "no" : "yes";
}

function ucwc_fx_normalize_font(&$fx) {
    $bodies = ["system", "rajdhani", "noto_sc", "yahei", "inter", "rubik", "source_han", "custom", "local"];
    $titles = ["orbitron", "match_body", "system", "noto_sc", "yahei", "inter", "rubik", "exo2", "source_han", "custom", "local"];
    $presets = ["cyber", "ice", "gold", "mint", "violet", "sunset", "custom"];
    $sizes = ["13", "14", "15", "16", "17", "18"];
    $titleSizes = ["default", "sm", "md", "lg", "xl"];
    if (!in_array($fx["FONT_BODY"], $bodies, true)) $fx["FONT_BODY"] = "rajdhani";
    if (!in_array($fx["FONT_TITLE"], $titles, true)) $fx["FONT_TITLE"] = "orbitron";
    $fx["FONT_TITLE_UPPER"] = ($fx["FONT_TITLE_UPPER"] === "yes") ? "yes" : "no";
    if (!in_array((string)$fx["FONT_SIZE"], $sizes, true)) $fx["FONT_SIZE"] = "14";
    if (!in_array((string)($fx["FONT_TITLE_SIZE"] ?? "default"), $titleSizes, true)) $fx["FONT_TITLE_SIZE"] = "default";
    $fx["FONT_CUSTOM_BODY"] = ucwc_font_family_ok($fx["FONT_CUSTOM_BODY"] ?? "");
    $fx["FONT_CUSTOM_TITLE"] = ucwc_font_family_ok($fx["FONT_CUSTOM_TITLE"] ?? "");
    $fx["FONT_LOCAL_BODY"] = ucwc_font_local_name_ok($fx["FONT_LOCAL_BODY"] ?? "");
    $fx["FONT_LOCAL_TITLE"] = ucwc_font_local_name_ok($fx["FONT_LOCAL_TITLE"] ?? "");
    if (!in_array($fx["COLOR_PRESET"], $presets, true)) $fx["COLOR_PRESET"] = "cyber";
    $fx["COLOR_TEXT"] = ucwc_hex_ok($fx["COLOR_TEXT"] ?? "");
    $fx["COLOR_TITLE"] = ucwc_hex_ok($fx["COLOR_TITLE"] ?? "");
    $fx["COLOR_LABEL"] = ucwc_hex_ok($fx["COLOR_LABEL"] ?? "");
}

function ucwc_fx_load($path) {
    $fx = ucwc_fx_defaults();
    if (!is_file($path)) return $fx;
    $raw = @parse_ini_file($path);
    if (!is_array($raw)) return $fx;
    foreach ($fx as $k => $v) {
        if (array_key_exists($k, $raw)) $fx[$k] = (string)$raw[$k];
    }
    $fx["PARTICLES"] = ($fx["PARTICLES"] === "yes") ? "yes" : "no";
    $fx["HUTAO"] = ($fx["HUTAO"] === "no") ? "no" : "yes";
    if (!in_array($fx["HUTAO_SIZE"], ["small", "medium", "large"], true)) $fx["HUTAO_SIZE"] = "medium";
    if (!in_array($fx["HUTAO_POS"], ["tl", "tr", "bl", "br"], true)) $fx["HUTAO_POS"] = "br";
    $fx["HUTAO_TYPE"] = ($fx["HUTAO_TYPE"] === "custom") ? "custom" : "hutao";
    $fx["HUTAO_BLUR"] = ($fx["HUTAO_BLUR"] === "yes") ? "yes" : "no";
    $fx["HUTAO_BLUR_LEVEL"] = ucwc_blur_level_ok($fx["HUTAO_BLUR_LEVEL"] ?? "md");
    $fx["REDUCE_MOTION"] = ($fx["REDUCE_MOTION"] === "yes") ? "yes" : "no";
    $n = intval($fx["PARTICLES_COUNT"]);
    if ($n < 30) $n = 30;
    if ($n > 120) $n = 120;
    $fx["PARTICLES_COUNT"] = (string)$n;
    $fx["BG_MODE"] = ($fx["BG_MODE"] === "dynamic") ? "dynamic" : "local";
    if (!in_array($fx["BG_LOCAL_SLOT"], ["1", "2", "custom"], true)) $fx["BG_LOCAL_SLOT"] = "1";
    if (!in_array($fx["BG_GALLERY"], ["photo", "anime", "gufeng", "custom"], true)) $fx["BG_GALLERY"] = "photo";
    $fx["BG_BLUR"] = ($fx["BG_BLUR"] === "yes") ? "yes" : "no";
    $fx["BG_BLUR_LEVEL"] = ucwc_blur_level_ok($fx["BG_BLUR_LEVEL"] ?? "md");
    $pp = strtolower(trim((string)($fx["PERF_PROFILE"] ?? "auto")));
    $fx["PERF_PROFILE"] = in_array($pp, ["auto", "high", "balanced", "low"], true) ? $pp : "auto";
    $fx["CLIENT_OPTIMIZED"] = (($fx["CLIENT_OPTIMIZED"] ?? "no") === "yes") ? "yes" : "no";
    ucwc_fx_normalize_mouse($fx);
    ucwc_fx_normalize_music($fx);
    ucwc_fx_normalize_font($fx);
    return $fx;
}

function ucwc_fx_section($raw) {
    $s = strtolower(trim((string)$raw));
    if (in_array($s, ["bg", "background", "wallpaper"], true)) return "bg";
    if (in_array($s, ["particles", "particle", "fx"], true)) return "particles";
    if (in_array($s, ["mouse", "cursor", "pointer", "鼠标"], true)) return "mouse";
    if (in_array($s, ["music", "player", "audio", "音乐"], true)) return "music";
    if (in_array($s, ["mascot", "hutao", "吉祥物"], true)) return "mascot";
    if (in_array($s, ["font", "fonts", "color", "colors", "typo", "字体"], true)) return "font";
    if (in_array($s, ["perf", "performance", "gpu", "client"], true)) return "perf";
    if (in_array($s, ["service", "runtime", "master", "plugin"], true)) return "service";
    if (in_array($s, ["all", "full", ""], true)) return "all";
    return "all";
}

/** Write plugin master switch to theme.effects.cfg (SERVICE=enabled|disabled). */
function ucwc_write_service($enabled) {
    $flash = "/boot/config/plugins/theme.effects/theme.effects.cfg";
    $rt = "/usr/local/emhttp/plugins/theme.effects/theme.effects.cfg";
    $val = $enabled ? "enabled" : "disabled";
    $body = 'SERVICE="' . $val . '"' . "\n";
    $ok = (@file_put_contents($flash, $body) !== false);
    if ($ok) {
        @chmod($flash, 0644);
        @copy($flash, $rt);
        @chmod($rt, 0644);
    }
    return $ok;
}

function ucwc_fx_save($path, $fx) {
    $keys = ["PARTICLES","PARTICLES_COUNT","HUTAO","HUTAO_SIZE","HUTAO_POS","HUTAO_TYPE","HUTAO_BLUR","HUTAO_BLUR_LEVEL","REDUCE_MOTION","MOUSE_FX","MOUSE_STYLE","MOUSE_SIZE","MOUSE_INTENSITY","MOUSE_COLOR","MOUSE_CLICK_RIPPLE","MOUSE_CURSOR","MOUSE_CURSOR_HOTSPOT_X","MOUSE_CURSOR_HOTSPOT_Y","MUSIC_ENABLE","MUSIC_UI","MUSIC_SOURCE","MUSIC_LOCAL_DIR","MUSIC_VOLUME","MUSIC_AUTOPLAY","MUSIC_SHUFFLE","MUSIC_REPEAT","MUSIC_DASH_ONLY","BG_MODE","BG_LOCAL_SLOT","BG_GALLERY","BG_CUSTOM_API","BG_BLUR","BG_BLUR_LEVEL","FONT_BODY","FONT_TITLE","FONT_TITLE_UPPER","FONT_SIZE","FONT_TITLE_SIZE","FONT_CUSTOM_BODY","FONT_CUSTOM_TITLE","FONT_LOCAL_BODY","FONT_LOCAL_TITLE","COLOR_PRESET","COLOR_TEXT","COLOR_TITLE","COLOR_LABEL","PERF_PROFILE","CLIENT_OPTIMIZED"];
    $lines = [];
    foreach ($keys as $k) {
        $lines[] = $k . '="' . str_replace(['\\', '"'], ['\\\\', '\\"'], (string)$fx[$k]) . '"';
    }
    $lines[] = "";
    $ok = @file_put_contents($path, implode("\n", $lines)) !== false;
    if ($ok) @chmod($path, 0644);
    return $ok;
}

function ucwc_has($file) {
    return is_file($file) && @filesize($file) > 0;
}

function ucwc_chmod_pub($file) {
    if (is_file($file)) @chmod($file, 0644);
}

function ucwc_write_image($data, $dst_f, $dst_r) {
    // Runtime (emhttp) first so WebUI can use the file immediately; flash is persistence.
    @mkdir(dirname($dst_r), 0755, true);
    @mkdir(dirname($dst_f), 0755, true);
    if (@file_put_contents($dst_r, $data) === false) return false;
    @chmod($dst_r, 0644);
    @file_put_contents($dst_f, $data);
    @chmod($dst_f, 0644);
    return true;
}

/** Stream upload from PHP tmp → runtime then flash (avoid loading multi-MB into memory). */
function ucwc_write_upload_file($tmp, $dst_f, $dst_r) {
    @mkdir(dirname($dst_r), 0755, true);
    @mkdir(dirname($dst_f), 0755, true);
    // Prefer move into runtime; fall back to copy if move fails (cross-device).
    $okR = @move_uploaded_file($tmp, $dst_r);
    if (!$okR) {
        $okR = @copy($tmp, $dst_r);
        @unlink($tmp);
    }
    if (!$okR || !is_file($dst_r) || @filesize($dst_r) <= 0) return false;
    @chmod($dst_r, 0644);
    // Persist to flash (USB); best-effort — runtime already usable
    if (!@copy($dst_r, $dst_f)) {
        // still OK for current boot if runtime write succeeded
        return is_file($dst_r) && @filesize($dst_r) > 0;
    }
    @chmod($dst_f, 0644);
    return true;
}

function ucwc_peek_header($path, $n = 16) {
    $fh = @fopen($path, "rb");
    if (!$fh) return "";
    $h = @fread($fh, $n);
    @fclose($fh);
    return $h === false ? "" : $h;
}

function ucwc_is_image_file($path, $gif_only = false) {
    if (!is_file($path) || @filesize($path) <= 0) return false;
    $h = ucwc_peek_header($path, 16);
    if ($h === "" || strlen($h) < 6) return false;
    if ($gif_only) {
        return (substr($h, 0, 6) === "GIF87a" || substr($h, 0, 6) === "GIF89a");
    }
    if (substr($h, 0, 3) === "\xFF\xD8\xFF") return true;
    if (substr($h, 0, 8) === "\x89PNG\r\n\x1a\n") return true;
    if (substr($h, 0, 6) === "GIF87a" || substr($h, 0, 6) === "GIF89a") return true;
    if (substr($h, 0, 4) === "RIFF") {
        // need bytes 8-11 = WEBP
        $h2 = ucwc_peek_header($path, 12);
        return strlen($h2) >= 12 && substr($h2, 8, 4) === "WEBP";
    }
    return false;
}

/** Detect cursor-friendly assets: png / webp / svg / cur / ico. */
function ucwc_is_cursor_file($path) {
    if (!is_file($path) || @filesize($path) <= 0) return false;
    $h = ucwc_peek_header($path, 16);
    if ($h === "") return false;
    if (substr($h, 0, 8) === "\x89PNG\r\n\x1a\n") return true;
    if (substr($h, 0, 4) === "RIFF") {
        $h2 = ucwc_peek_header($path, 12);
        return strlen($h2) >= 12 && substr($h2, 8, 4) === "WEBP";
    }
    // SVG (text)
    $t = strtolower(ltrim($h));
    if (strpos($t, "<?xml") === 0 || strpos($t, "<svg") === 0) return true;
    // ICO / CUR: reserved 0 + type 1/2 little-endian
    if (strlen($h) >= 6) {
        $b0 = ord($h[0]); $b1 = ord($h[1]); $b2 = ord($h[2]); $b3 = ord($h[3]);
        if ($b0 === 0 && $b1 === 0 && ($b2 === 1 || $b2 === 2) && $b3 === 0) return true;
    }
    return false;
}

/**
 * Save custom cursor upload as assets/cursor-custom.{ext}.
 * Removes previous cursor-custom.* variants so only one is active.
 * Returns "" on success / no file; error string on failure. Sets $outExt.
 */
function ucwc_handle_cursor_upload($file, $assets_f, $assets_r, &$outExt) {
    global $log_path;
    $outExt = "";
    if (!isset($file) || !is_array($file)) return "";
    $err = (int)($file["error"] ?? UPLOAD_ERR_NO_FILE);
    if ($err === UPLOAD_ERR_NO_FILE) return "";
    if ($err !== UPLOAD_ERR_OK) return ucwc_upload_err_msg($err);
    $tmp = $file["tmp_name"] ?? "";
    if ($tmp === "" || !is_uploaded_file($tmp)) return "指针临时文件无效。";
    $size = (int)($file["size"] ?? 0);
    if ($size <= 0) $size = (int)@filesize($tmp);
    if ($size <= 0) return "指针文件为空。";
    if ($size > 2 * 1024 * 1024) return "自定义指针不能超过 2MB。";
    if (!ucwc_is_cursor_file($tmp)) return "指针仅支持 png / webp / svg / cur / ico。";

    $name = strtolower((string)($file["name"] ?? ""));
    $ext = pathinfo($name, PATHINFO_EXTENSION);
    $ext = preg_replace('/[^a-z0-9]/', '', $ext);
    $h = ucwc_peek_header($tmp, 16);
    if (substr($h, 0, 8) === "\x89PNG\r\n\x1a\n") $ext = "png";
    elseif (substr($h, 0, 4) === "RIFF") $ext = "webp";
    elseif (strpos(strtolower(ltrim($h)), "<svg") !== false || strpos(strtolower(ltrim($h)), "<?xml") === 0) $ext = "svg";
    elseif (strlen($h) >= 4 && ord($h[0]) === 0 && ord($h[1]) === 0 && ord($h[2]) === 2) $ext = "cur";
    elseif (strlen($h) >= 4 && ord($h[0]) === 0 && ord($h[1]) === 0 && ord($h[2]) === 1) $ext = "ico";
    if (!in_array($ext, ["png", "webp", "svg", "cur", "ico"], true)) $ext = "png";

    $label = "cursor-custom." . $ext;
    $dst_f = rtrim($assets_f, "/") . "/" . $label;
    $dst_r = rtrim($assets_r, "/") . "/" . $label;
    // clear old variants
    foreach (["png", "webp", "svg", "cur", "ico"] as $old) {
        $of = rtrim($assets_f, "/") . "/cursor-custom." . $old;
        $or = rtrim($assets_r, "/") . "/cursor-custom." . $old;
        if ($old !== $ext) {
            if (is_file($of)) @unlink($of);
            if (is_file($or)) @unlink($or);
        }
    }
    if (!ucwc_write_upload_file($tmp, $dst_f, $dst_r)) {
        return "保存自定义指针失败。";
    }
    $outExt = $ext;
    if (!empty($log_path)) {
        ucwc_log($log_path, "cursor-upload-ok ext={$ext} size={$size} name=" . ($file["name"] ?? ""));
    }
    return "";
}

function ucwc_sync_pair($src, $dst_f, $dst_r) {
    if (!ucwc_has($src)) return false;
    if (!@copy($src, $dst_f)) return false;
    @chmod($dst_f, 0644);
    @copy($dst_f, $dst_r);
    @chmod($dst_r, 0644);
    return true;
}

function ucwc_is_image_bytes($data) {
    if ($data === false || $data === null || strlen($data) < 24 || strlen($data) > 15 * 1024 * 1024) return false;
    $h = substr($data, 0, 12);
    if (substr($h, 0, 3) === "\xFF\xD8\xFF") return true;
    if (substr($h, 0, 8) === "\x89PNG\r\n\x1a\n") return true;
    if (substr($h, 0, 6) === "GIF87a" || substr($h, 0, 6) === "GIF89a") return true;
    if (substr($h, 0, 4) === "RIFF" && substr($data, 8, 4) === "WEBP") return true;
    return false;
}

function ucwc_gallery_url($gallery, $custom) {
    if ($gallery === "anime") return "https://cdn.seovx.com/d/?mom=302";
    if ($gallery === "gufeng") return "https://cdn.seovx.com/ha/?mom=302";
    if ($gallery === "custom") return trim((string)$custom);
    return "https://cdn.seovx.com/?mom=302";
}

function ucwc_fetch_dynamic($url, $dst_f, $dst_r) {
    $url = trim($url);
    if ($url === "" || !preg_match('#^https?://#i', $url)) return "在线图库地址无效（需 http/https）。";
    if (!function_exists("curl_init")) return "服务器缺少 curl 扩展。";
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_USERAGENT => "UCWC-ThemeEffects/1.0",
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
    ]);
    $data = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($data === false || $data === "") return "拉取失败：" . ($err !== "" ? $err : "空响应");
    if ($code >= 400) return "拉取失败 HTTP " . $code;
    if (!ucwc_is_image_bytes($data)) return "返回内容不是有效图片。";
    if (!ucwc_write_image($data, $dst_f, $dst_r)) return "写入 background-dynamic.jpg 失败。";
    return "";
}

function ucwc_upload_err_msg($code) {
    $code = (int)$code;
    $uploadMax = ini_get("upload_max_filesize") ?: "?";
    $postMax = ini_get("post_max_size") ?: "?";
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
            return "上传失败：文件超过 PHP upload_max_filesize（当前 {$uploadMax}）。请压缩壁纸后重试。";
        case UPLOAD_ERR_FORM_SIZE:
            return "上传失败：文件超过表单 MAX_FILE_SIZE 限制。";
        case UPLOAD_ERR_PARTIAL:
            return "上传失败：文件只上传了一部分，请重试。";
        case UPLOAD_ERR_NO_FILE:
            return "";
        case UPLOAD_ERR_NO_TMP_DIR:
            return "上传失败：服务器临时目录不可用。";
        case UPLOAD_ERR_CANT_WRITE:
            return "上传失败：无法写入临时文件。";
        case UPLOAD_ERR_EXTENSION:
            return "上传失败：被 PHP 扩展中断。";
        default:
            return "上传失败，错误码 {$code}（upload_max={$uploadMax}, post_max={$postMax}）。";
    }
}

function ucwc_handle_upload($file, $dst_f, $dst_r, $label = "background-custom.jpg", $gif_only = false) {
    global $log_path;
    $t0 = microtime(true);
    if (!isset($file) || !is_array($file)) {
        $contentLen = isset($_SERVER["CONTENT_LENGTH"]) ? (int)$_SERVER["CONTENT_LENGTH"] : 0;
        $postMax = ini_get("post_max_size");
        if ($contentLen > 0 && empty($_POST) && empty($_FILES)) {
            return "上传失败：请求体被丢弃（可能超过 post_max_size={$postMax}）。请压缩文件后重试。";
        }
        return "";
    }
    $err = (int)($file["error"] ?? UPLOAD_ERR_NO_FILE);
    if ($err === UPLOAD_ERR_NO_FILE) return "";
    if ($err !== UPLOAD_ERR_OK) return ucwc_upload_err_msg($err);
    $tmp = $file["tmp_name"] ?? "";
    if ($tmp === "" || !is_uploaded_file($tmp)) return "上传临时文件无效。";
    $size = (int)($file["size"] ?? 0);
    if ($size <= 0) $size = (int)@filesize($tmp);
    if ($size <= 0) return "上传文件为空。";
    $uploadMax = ini_get("upload_max_filesize") ?: "2M";
    $maxBytes = $gif_only ? 8 * 1024 * 1024 : 15 * 1024 * 1024;
    if ($size > $maxBytes) {
        return $gif_only
            ? "自定义吉祥物不能超过 8MB（当前 PHP upload_max_filesize={$uploadMax}）。"
            : "自定义壁纸不能超过 15MB（当前 PHP upload_max_filesize={$uploadMax}）。";
    }
    // Header-only magic check — do not load entire multi-MB file into RAM
    if ($gif_only) {
        if (!ucwc_is_image_file($tmp, true)) return "自定义吉祥物仅支持 GIF。";
    } elseif (!ucwc_is_image_file($tmp, false)) {
        return "仅支持 jpg / png / webp / gif。";
    }
    if (!ucwc_write_upload_file($tmp, $dst_f, $dst_r)) {
        $permF = is_writable(dirname($dst_f)) ? "ok" : "no";
        $permR = is_writable(dirname($dst_r)) ? "ok" : "no";
        return "保存 {$label} 失败（flash可写: {$permF}, runtime可写: {$permR}）。";
    }
    if (!ucwc_has($dst_f) && !ucwc_has($dst_r)) return "保存后未找到 {$label}。";
    $ms = (int)round((microtime(true) - $t0) * 1000);
    if (!empty($log_path)) {
        ucwc_log($log_path, "upload-ok label={$label} size={$size} ms={$ms} name=" . ($file["name"] ?? ""));
    }
    return "";
}


/**
 * Copy image from Unraid local path into custom asset (flash + runtime).
 * Allowed roots: /mnt/user, /mnt/user0. Rejects .. and symlink escape.
 */
function ucwc_handle_local_path($path, $dst_f, $dst_r, $label = "background-custom.jpg", $gif_only = false) {
    global $log_path;
    $path = trim((string)$path);
    if ($path === "") return "";
    $path = str_replace("\\", "/", $path);
    if (strpos($path, "\0") !== false) return "本地路径无效。";
    if (strpos($path, "/mnt/user/") !== 0 && strpos($path, "/mnt/user0/") !== 0
        && $path !== "/mnt/user" && $path !== "/mnt/user0") {
        return "本地路径仅允许 /mnt/user 或 /mnt/user0 下的文件。";
    }
    if (strpos($path, "..") !== false) return "本地路径不能包含 ..。";
    if (!is_file($path)) return "本地文件不存在：" . $path;
    $real = @realpath($path);
    if ($real === false || !is_file($real)) return "无法解析本地路径。";
    $real = str_replace("\\", "/", $real);
    $okRoot = false;
    foreach (["/mnt/user", "/mnt/user0"] as $root) {
        $rr = @realpath($root);
        if ($rr === false) continue;
        $rr = str_replace("\\", "/", $rr);
        if ($real === $rr || strpos($real, rtrim($rr, "/") . "/") === 0) {
            $okRoot = true;
            break;
        }
    }
    if (!$okRoot) return "本地路径超出允许目录（/mnt/user、/mnt/user0）。";
    $size = (int)@filesize($real);
    if ($size <= 0) return "本地文件为空。";
    $maxBytes = $gif_only ? 8 * 1024 * 1024 : 15 * 1024 * 1024;
    if ($size > $maxBytes) {
        return $gif_only
            ? "自定义吉祥物不能超过 8MB。"
            : "自定义壁纸不能超过 15MB。";
    }
    if ($gif_only) {
        if (!ucwc_is_image_file($real, true)) return "自定义吉祥物仅支持 GIF。";
    } elseif (!ucwc_is_image_file($real, false)) {
        return "仅支持 jpg / png / webp / gif。";
    }
    @mkdir(dirname($dst_r), 0755, true);
    @mkdir(dirname($dst_f), 0755, true);
    if (!@copy($real, $dst_r)) return "复制到运行目录失败：{$label}。";
    @chmod($dst_r, 0644);
    @copy($dst_r, $dst_f);
    @chmod($dst_f, 0644);
    if (!ucwc_has($dst_f) && !ucwc_has($dst_r)) return "保存后未找到 {$label}。";
    if (!empty($log_path)) {
        ucwc_log($log_path, "local-path-ok label={$label} size={$size} src={$real}");
    }
    return "";
}

/** Detect font file type from magic bytes; returns ext or "". */
function ucwc_font_detect_ext($path) {
    $fh = @fopen($path, "rb");
    if (!$fh) return "";
    $h = @fread($fh, 8);
    @fclose($fh);
    if ($h === false || strlen($h) < 4) return "";
    // woff2: wOF2
    if (substr($h, 0, 4) === "wOF2") return "woff2";
    // woff: wOFF
    if (substr($h, 0, 4) === "wOFF") return "woff";
    // otf/ttf: OTTO or 00 01 00 00 or true
    if (substr($h, 0, 4) === "OTTO") return "otf";
    if (substr($h, 0, 4) === "true" || substr($h, 0, 4) === "typ1") return "ttf";
    if (strlen($h) >= 4 && $h[0] === "\x00" && $h[1] === "\x01" && $h[2] === "\x00" && $h[3] === "\x00") return "ttf";
    return "";
}

/**
 * Handle local font upload into assets/fonts/{body|title}-custom.{ext}.
 * Sets $outName to stored filename on success. Empty string if no new file.
 * Returns error message or "".
 */
function ucwc_handle_font_upload($file, $slot, $assets_f, $assets_r, &$outName) {
    global $log_path;
    $outName = "";
    $slot = ($slot === "title") ? "title" : "body";
    if (!isset($file) || !is_array($file)) return "";
    $err = (int)($file["error"] ?? UPLOAD_ERR_NO_FILE);
    if ($err === UPLOAD_ERR_NO_FILE) return "";
    if ($err !== UPLOAD_ERR_OK) return ucwc_upload_err_msg($err);
    $tmp = $file["tmp_name"] ?? "";
    if ($tmp === "" || !is_uploaded_file($tmp)) return "字体临时文件无效。";
    $size = (int)($file["size"] ?? 0);
    if ($size <= 0) $size = (int)@filesize($tmp);
    if ($size <= 0) return "字体文件为空。";
    if ($size > 4 * 1024 * 1024) return "本地字体不能超过 4MB，请压缩或子集化后重试。";
    $ext = ucwc_font_detect_ext($tmp);
    if ($ext === "") {
        // fallback: extension from original name
        $orig = strtolower((string)($file["name"] ?? ""));
        if (preg_match('/\.(woff2|woff|ttf|otf)$/', $orig, $m)) $ext = $m[1];
    }
    if ($ext === "") return "仅支持 woff2 / woff / ttf / otf 字体文件。";
    $name = $slot . "-custom." . $ext;
    $dir_f = rtrim($assets_f, "/") . "/fonts";
    $dir_r = rtrim($assets_r, "/") . "/fonts";
    @mkdir($dir_f, 0755, true);
    @mkdir($dir_r, 0755, true);
    // remove previous body/title custom fonts of other ext
    foreach (["woff2", "woff", "ttf", "otf"] as $oldExt) {
        $old = $slot . "-custom." . $oldExt;
        if ($old === $name) continue;
        @unlink("$dir_f/$old");
        @unlink("$dir_r/$old");
    }
    if (!ucwc_write_upload_file($tmp, "$dir_f/$name", "$dir_r/$name")) {
        return "保存本地字体失败（{$name}）。";
    }
    $outName = $name;
    if (!empty($log_path)) {
        ucwc_log($log_path, "font-upload-ok slot={$slot} name={$name} size={$size}");
    }
    return "";
}

if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
    ucwc_json(["ok" => false, "error" => "需要 POST。"], 405);
}

if (!isset($_POST["SAVE_THEME_FX"])) {
    ucwc_json(["ok" => false, "error" => "缺少 SAVE_THEME_FX。"], 400);
}

$post_keys = implode(",", array_keys($_POST));
$file_info = [];
foreach ($_FILES as $fk => $fv) {
    if (!is_array($fv)) continue;
    $file_info[] = $fk . ":" . ($fv["name"] ?? "") . "/" . ($fv["error"] ?? "?") . "/" . ($fv["size"] ?? 0);
}
$clen = (int)($_SERVER["CONTENT_LENGTH"] ?? 0);
$section = ucwc_fx_section($_POST["UCWC_SECTION"] ?? ($_POST["section"] ?? "all"));
ucwc_log($log_path, "ajax-save section={$section} keys={$post_keys} files=" . (count($file_info) ? implode(";", $file_info) : "-") . " content_length={$clen}");

// Master runtime switch (title toggle) — does not touch theme-effects.cfg feature keys.
if ($section === "service") {
    $raw = strtolower(trim((string)($_POST["SERVICE"] ?? "")));
    $on = in_array($raw, ["enabled", "enable", "1", "yes", "on", "true"], true);
    if (in_array($raw, ["disabled", "disable", "0", "no", "off", "false"], true)) $on = false;
    if ($raw === "" && isset($_POST["enabled"])) {
        $on = in_array(strtolower(trim((string)$_POST["enabled"])), ["1", "yes", "true", "on", "enabled"], true);
    }
    $ok = ucwc_write_service($on);
    ucwc_log($log_path, "service-switch on=" . ($on ? "1" : "0") . " ok=" . ($ok ? "1" : "0"));
    ucwc_json([
        "ok" => $ok,
        "service" => $on ? "enabled" : "disabled",
        "reload" => true,
        "message" => $ok
            ? ($on ? "主题特效已开启，正在刷新…" : "主题特效已关闭，正在刷新…")
            : "无法写入运行开关配置。",
    ]);
    exit;
}

// Partial apply: start from saved cfg so other sections are not reset to defaults.
$fx = ucwc_fx_load($fx_path);
$doBg = ($section === "all" || $section === "bg");
$doParticles = ($section === "all" || $section === "particles");
$doMouse = ($section === "all" || $section === "mouse");
$doMusic = ($section === "all" || $section === "music");
$doMascot = ($section === "all" || $section === "mascot");
$doFont = ($section === "all" || $section === "font");
$doPerf = ($section === "all" || $section === "perf");

if ($doParticles) {
    // Missing POST keys must NOT flip toggles (toast/partial section=all safety).
    if (isset($_POST["PARTICLES"])) {
        $fx["PARTICLES"] = (($_POST["PARTICLES"] ?? "no") === "yes") ? "yes" : "no";
    }
    if (isset($_POST["REDUCE_MOTION"])) {
        $fx["REDUCE_MOTION"] = (($_POST["REDUCE_MOTION"] ?? "no") === "yes") ? "yes" : "no";
    }
    if (isset($_POST["PARTICLES_COUNT_COMMIT"]) || isset($_POST["PARTICLES_COUNT"])) {
        $rawCount = $_POST["PARTICLES_COUNT_COMMIT"] ?? ($_POST["PARTICLES_COUNT"] ?? $fx["PARTICLES_COUNT"]);
        $n = intval($rawCount);
        if ($n < 30) $n = 30;
        if ($n > 120) $n = 120;
        $fx["PARTICLES_COUNT"] = (string)$n;
    }
}

if ($doMouse) {
    if (isset($_POST["MOUSE_FX"])) {
        $fx["MOUSE_FX"] = (($_POST["MOUSE_FX"] ?? "no") === "yes") ? "yes" : "no";
    }
    if (isset($_POST["MOUSE_STYLE"])) {
        $st = strtolower(trim((string)($_POST["MOUSE_STYLE"] ?? ($fx["MOUSE_STYLE"] ?? "glow"))));
        $fx["MOUSE_STYLE"] = in_array($st, ["glow", "ring", "trail", "spark"], true) ? $st : "glow";
    }
    if (isset($_POST["MOUSE_SIZE_COMMIT"]) || isset($_POST["MOUSE_SIZE"])) {
        $sz = intval($_POST["MOUSE_SIZE_COMMIT"] ?? ($_POST["MOUSE_SIZE"] ?? ($fx["MOUSE_SIZE"] ?? 80)));
        if ($sz < 40) $sz = 40;
        if ($sz > 160) $sz = 160;
        $fx["MOUSE_SIZE"] = (string)$sz;
    }
    if (isset($_POST["MOUSE_INTENSITY_COMMIT"]) || isset($_POST["MOUSE_INTENSITY"])) {
        $it = intval($_POST["MOUSE_INTENSITY_COMMIT"] ?? ($_POST["MOUSE_INTENSITY"] ?? ($fx["MOUSE_INTENSITY"] ?? 55)));
        if ($it < 15) $it = 15;
        if ($it > 100) $it = 100;
        $fx["MOUSE_INTENSITY"] = (string)$it;
    }
    if (isset($_POST["MOUSE_COLOR"])) {
        $fx["MOUSE_COLOR"] = ucwc_hex_ok($_POST["MOUSE_COLOR"] ?? ($fx["MOUSE_COLOR"] ?? ""));
    }
    if (isset($_POST["MOUSE_CLICK_RIPPLE"])) {
        $fx["MOUSE_CLICK_RIPPLE"] = (($_POST["MOUSE_CLICK_RIPPLE"] ?? "yes") === "no") ? "no" : "yes";
    }
    if (isset($_POST["MOUSE_CURSOR"])) {
        $cur = strtolower(trim((string)($_POST["MOUSE_CURSOR"] ?? ($fx["MOUSE_CURSOR"] ?? "system"))));
        if ($cur === "auto" || $cur === "default" || $cur === "") $cur = "system";
        if ($cur === "custom") $cur = "upload";
        if (in_array($cur, ["dot", "cross", "neon", "none"], true)) $cur = "neon3d";
        $fx["MOUSE_CURSOR"] = in_array($cur, ["system", "neon3d", "holo", "cyber", "crystal", "upload"], true) ? $cur : "system";
    }
    if (isset($_POST["MOUSE_CURSOR_HOTSPOT_X"])) {
        $hx = intval($_POST["MOUSE_CURSOR_HOTSPOT_X"] ?? ($fx["MOUSE_CURSOR_HOTSPOT_X"] ?? 4));
        if ($hx < 0) $hx = 0;
        if ($hx > 128) $hx = 128;
        $fx["MOUSE_CURSOR_HOTSPOT_X"] = (string)$hx;
    }
    if (isset($_POST["MOUSE_CURSOR_HOTSPOT_Y"])) {
        $hy = intval($_POST["MOUSE_CURSOR_HOTSPOT_Y"] ?? ($fx["MOUSE_CURSOR_HOTSPOT_Y"] ?? 2));
        if ($hy < 0) $hy = 0;
        if ($hy > 128) $hy = 128;
        $fx["MOUSE_CURSOR_HOTSPOT_Y"] = (string)$hy;
    }
    ucwc_fx_normalize_mouse($fx);
}

/* Cursor upload is processed later with $assets_* dirs; flag only here. */
$doCursorUpload = $doMouse;

if ($doMusic) {
    if (isset($_POST["MUSIC_ENABLE"])) {
        $fx["MUSIC_ENABLE"] = (($_POST["MUSIC_ENABLE"] ?? "no") === "yes") ? "yes" : "no";
    }
    if (isset($_POST["MUSIC_UI"])) {
        $ui = strtolower(trim((string)($_POST["MUSIC_UI"] ?? "card")));
        $fx["MUSIC_UI"] = in_array($ui, ["card", "float", "statusbar"], true) ? $ui : "card";
    }
    if (isset($_POST["MUSIC_SOURCE"])) {
        $src = strtolower(trim((string)($_POST["MUSIC_SOURCE"] ?? "local")));
        $fx["MUSIC_SOURCE"] = in_array($src, ["local", "navidrome", "emby", "jellyfin"], true) ? $src : "local";
    }
    if (isset($_POST["MUSIC_LOCAL_DIR"])) {
        $fx["MUSIC_LOCAL_DIR"] = ucwc_music_dir_ok($_POST["MUSIC_LOCAL_DIR"] ?? "");
    }
    if (isset($_POST["MUSIC_VOLUME_COMMIT"]) || isset($_POST["MUSIC_VOLUME"])) {
        $vol = intval($_POST["MUSIC_VOLUME_COMMIT"] ?? ($_POST["MUSIC_VOLUME"] ?? ($fx["MUSIC_VOLUME"] ?? 70)));
        if ($vol < 0) $vol = 0;
        if ($vol > 100) $vol = 100;
        $fx["MUSIC_VOLUME"] = (string)$vol;
    }
    if (isset($_POST["MUSIC_AUTOPLAY"])) {
        $fx["MUSIC_AUTOPLAY"] = (($_POST["MUSIC_AUTOPLAY"] ?? "no") === "yes") ? "yes" : "no";
    }
    if (isset($_POST["MUSIC_SHUFFLE"])) {
        $fx["MUSIC_SHUFFLE"] = (($_POST["MUSIC_SHUFFLE"] ?? "no") === "yes") ? "yes" : "no";
    }
    if (isset($_POST["MUSIC_REPEAT"])) {
        $rp = strtolower(trim((string)($_POST["MUSIC_REPEAT"] ?? "off")));
        $fx["MUSIC_REPEAT"] = in_array($rp, ["off", "one", "all"], true) ? $rp : "off";
    }
    if (isset($_POST["MUSIC_DASH_ONLY"])) {
        $fx["MUSIC_DASH_ONLY"] = (($_POST["MUSIC_DASH_ONLY"] ?? "yes") === "no") ? "no" : "yes";
    }
    ucwc_fx_normalize_music($fx);
}

if ($doMascot) {
    if (isset($_POST["HUTAO"])) {
        $fx["HUTAO"] = (($_POST["HUTAO"] ?? "yes") === "no") ? "no" : "yes";
    }
    if (isset($_POST["HUTAO_SIZE"])) {
        $hs = (string)($_POST["HUTAO_SIZE"] ?? $fx["HUTAO_SIZE"]);
        $fx["HUTAO_SIZE"] = in_array($hs, ["small", "medium", "large"], true) ? $hs : "medium";
    }
    if (isset($_POST["HUTAO_POS"])) {
        $hp = (string)($_POST["HUTAO_POS"] ?? $fx["HUTAO_POS"]);
        $fx["HUTAO_POS"] = in_array($hp, ["tl", "tr", "bl", "br"], true) ? $hp : "br";
    }
    if (isset($_POST["HUTAO_TYPE"])) {
        $fx["HUTAO_TYPE"] = (((string)($_POST["HUTAO_TYPE"] ?? $fx["HUTAO_TYPE"])) === "custom") ? "custom" : "hutao";
    }
    if (isset($_POST["HUTAO_BLUR"])) {
        $fx["HUTAO_BLUR"] = (($_POST["HUTAO_BLUR"] ?? "no") === "yes") ? "yes" : "no";
    }
    if (isset($_POST["HUTAO_BLUR_LEVEL"])) {
        $fx["HUTAO_BLUR_LEVEL"] = ucwc_blur_level_ok($_POST["HUTAO_BLUR_LEVEL"] ?? ($fx["HUTAO_BLUR_LEVEL"] ?? "md"));
    }
}


if ($doFont && (isset($_POST["FONT_BODY"]) || isset($_POST["FONT_TITLE"]) || isset($_POST["COLOR_PRESET"]) || isset($_FILES["FONT_BODY_UPLOAD"]) || isset($_FILES["FONT_TITLE_UPLOAD"]))) {
    $fx["FONT_BODY"] = (string)($_POST["FONT_BODY"] ?? $fx["FONT_BODY"]);
    $fx["FONT_TITLE"] = (string)($_POST["FONT_TITLE"] ?? $fx["FONT_TITLE"]);
    $fx["FONT_TITLE_UPPER"] = (($_POST["FONT_TITLE_UPPER"] ?? $fx["FONT_TITLE_UPPER"]) === "yes") ? "yes" : "no";
    $fx["FONT_SIZE"] = (string)($_POST["FONT_SIZE"] ?? $fx["FONT_SIZE"]);
    $fx["FONT_TITLE_SIZE"] = (string)($_POST["FONT_TITLE_SIZE"] ?? $fx["FONT_TITLE_SIZE"] ?? "default");
    $fx["FONT_CUSTOM_BODY"] = (string)($_POST["FONT_CUSTOM_BODY"] ?? $fx["FONT_CUSTOM_BODY"] ?? "");
    $fx["FONT_CUSTOM_TITLE"] = (string)($_POST["FONT_CUSTOM_TITLE"] ?? $fx["FONT_CUSTOM_TITLE"] ?? "");
    // keep existing local names unless new upload overwrites
    $fx["FONT_LOCAL_BODY"] = (string)($fx["FONT_LOCAL_BODY"] ?? "");
    $fx["FONT_LOCAL_TITLE"] = (string)($fx["FONT_LOCAL_TITLE"] ?? "");
    $fx["COLOR_PRESET"] = (string)($_POST["COLOR_PRESET"] ?? $fx["COLOR_PRESET"]);
    $fx["COLOR_TEXT"] = (string)($_POST["COLOR_TEXT"] ?? $fx["COLOR_TEXT"]);
    $fx["COLOR_TITLE"] = (string)($_POST["COLOR_TITLE"] ?? $fx["COLOR_TITLE"]);
    $fx["COLOR_LABEL"] = (string)($_POST["COLOR_LABEL"] ?? $fx["COLOR_LABEL"]);
    ucwc_fx_normalize_font($fx);
    // Selecting a named preset clears custom hex so Loader uses preset palette.
    if ($fx["COLOR_PRESET"] !== "custom") {
        $fx["COLOR_TEXT"] = "";
        $fx["COLOR_TITLE"] = "";
        $fx["COLOR_LABEL"] = "";
    }
}

if ($doBg) {
    if (isset($_POST["BG_MODE"])) {
        $fx["BG_MODE"] = (($_POST["BG_MODE"] ?? "local") === "dynamic") ? "dynamic" : "local";
    }
    if (isset($_POST["BG_LOCAL_SLOT"])) {
        $slot = (string)($_POST["BG_LOCAL_SLOT"] ?? $fx["BG_LOCAL_SLOT"]);
        $fx["BG_LOCAL_SLOT"] = in_array($slot, ["1", "2", "custom"], true) ? $slot : "1";
    }
    if (isset($_POST["BG_GALLERY"])) {
        $gal = (string)($_POST["BG_GALLERY"] ?? $fx["BG_GALLERY"]);
        $fx["BG_GALLERY"] = in_array($gal, ["photo", "anime", "gufeng", "custom"], true) ? $gal : "photo";
    }
    if (isset($_POST["BG_CUSTOM_API"])) {
        $fx["BG_CUSTOM_API"] = trim((string)($_POST["BG_CUSTOM_API"] ?? $fx["BG_CUSTOM_API"]));
    }
    if (isset($_POST["BG_BLUR"])) {
        $fx["BG_BLUR"] = (($_POST["BG_BLUR"] ?? "no") === "yes") ? "yes" : "no";
    }
    if (isset($_POST["BG_BLUR_LEVEL"])) {
        $fx["BG_BLUR_LEVEL"] = ucwc_blur_level_ok($_POST["BG_BLUR_LEVEL"] ?? ($fx["BG_BLUR_LEVEL"] ?? "md"));
    }
}

if ($doPerf) {
    $pp = strtolower(trim((string)($_POST["PERF_PROFILE"] ?? ($fx["PERF_PROFILE"] ?? "auto"))));
    $fx["PERF_PROFILE"] = in_array($pp, ["auto", "high", "balanced", "low"], true) ? $pp : "auto";
    // Always accept CLIENT_OPTIMIZED so first-run toast can stick on dismiss/apply.
    if (isset($_POST["CLIENT_OPTIMIZED"])) {
        $fx["CLIENT_OPTIMIZED"] = (($_POST["CLIENT_OPTIMIZED"] ?? "no") === "yes") ? "yes" : "no";
    }
    // Concrete preset: rewrite knobs only on dedicated perf apply or explicit preset flag.
    // Avoid section=all bulk saves re-clobbering particles/blur the user just changed.
    // auto = leave knobs alone (Loader still classifies runtime soft-caps).
    $applyPreset = ($section === "perf") || (($_POST["APPLY_PERF_PRESET"] ?? "") === "1");
    if ($applyPreset && isset($_POST["PERF_PROFILE"]) && $fx["PERF_PROFILE"] !== "auto") {
        ucwc_fx_apply_perf_profile($fx, $fx["PERF_PROFILE"]);
    }
}

@mkdir($assets_f, 0755, true);
@mkdir($assets_r, 0755, true);
@mkdir("$assets_f/fonts", 0755, true);
@mkdir("$assets_r/fonts", 0755, true);

$err = "";
if (!empty($doCursorUpload) && $err === "") {
    $cursorExt = "";
    $cerr = ucwc_handle_cursor_upload($_FILES["MOUSE_CURSOR_UPLOAD"] ?? null, $assets_f, $assets_r, $cursorExt);
    if ($cerr !== "") {
        $err = $cerr;
    } elseif ($cursorExt !== "") {
        // Auto-select upload mode when a file was just saved
        $fx["MOUSE_CURSOR"] = "upload";
    }
    // If user chose upload but no asset exists and no new file, keep selection; Loader falls back.
    if ($err === "" && ($fx["MOUSE_CURSOR"] ?? "") === "upload") {
        $hasCur = false;
        foreach (["png", "webp", "svg", "cur", "ico"] as $ce) {
            if (ucwc_has("$assets_f/cursor-custom.$ce") || ucwc_has("$assets_r/cursor-custom.$ce")) {
                $hasCur = true;
                break;
            }
        }
        if (!$hasCur) {
            // Soft warn only when they explicitly selected upload without a file
            $hadNew = isset($_FILES["MOUSE_CURSOR_UPLOAD"]) && is_array($_FILES["MOUSE_CURSOR_UPLOAD"])
                && (int)($_FILES["MOUSE_CURSOR_UPLOAD"]["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
            if (!$hadNew) {
                $err = "请先上传自定义指针文件（png/webp/svg/cur/ico，≤2MB）。";
            }
        }
    }
}
if ($doFont) {
    $bodyLocalName = "";
    $titleLocalName = "";
    $ferr = ucwc_handle_font_upload($_FILES["FONT_BODY_UPLOAD"] ?? null, "body", $assets_f, $assets_r, $bodyLocalName);
    if ($ferr !== "") $err = $ferr;
    if ($err === "" && $bodyLocalName !== "") $fx["FONT_LOCAL_BODY"] = $bodyLocalName;
    if ($err === "") {
        $ferr = ucwc_handle_font_upload($_FILES["FONT_TITLE_UPLOAD"] ?? null, "title", $assets_f, $assets_r, $titleLocalName);
        if ($ferr !== "") $err = $ferr;
        if ($err === "" && $titleLocalName !== "") $fx["FONT_LOCAL_TITLE"] = $titleLocalName;
    }
    if ($err === "" && $fx["FONT_BODY"] === "custom" && $fx["FONT_CUSTOM_BODY"] === "") {
        $err = "正文字体选「自定义名称」时请填写 CSS 字体名（如 Microsoft YaHei）。";
    }
    if ($err === "" && $fx["FONT_TITLE"] === "custom" && $fx["FONT_CUSTOM_TITLE"] === "" && $fx["FONT_CUSTOM_BODY"] === "") {
        $err = "标题字体选「自定义名称」时请填写标题字体名。";
    }
    if ($err === "" && $fx["FONT_BODY"] === "local") {
        $lb = $fx["FONT_LOCAL_BODY"];
        if ($lb === "" || (!ucwc_has("$assets_f/fonts/$lb") && !ucwc_has("$assets_r/fonts/$lb"))) {
            $err = "正文字体选「本地字体」时请先上传 woff2/woff/ttf/otf（≤4MB）。";
        }
    }
    if ($err === "" && $fx["FONT_TITLE"] === "local") {
        $lt = $fx["FONT_LOCAL_TITLE"];
        if ($lt === "" || (!ucwc_has("$assets_f/fonts/$lt") && !ucwc_has("$assets_r/fonts/$lt"))) {
            $err = "标题字体选「本地字体」时请先上传字体文件（≤4MB）。";
        }
    }
    ucwc_fx_normalize_font($fx);
}

$fm = "mascot-custom.gif";
if ($doMascot && $err === "" && $fx["HUTAO"] === "yes" && $fx["HUTAO_TYPE"] === "custom") {
    $hadUploadM = isset($_FILES["HUTAO_UPLOAD"]) && is_array($_FILES["HUTAO_UPLOAD"])
        && (int)($_FILES["HUTAO_UPLOAD"]["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
    $err = ucwc_handle_upload($_FILES["HUTAO_UPLOAD"] ?? null, "$assets_f/$fm", "$assets_r/$fm", $fm, true);
    // Computer upload wins; otherwise non-empty Unraid path copies/replaces.
    if ($err === "" && !$hadUploadM) {
        $localM = trim((string)($_POST["HUTAO_LOCAL_PATH"] ?? ""));
        if ($localM !== "") {
            $err = ucwc_handle_local_path($localM, "$assets_f/$fm", "$assets_r/$fm", $fm, true);
        }
    }
    if ($err === "" && !ucwc_has("$assets_f/$fm") && !ucwc_has("$assets_r/$fm")) {
        $err = "请先从电脑上传或填写 Unraid 本地路径（自定义吉祥物 GIF）。";
    }
}

if ($doBg && $fx["BG_MODE"] === "local" && $fx["BG_LOCAL_SLOT"] === "1") {
    if (!ucwc_has("$assets_f/$f1") && !ucwc_has("$assets_r/$f1")) {
        if (ucwc_has("$assets_f/background.jpg")) {
            ucwc_sync_pair("$assets_f/background.jpg", "$assets_f/$f1", "$assets_r/$f1");
        } elseif (ucwc_has("$assets_r/background.jpg")) {
            ucwc_sync_pair("$assets_r/background.jpg", "$assets_f/$f1", "$assets_r/$f1");
        }
    }
    if (!ucwc_has("$assets_f/$f1") && !ucwc_has("$assets_r/$f1")) {
        $err = "本地壁纸1 不存在（assets/background-1.jpg）。";
    } else {
        if (ucwc_has("$assets_f/$f1") && !ucwc_has("$assets_r/$f1")) @copy("$assets_f/$f1", "$assets_r/$f1");
        ucwc_chmod_pub("$assets_f/$f1");
        ucwc_chmod_pub("$assets_r/$f1");
    }
}

if ($doBg && $err === "" && $fx["BG_MODE"] === "local" && $fx["BG_LOCAL_SLOT"] === "2") {
    if (!ucwc_has("$assets_f/$f2") && !ucwc_has("$assets_r/$f2")) {
        $err = "本地壁纸2 不存在（assets/background-2.jpg）。";
    } else {
        if (ucwc_has("$assets_f/$f2") && !ucwc_has("$assets_r/$f2")) @copy("$assets_f/$f2", "$assets_r/$f2");
        ucwc_chmod_pub("$assets_f/$f2");
        ucwc_chmod_pub("$assets_r/$f2");
    }
}

if ($doBg && $err === "" && $fx["BG_MODE"] === "local" && $fx["BG_LOCAL_SLOT"] === "custom") {
    $hadUploadB = isset($_FILES["BG_UPLOAD"]) && is_array($_FILES["BG_UPLOAD"])
        && (int)($_FILES["BG_UPLOAD"]["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
    $err = ucwc_handle_upload($_FILES["BG_UPLOAD"] ?? null, "$assets_f/$fc", "$assets_r/$fc");
    if ($err === "" && !$hadUploadB) {
        $localB = trim((string)($_POST["BG_LOCAL_PATH"] ?? ""));
        if ($localB !== "") {
            $err = ucwc_handle_local_path($localB, "$assets_f/$fc", "$assets_r/$fc", $fc, false);
        }
    }
    if ($err === "" && !ucwc_has("$assets_f/$fc") && !ucwc_has("$assets_r/$fc")) {
        $err = "请先从电脑上传或填写 Unraid 本地路径（自定义壁纸，jpg/png/webp/gif，建议 ≤12MB）。";
    }
}

if ($doBg && $err === "" && $fx["BG_MODE"] === "dynamic") {
    $url = ucwc_gallery_url($fx["BG_GALLERY"], $fx["BG_CUSTOM_API"]);
    $err = ucwc_fetch_dynamic($url, "$assets_f/$fd", "$assets_r/$fd");
}

$saved = ucwc_fx_save($fx_path, $fx);
// Mirror feature cfg to runtime plugin dir (Loader may prefer either path).
if ($saved) {
    $rt_cfg = "/usr/local/emhttp/plugins/theme.effects/theme-effects.cfg";
    @file_put_contents($rt_cfg, @file_get_contents($fx_path));
    @chmod($rt_cfg, 0644);
}
ucwc_log($log_path, "ajax-saved section={$section} saved=" . ($saved ? "1" : "0") . " err=" . ($err === "" ? "-" : $err) . " " . json_encode($fx, JSON_UNESCAPED_UNICODE));

$ok = ($saved && $err === "");
$sectionLabel = ["bg" => "背景", "particles" => "粒子", "mouse" => "鼠标特效", "music" => "音乐", "mascot" => "吉祥物", "font" => "字体", "perf" => "性能", "all" => "主题特效"][$section] ?? "主题特效";
ucwc_json([
    "ok" => $ok,
    "saved" => (bool)$saved,
    "section" => $section,
    "error" => $err === "" ? null : $err,
    "message" => $ok
        ? "{$sectionLabel}已应用并生效。"
        : ($saved ? ($err . "（配置已记录，但资源未就绪）") : "写入 theme-effects.cfg 失败。"),
    "fx" => $fx,
    "redirect" => "/Settings/ThemeEffects?applied=1&section=" . rawurlencode($section),
], $ok ? 200 : ($saved ? 200 : 500));
