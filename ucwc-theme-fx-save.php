<?php
/**
 * unraid-custom-webui-css: Theme Effects AJAX save endpoint.
 * Standalone (not embedded in page layout) so we can return clean JSON.
 */
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

if (function_exists("session_status") && session_status() === PHP_SESSION_ACTIVE) {
    @session_write_close();
} elseif (function_exists("session_write_close")) {
    @session_write_close();
}

$fx_path = "/boot/config/plugins/custom.css/theme-effects.cfg";
$assets_f = "/boot/config/plugins/custom.css/assets";
$assets_r = "/usr/local/emhttp/plugins/custom.css/assets";
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
        "REDUCE_MOTION" => "no",
        "BG_MODE" => "local",
        "BG_LOCAL_SLOT" => "1",
        "BG_GALLERY" => "photo",
        "BG_CUSTOM_API" => "",
        "BG_BLUR" => "no",
    ];
}

function ucwc_fx_save($path, $fx) {
    $keys = ["PARTICLES","PARTICLES_COUNT","HUTAO","HUTAO_SIZE","HUTAO_POS","REDUCE_MOTION","BG_MODE","BG_LOCAL_SLOT","BG_GALLERY","BG_CUSTOM_API","BG_BLUR"];
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
    if (@file_put_contents($dst_f, $data) === false) return false;
    @chmod($dst_f, 0644);
    @copy($dst_f, $dst_r);
    @chmod($dst_r, 0644);
    return true;
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

function ucwc_handle_upload($file, $dst_f, $dst_r) {
    if (!isset($file) || !is_array($file)) {
        $contentLen = isset($_SERVER["CONTENT_LENGTH"]) ? (int)$_SERVER["CONTENT_LENGTH"] : 0;
        $postMax = ini_get("post_max_size");
        if ($contentLen > 0 && empty($_POST) && empty($_FILES)) {
            return "上传失败：请求体被丢弃（可能超过 post_max_size={$postMax}）。请压缩壁纸到 2MB 以内。";
        }
        return "";
    }
    $err = (int)($file["error"] ?? UPLOAD_ERR_NO_FILE);
    if ($err === UPLOAD_ERR_NO_FILE) return "";
    if ($err !== UPLOAD_ERR_OK) return ucwc_upload_err_msg($err);
    $tmp = $file["tmp_name"] ?? "";
    if ($tmp === "" || !is_uploaded_file($tmp)) return "上传临时文件无效。";
    $size = (int)($file["size"] ?? 0);
    if ($size <= 0) return "上传文件为空。";
    $uploadMax = ini_get("upload_max_filesize") ?: "2M";
    if ($size > 15 * 1024 * 1024) return "自定义壁纸不能超过 15MB（当前 PHP upload_max_filesize={$uploadMax}）。";
    $data = @file_get_contents($tmp);
    if ($data === false || $data === "") return "读取上传文件失败。";
    if (!ucwc_is_image_bytes($data)) return "仅支持 jpg / png / webp / gif。";
    @mkdir(dirname($dst_f), 0755, true);
    @mkdir(dirname($dst_r), 0755, true);
    if (!ucwc_write_image($data, $dst_f, $dst_r)) {
        $perm = is_writable(dirname($dst_f)) ? "ok" : "no";
        return "保存 background-custom.jpg 失败（目录可写: {$perm}）。";
    }
    if (!ucwc_has($dst_f) && !ucwc_has($dst_r)) return "保存后未找到 background-custom.jpg。";
    return "";
}

if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
    ucwc_json(["ok" => false, "error" => "需要 POST。"], 405);
}

if (!isset($_POST["SAVE_THEME_FX"])) {
    ucwc_json(["ok" => false, "error" => "缺少 SAVE_THEME_FX。"], 400);
}

$post_keys = implode(",", array_keys($_POST));
ucwc_log($log_path, "ajax-save keys={$post_keys}");

