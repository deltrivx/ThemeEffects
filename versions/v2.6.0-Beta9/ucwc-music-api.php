<?php
/**
 * ThemeEffects music API (V1 local source)
 * JSON endpoints for library list + audio stream under configured MUSIC_LOCAL_DIR.
 */
header("X-Content-Type-Options: nosniff");

$persist = "/boot/config/plugins/theme.effects";
$fx_path = "$persist/theme-effects.cfg";
$log_path = "/tmp/ucwc-music-api.log";

function mlog($msg) {
    global $log_path;
    @file_put_contents($log_path, date("Y-m-d H:i:s") . " " . $msg . "\n", FILE_APPEND);
}

function mjson($data, $code = 200) {
    http_response_code($code);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function mcfg_load($path) {
    $d = [
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
    if (is_file($path)) {
        $raw = @parse_ini_file($path);
        if (is_array($raw)) {
            foreach ($d as $k => $v) {
                if (isset($raw[$k]) && $raw[$k] !== "") $d[$k] = (string)$raw[$k];
            }
        }
    }
    return $d;
}

function m_realpath_dir($dir) {
    $dir = trim((string)$dir);
    if ($dir === "") return "";
    // normalize slashes
    $dir = str_replace("\\", "/", $dir);
    $dir = rtrim($dir, "/");
    if ($dir === "" || $dir[0] !== "/") return "";
    // only allow common Unraid mount roots
    $okRoots = ["/mnt/", "/boot/config/plugins/theme.effects/"];
    $allowed = false;
    foreach ($okRoots as $r) {
        if (strpos($dir . "/", $r) === 0) { $allowed = true; break; }
    }
    if (!$allowed) return "";
    if (!is_dir($dir)) return "";
    $real = realpath($dir);
    if ($real === false || !is_dir($real)) return "";
    $real = str_replace("\\", "/", $real);
    foreach ($okRoots as $r) {
        if (strpos($real . "/", $r) === 0) return $real;
    }
    return "";
}

function m_ext_ok($name) {
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    return in_array($ext, ["mp3", "flac", "m4a", "aac", "ogg", "opus", "wav", "wma"], true);
}

function m_mime($path) {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $map = [
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "ogg" => "audio/ogg",
        "opus" => "audio/ogg",
        "wav" => "audio/wav",
        "wma" => "audio/x-ms-wma",
    ];
    return $map[$ext] ?? "application/octet-stream";
}

function m_rel_under($root, $file) {
    $root = rtrim(str_replace("\\", "/", $root), "/");
    $file = str_replace("\\", "/", $file);
    if (strpos($file, $root . "/") !== 0 && $file !== $root) return "";
    $rel = substr($file, strlen($root) + 1);
    $rel = str_replace("\\", "/", $rel);
    if ($rel === false || $rel === "" || strpos($rel, "..") !== false) return "";
    return $rel;
}

function m_abs_from_rel($root, $rel) {
    $root = rtrim(str_replace("\\", "/", $root), "/");
    $rel = str_replace("\\", "/", (string)$rel);
    $rel = ltrim($rel, "/");
    if ($rel === "" || strpos($rel, "..") !== false || strpos($rel, "\0") !== false) return "";
    $full = $root . "/" . $rel;
    $real = realpath($full);
    if ($real === false || !is_file($real)) return "";
    $real = str_replace("\\", "/", $real);
    if (strpos($real, $root . "/") !== 0) return "";
    return $real;
}

/**
 * Resolve sidecar LRC path for an audio absolute path.
 * Priority: same stem .lrc (case variants) → lyrics/ or Lyrics/ sibling dir.
 */
function m_find_lrc($audioAbs) {
    $audioAbs = str_replace("\\", "/", (string)$audioAbs);
    if ($audioAbs === "" || !is_file($audioAbs)) return "";
    $dir = str_replace("\\", "/", dirname($audioAbs));
    $stem = pathinfo($audioAbs, PATHINFO_FILENAME);
    if ($stem === "") return "";
    $cands = [
        $dir . "/" . $stem . ".lrc",
        $dir . "/" . $stem . ".LRC",
        $dir . "/lyrics/" . $stem . ".lrc",
        $dir . "/Lyrics/" . $stem . ".lrc",
        $dir . "/lyric/" . $stem . ".lrc",
    ];
    foreach ($cands as $p) {
        if (is_file($p)) {
            $real = realpath($p);
            if ($real !== false && is_file($real)) return str_replace("\\", "/", $real);
        }
    }
    // case-insensitive scan of same directory only (small dirs)
    if (is_dir($dir)) {
        $want = strtolower($stem) . ".lrc";
        $dh = @opendir($dir);
        if ($dh) {
            while (($name = readdir($dh)) !== false) {
                if ($name === "." || $name === "..") continue;
                if (strtolower($name) === $want && is_file($dir . "/" . $name)) {
                    closedir($dh);
                    $real = realpath($dir . "/" . $name);
                    return $real ? str_replace("\\", "/", $real) : ($dir . "/" . $name);
                }
            }
            closedir($dh);
        }
    }
    return "";
}

function m_has_lrc($audioAbs) {
    return m_find_lrc($audioAbs) !== "";
}

/** Simple HTTP GET (curl preferred). Returns [body|false, err, httpCode]. */
function m_http_get($url, $timeout = 10) {
    $url = trim((string)$url);
    if ($url === "" || !preg_match('#^https?://#i', $url)) return [false, "bad url", 0];
    if (function_exists("curl_init")) {
        $ch = curl_init($url);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => max(4, (int)$timeout),
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_USERAGENT => "ThemeEffects-Music/2.6",
            CURLOPT_HTTPHEADER => ["Accept: application/json"],
            CURLOPT_PROTOCOLS => defined("CURLPROTO_HTTPS") ? (CURLPROTO_HTTP | CURLPROTO_HTTPS) : 3,
            CURLOPT_IPRESOLVE => defined("CURL_IPRESOLVE_V4") ? CURL_IPRESOLVE_V4 : 1,
        ];
        curl_setopt_array($ch, $opts);
        $data = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($data === false || $data === "") return [false, $err !== "" ? $err : "empty", $code];
        if ($code >= 400) return [false, "HTTP $code", $code];
        return [$data, "", $code];
    }
    $ctx = stream_context_create([
        "http" => [
            "timeout" => max(4, (int)$timeout),
            "header" => "Accept: application/json\r\nUser-Agent: ThemeEffects-Music/2.6\r\n",
        ],
        "ssl" => ["verify_peer" => false, "verify_peer_name" => false],
    ]);
    $data = @file_get_contents($url, false, $ctx);
    if ($data === false || $data === "") return [false, "file_get_contents failed", 0];
    return [$data, "", 200];
}

/**
 * Guess title/artist from filename like "Artist - Title" or path parts.
 * @return array{0:string,1:string} [artist, title]
 */
function m_guess_meta($audioAbs, $rel = "") {
    $base = pathinfo($audioAbs, PATHINFO_FILENAME);
    $artist = "";
    $title = $base;
    if (preg_match('/^\s*(.+?)\s+[-–—]\s+(.+?)\s*$/u', $base, $m)) {
        $artist = trim($m[1]);
        $title = trim($m[2]);
    }
    $dir = str_replace("\\", "/", dirname($rel !== "" ? $rel : $audioAbs));
    if ($artist === "" && $dir !== "" && $dir !== ".") {
        $parts = explode("/", $dir);
        $parts = array_values(array_filter($parts, function ($p) {
            return $p !== "" && $p !== ".";
        }));
        if (count($parts) >= 2) $artist = $parts[count($parts) - 2];
        elseif (count($parts) === 1) $artist = $parts[0];
    }
    // strip track numbers
    $title = preg_replace('/^\s*\d{1,3}[\s._\-]+/u', "", $title);
    return [trim((string)$artist), trim((string)$title)];
}

/**
 * Fetch synced lyrics from lrclib.net and save next to audio as .lrc.
 * Returns [ok, lrcAbs|'', err, rawText]
 */
function m_fetch_and_save_lrc($audioAbs, $rel = "") {
    $audioAbs = str_replace("\\", "/", (string)$audioAbs);
    if ($audioAbs === "" || !is_file($audioAbs)) return [false, "", "no audio", ""];
    if (m_find_lrc($audioAbs) !== "") {
        return [true, m_find_lrc($audioAbs), "", ""];
    }
    [$artist, $title] = m_guess_meta($audioAbs, $rel);
    if ($title === "") return [false, "", "no title", ""];
    $q = [
        "track_name" => $title,
        "artist_name" => $artist !== "" ? $artist : "Unknown",
    ];
    // duration helps ranking when available (getid3 not required)
    $url = "https://lrclib.net/api/search?" . http_build_query($q, "", "&", PHP_QUERY_RFC3986);
    [$body, $err, $code] = m_http_get($url, 12);
    if ($body === false) {
        // fallback: title-only
        $url2 = "https://lrclib.net/api/search?" . http_build_query(["q" => $title], "", "&", PHP_QUERY_RFC3986);
        [$body, $err, $code] = m_http_get($url2, 12);
        if ($body === false) return [false, "", "歌词网络请求失败: $err", ""];
    }
    $json = json_decode($body, true);
    if (!is_array($json) || !count($json)) return [false, "", "未找到匹配歌词", ""];
    $best = null;
    foreach ($json as $row) {
        if (!is_array($row)) continue;
        $synced = trim((string)($row["syncedLyrics"] ?? ""));
        if ($synced === "") continue;
        $best = $row;
        break;
    }
    if ($best === null) {
        // plain lyrics as last resort (no timestamps) — skip save, not useful for scroll
        return [false, "", "仅有纯文本歌词（无时间轴）", ""];
    }
    $synced = trim((string)$best["syncedLyrics"]);
    // optional header enrichment
    $hdr = "";
    $ti = trim((string)($best["trackName"] ?? $title));
    $ar = trim((string)($best["artistName"] ?? $artist));
    $al = trim((string)($best["albumName"] ?? ""));
    if ($ti !== "") $hdr .= "[ti:{$ti}]\n";
    if ($ar !== "") $hdr .= "[ar:{$ar}]\n";
    if ($al !== "") $hdr .= "[al:{$al}]\n";
    $hdr .= "[by:ThemeEffects/lrclib]\n";
    $text = $hdr . $synced;
    if (substr($text, -1) !== "\n") $text .= "\n";
    $dir = str_replace("\\", "/", dirname($audioAbs));
    $stem = pathinfo($audioAbs, PATHINFO_FILENAME);
    $dst = $dir . "/" . $stem . ".lrc";
    // refuse path escape
    $dstRealDir = realpath($dir);
    if ($dstRealDir === false) return [false, "", "无法写入目录", ""];
    if (!is_writable($dir)) return [false, "", "音乐目录不可写，无法保存 .lrc", ""];
    $ok = @file_put_contents($dst, $text);
    if ($ok === false) return [false, "", "写入 .lrc 失败", ""];
    @chmod($dst, 0644);
    mlog("lrc-download ok title={$title} artist={$artist} dst={$dst} bytes=" . strlen($text));
    return [true, str_replace("\\", "/", $dst), "", $text];
}

/** Decode LRC bytes: UTF-8 / UTF-8 BOM / UTF-16 / GBK fallback. */
function m_lrc_decode($raw) {
    if ($raw === false || $raw === null || $raw === "") return "";
    if (substr($raw, 0, 3) === "\xEF\xBB\xBF") {
        return substr($raw, 3);
    }
    if (substr($raw, 0, 2) === "\xFF\xFE") {
        $s = @mb_convert_encoding($raw, "UTF-8", "UTF-16LE");
        return is_string($s) ? $s : "";
    }
    if (substr($raw, 0, 2) === "\xFE\xFF") {
        $s = @mb_convert_encoding($raw, "UTF-8", "UTF-16BE");
        return is_string($s) ? $s : "";
    }
    if (function_exists("mb_check_encoding") && mb_check_encoding($raw, "UTF-8")) {
        return $raw;
    }
    if (function_exists("mb_convert_encoding")) {
        $try = @mb_convert_encoding($raw, "UTF-8", "GB18030,GBK,GB2312,Big5,UTF-8");
        if (is_string($try) && $try !== "") return $try;
    }
    return $raw;
}

/**
 * Parse standard LRC text → [offset_ms, meta{}, lines[{t,text}]].
 */
function m_parse_lrc($text) {
    $offset = 0;
    $meta = [];
    $lines = [];
    $text = str_replace(["\r\n", "\r"], "\n", (string)$text);
    foreach (explode("\n", $text) as $row) {
        $row = trim($row);
        if ($row === "") continue;
        if (preg_match('/^\[(ti|ar|al|by|offset|re|ve|length):\s*([^\]]*)\]$/iu', $row, $mm)) {
            $key = strtolower($mm[1]);
            $val = trim($mm[2]);
            if ($key === "offset") {
                $offset = intval($val);
            } else {
                $meta[$key] = $val;
            }
            continue;
        }
        // One or more timestamps then text: [mm:ss.xx][mm:ss.xx]text
        if (!preg_match_all('/\[(\d{1,3}):(\d{1,2})(?:[\.:](\d{1,3}))?\]/', $row, $ts, PREG_SET_ORDER)) {
            continue;
        }
        $textPart = $row;
        foreach ($ts as $tmatch) {
            $textPart = str_replace($tmatch[0], "", $textPart);
        }
        $textPart = trim($textPart);
        // skip pure meta-looking leftovers
        if ($textPart === "" && count($ts) === 1) {
            // allow empty lines as beat markers? skip empty text
            continue;
        }
        if ($textPart === "") continue;
        foreach ($ts as $tmatch) {
            $m = intval($tmatch[1]);
            $s = intval($tmatch[2]);
            $frac = isset($tmatch[3]) ? $tmatch[3] : "0";
            if (strlen($frac) === 1) $fracMs = intval($frac) * 100;
            elseif (strlen($frac) === 2) $fracMs = intval($frac) * 10;
            else $fracMs = intval(substr($frac, 0, 3));
            $tMs = $m * 60000 + $s * 1000 + $fracMs;
            $lines[] = ["t" => $tMs, "text" => $textPart];
        }
    }
    usort($lines, function ($a, $b) {
        if ($a["t"] === $b["t"]) return 0;
        return ($a["t"] < $b["t"]) ? -1 : 1;
    });
    return [$offset, $meta, $lines];
}

function m_scan($root, $max = 800) {
    $out = [];
    $root = rtrim($root, "/");
    try {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS | FilesystemIterator::FOLLOW_SYMLINKS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        $it->setMaxDepth(6);
        foreach ($it as $file) {
            if (count($out) >= $max) break;
            if (!$file->isFile()) continue;
            $path = $file->getPathname();
            $base = $file->getFilename();
            if ($base === "" || $base[0] === ".") continue;
            if (!m_ext_ok($base)) continue;
            $rel = m_rel_under($root, str_replace("\\", "/", $path));
            if ($rel === "") continue;
            $title = pathinfo($base, PATHINFO_FILENAME);
            $dirRel = str_replace("\\", "/", dirname($rel));
            if ($dirRel === ".") $dirRel = "";
            $album = $dirRel !== "" ? basename($dirRel) : "";
            $artist = "";
            if ($dirRel !== "") {
                $parts = explode("/", $dirRel);
                if (count($parts) >= 2) $artist = $parts[count($parts) - 2];
                elseif (count($parts) === 1 && $parts[0] !== "") $artist = $parts[0];
            }
            $absNorm = str_replace("\\", "/", $path);
            $out[] = [
                "id" => $rel,
                "title" => $title,
                "artist" => $artist,
                "album" => $album,
                "ext" => strtolower(pathinfo($base, PATHINFO_EXTENSION)),
                "size" => (int)$file->getSize(),
                "has_lrc" => m_has_lrc($absNorm),
            ];
        }
    } catch (Throwable $e) {
        mlog("scan error: " . $e->getMessage());
        return [null, $e->getMessage()];
    }
    usort($out, function ($a, $b) {
        $ka = strtolower(($a["artist"] ?? "") . "\0" . ($a["album"] ?? "") . "\0" . ($a["title"] ?? ""));
        $kb = strtolower(($b["artist"] ?? "") . "\0" . ($b["album"] ?? "") . "\0" . ($b["title"] ?? ""));
        return $ka <=> $kb;
    });
    return [$out, ""];
}

function m_stream($abs) {
    $size = filesize($abs);
    if ($size === false) {
        http_response_code(404);
        exit;
    }
    $mime = m_mime($abs);
    $start = 0;
    $end = $size - 1;
    $status = 200;
    if (isset($_SERVER["HTTP_RANGE"]) && preg_match('/bytes=(\d*)-(\d*)/', $_SERVER["HTTP_RANGE"], $m)) {
        if ($m[1] !== "") $start = (int)$m[1];
        if ($m[2] !== "") $end = (int)$m[2];
        if ($end >= $size) $end = $size - 1;
        if ($start > $end || $start < 0) {
            http_response_code(416);
            header("Content-Range: bytes */$size");
            exit;
        }
        $status = 206;
    }
    $length = $end - $start + 1;
    http_response_code($status);
    header("Content-Type: $mime");
    header("Accept-Ranges: bytes");
    header("Content-Length: $length");
    if ($status === 206) header("Content-Range: bytes $start-$end/$size");
    header("Cache-Control: private, max-age=3600");
    header("X-Content-Type-Options: nosniff");
    // free session if any
    if (function_exists("session_status") && session_status() === PHP_SESSION_ACTIVE) {
        @session_write_close();
    }
    $fp = @fopen($abs, "rb");
    if (!$fp) {
        http_response_code(500);
        exit;
    }
    if ($start > 0) fseek($fp, $start);
    $remaining = $length;
    while ($remaining > 0 && !feof($fp)) {
        $chunk = ($remaining > 81920) ? 81920 : $remaining;
        $data = fread($fp, $chunk);
        if ($data === false || $data === "") break;
        echo $data;
        $remaining -= strlen($data);
        if (connection_aborted()) break;
    }
    fclose($fp);
    exit;
}

// --- main ---
if (function_exists("session_status") && session_status() === PHP_SESSION_ACTIVE) {
    @session_write_close();
}

$cfg = mcfg_load($fx_path);
$action = strtolower(trim((string)($_GET["action"] ?? $_POST["action"] ?? "")));

if ($action === "config") {
    $root = m_realpath_dir($cfg["MUSIC_LOCAL_DIR"] ?? "");
    mjson([
        "ok" => true,
        "enable" => (($cfg["MUSIC_ENABLE"] ?? "no") === "yes"),
        "ui" => $cfg["MUSIC_UI"] ?? "card",
        "source" => $cfg["MUSIC_SOURCE"] ?? "local",
        "local_dir" => $cfg["MUSIC_LOCAL_DIR"] ?? "",
        "local_dir_ok" => $root !== "",
        "volume" => intval($cfg["MUSIC_VOLUME"] ?? 70),
        "autoplay" => (($cfg["MUSIC_AUTOPLAY"] ?? "no") === "yes"),
        "shuffle" => (($cfg["MUSIC_SHUFFLE"] ?? "no") === "yes"),
        "repeat" => in_array(($cfg["MUSIC_REPEAT"] ?? "off"), ["off", "one", "all"], true) ? $cfg["MUSIC_REPEAT"] : "off",
        "dash_only" => (($cfg["MUSIC_DASH_ONLY"] ?? "yes") !== "no"),
    ]);
}

if ($action === "list") {
    if (($cfg["MUSIC_ENABLE"] ?? "no") !== "yes") {
        mjson(["ok" => false, "error" => "音乐组件未开启", "tracks" => []], 400);
    }
    if (($cfg["MUSIC_SOURCE"] ?? "local") !== "local") {
        mjson(["ok" => false, "error" => "当前仅支持本地音源（V1）", "tracks" => []], 400);
    }
    $root = m_realpath_dir($cfg["MUSIC_LOCAL_DIR"] ?? "");
    if ($root === "") {
        mjson([
            "ok" => false,
            "error" => "本地音乐目录无效或不可访问。请在「主题特效 → 音乐」中设置如 /mnt/user/Music",
            "tracks" => [],
            "dir" => $cfg["MUSIC_LOCAL_DIR"] ?? "",
        ], 400);
    }
    [$tracks, $err] = m_scan($root);
    if ($tracks === null) {
        mjson(["ok" => false, "error" => "扫描失败：$err", "tracks" => []], 500);
    }
    mjson([
        "ok" => true,
        "dir" => $root,
        "count" => count($tracks),
        "tracks" => $tracks,
        "truncated" => true,
    ]);
}

if ($action === "stream") {
    if (($cfg["MUSIC_ENABLE"] ?? "no") !== "yes") {
        http_response_code(403);
        header("Content-Type: text/plain; charset=utf-8");
        echo "music disabled";
        exit;
    }
    $root = m_realpath_dir($cfg["MUSIC_LOCAL_DIR"] ?? "");
    if ($root === "") {
        http_response_code(400);
        header("Content-Type: text/plain; charset=utf-8");
        echo "bad music dir";
        exit;
    }
    $rel = (string)($_GET["id"] ?? $_GET["path"] ?? "");
    $abs = m_abs_from_rel($root, $rel);
    if ($abs === "" || !m_ext_ok($abs)) {
        http_response_code(404);
        header("Content-Type: text/plain; charset=utf-8");
        echo "not found";
        exit;
    }
    m_stream($abs);
}

if ($action === "lyrics") {
    if (($cfg["MUSIC_ENABLE"] ?? "no") !== "yes") {
        mjson(["ok" => false, "error" => "音乐组件未开启", "lines" => []], 400);
    }
    $root = m_realpath_dir($cfg["MUSIC_LOCAL_DIR"] ?? "");
    if ($root === "") {
        mjson(["ok" => false, "error" => "本地音乐目录无效", "lines" => []], 400);
    }
    $rel = (string)($_GET["id"] ?? $_GET["path"] ?? "");
    $abs = m_abs_from_rel($root, $rel);
    if ($abs === "" || !m_ext_ok($abs)) {
        mjson(["ok" => false, "error" => "曲目不存在", "lines" => []], 404);
    }
    $doFetch = isset($_GET["fetch"]) && !in_array(strtolower((string)$_GET["fetch"]), ["0", "no", "false", "off"], true);
    $source = "sidecar";
    $lrcAbs = m_find_lrc($abs);
    // Auto-download to same folder when missing and fetch requested
    if ($lrcAbs === "" && $doFetch) {
        [$okDl, $dlPath, $dlErr, $dlText] = m_fetch_and_save_lrc($abs, $rel);
        if ($okDl && $dlPath !== "") {
            $lrcAbs = $dlPath;
            $source = "downloaded";
        } elseif ($dlText !== "") {
            // in-memory only (should not happen if write ok)
            $text = m_lrc_decode($dlText);
            [$offset, $meta, $lines] = m_parse_lrc($text);
            mjson([
                "ok" => true,
                "id" => $rel,
                "source" => "downloaded-memory",
                "offset_ms" => $offset,
                "meta" => $meta ?: new stdClass(),
                "lines" => $lines,
                "empty" => count($lines) === 0,
                "download_error" => $dlErr,
            ]);
        } else {
            mjson([
                "ok" => true,
                "id" => $rel,
                "source" => "none",
                "offset_ms" => 0,
                "meta" => new stdClass(),
                "lines" => [],
                "empty" => true,
                "download_error" => $dlErr !== "" ? $dlErr : "未找到歌词",
            ]);
        }
    }
    if ($lrcAbs === "") {
        mjson([
            "ok" => true,
            "id" => $rel,
            "source" => "none",
            "offset_ms" => 0,
            "meta" => new stdClass(),
            "lines" => [],
            "empty" => true,
        ]);
    }
    $lrcReal = str_replace("\\", "/", $lrcAbs);
    $rootSlash = rtrim($root, "/") . "/";
    if (strpos($lrcReal, $rootSlash) !== 0) {
        // also accept realpath form
        $lrcRp = realpath($lrcAbs);
        $rootRp = realpath($root);
        if ($lrcRp === false || $rootRp === false || strpos(str_replace("\\", "/", $lrcRp), rtrim(str_replace("\\", "/", $rootRp), "/") . "/") !== 0) {
            mjson(["ok" => false, "error" => "歌词路径越权", "lines" => []], 403);
        }
        $lrcAbs = str_replace("\\", "/", $lrcRp);
    }
    $size = @filesize($lrcAbs);
    if ($size === false || $size <= 0) {
        mjson([
            "ok" => true,
            "id" => $rel,
            "source" => $source,
            "offset_ms" => 0,
            "meta" => new stdClass(),
            "lines" => [],
            "empty" => true,
        ]);
    }
    if ($size > 512 * 1024) {
        mjson(["ok" => false, "error" => "LRC 过大（>512KB）", "lines" => []], 400);
    }
    $raw = @file_get_contents($lrcAbs);
    if ($raw === false) {
        mjson(["ok" => false, "error" => "无法读取 LRC", "lines" => []], 500);
    }
    $text = m_lrc_decode($raw);
    [$offset, $meta, $lines] = m_parse_lrc($text);
    mjson([
        "ok" => true,
        "id" => $rel,
        "source" => $source,
        "offset_ms" => $offset,
        "meta" => $meta ?: new stdClass(),
        "lines" => $lines,
        "empty" => count($lines) === 0,
        "lrc_name" => basename($lrcAbs),
    ]);
}

mjson(["ok" => false, "error" => "unknown action"], 400);