$fx = ucwc_fx_defaults();
$fx["PARTICLES"] = (($_POST["PARTICLES"] ?? "no") === "yes") ? "yes" : "no";
$fx["HUTAO"] = (($_POST["HUTAO"] ?? "yes") === "no") ? "no" : "yes";
$hs = (string)($_POST["HUTAO_SIZE"] ?? "medium");
$fx["HUTAO_SIZE"] = in_array($hs, ["small", "medium", "large"], true) ? $hs : "medium";
$hp = (string)($_POST["HUTAO_POS"] ?? "br");
$fx["HUTAO_POS"] = in_array($hp, ["tl", "tr", "bl", "br"], true) ? $hp : "br";
$fx["REDUCE_MOTION"] = (($_POST["REDUCE_MOTION"] ?? "no") === "yes") ? "yes" : "no";
$rawCount = $_POST["PARTICLES_COUNT_COMMIT"] ?? ($_POST["PARTICLES_COUNT"] ?? 60);
$n = intval($rawCount);
if ($n < 30) $n = 30;
if ($n > 120) $n = 120;
$fx["PARTICLES_COUNT"] = (string)$n;
$fx["BG_MODE"] = (($_POST["BG_MODE"] ?? "local") === "dynamic") ? "dynamic" : "local";
$slot = (string)($_POST["BG_LOCAL_SLOT"] ?? "1");
$fx["BG_LOCAL_SLOT"] = in_array($slot, ["1", "2", "custom"], true) ? $slot : "1";
$gal = (string)($_POST["BG_GALLERY"] ?? "photo");
$fx["BG_GALLERY"] = in_array($gal, ["photo", "anime", "gufeng", "custom"], true) ? $gal : "photo";
$fx["BG_CUSTOM_API"] = trim((string)($_POST["BG_CUSTOM_API"] ?? ""));
$fx["BG_BLUR"] = (($_POST["BG_BLUR"] ?? "no") === "yes") ? "yes" : "no";

@mkdir($assets_f, 0755, true);
@mkdir($assets_r, 0755, true);

$err = "";
if ($fx["BG_MODE"] === "local" && $fx["BG_LOCAL_SLOT"] === "1") {
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

if ($err === "" && $fx["BG_MODE"] === "local" && $fx["BG_LOCAL_SLOT"] === "2") {
    if (!ucwc_has("$assets_f/$f2") && !ucwc_has("$assets_r/$f2")) {
        $err = "本地壁纸2 不存在（assets/background-2.jpg）。";
    } else {
        if (ucwc_has("$assets_f/$f2") && !ucwc_has("$assets_r/$f2")) @copy("$assets_f/$f2", "$assets_r/$f2");
        ucwc_chmod_pub("$assets_f/$f2");
        ucwc_chmod_pub("$assets_r/$f2");
    }
}

if ($err === "" && $fx["BG_MODE"] === "local" && $fx["BG_LOCAL_SLOT"] === "custom") {
    $err = ucwc_handle_upload($_FILES["BG_UPLOAD"] ?? null, "$assets_f/$fc", "$assets_r/$fc");
    if ($err === "" && !ucwc_has("$assets_f/$fc") && !ucwc_has("$assets_r/$fc")) {
        $err = "请先选择并上传自定义本地壁纸（建议 ≤2MB 的 jpg/png/webp）。";
    }
}

if ($err === "" && $fx["BG_MODE"] === "dynamic") {
    $url = ucwc_gallery_url($fx["BG_GALLERY"], $fx["BG_CUSTOM_API"]);
    $err = ucwc_fetch_dynamic($url, "$assets_f/$fd", "$assets_r/$fd");
}

$saved = ucwc_fx_save($fx_path, $fx);
ucwc_log($log_path, "ajax-saved saved=" . ($saved ? "1" : "0") . " err=" . ($err === "" ? "-" : $err) . " " . json_encode($fx, JSON_UNESCAPED_UNICODE));

$ok = ($saved && $err === "");
ucwc_json([
    "ok" => $ok,
    "saved" => (bool)$saved,
    "error" => $err === "" ? null : $err,
    "message" => $ok
        ? "主题特效已应用并生效。"
        : ($saved ? ($err . "（配置已记录，但资源未就绪）") : "写入 theme-effects.cfg 失败。"),
    "fx" => $fx,
    "redirect" => "/Settings/ThemeEffects?applied=1",
], $ok ? 200 : ($saved ? 200 : 500));
