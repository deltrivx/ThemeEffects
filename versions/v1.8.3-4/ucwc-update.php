<?php
/**
 * unraid-custom-webui-css: 版本管理 API
 * 供主题特效页调用；仅输出 JSON。安装逻辑复用官方 install.sh。
 */
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

/* Release session lock early: long GitHub fetches must not block auth-request */
if (function_exists("session_status") && session_status() === PHP_SESSION_ACTIVE) {
    @session_write_close();
} elseif (function_exists("session_write_close")) {
    @session_write_close();
}

$persist_dir = "/boot/config/plugins/custom.css";
$upd_log = "/tmp/ucwc-theme-update.log";
$repo_raw = "https://raw.githubusercontent.com/deltrivx/unraid-custom-webui-css/main";

function ucwc_log($path, $line) {
    @file_put_contents($path, date("c") . " " . $line . "\n", FILE_APPEND);
}

function ucwc_kv_file($path) {
    $out = [];
    if (!is_file($path)) return $out;
    $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) return $out;
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === "" || $line[0] === "#" || strpos($line, "=") === false) continue;
        [$k, $v] = explode("=", $line, 2);
        $out[trim($k)] = trim($v, " \t\"'");
    }
    return $out;
}

function ucwc_local_status($persist_dir) {
    $opts = ucwc_kv_file("$persist_dir/unraid-custom-webui-css.options");
    if (!$opts) $opts = ucwc_kv_file("$persist_dir/unraid-custom-webui-css.state");
    $installed = is_file("$persist_dir/style.css");
    $version = $opts["version"] ?? "";
    if ($version === "" && $installed) $version = "unknown";
    return [
        "installed" => $installed,
        "version" => $version,
        "updated_at" => $opts["updated_at"] ?? "",
        "particles" => $opts["particles"] ?? "",
        "hutao" => $opts["hutao"] ?? "",
        "theme_effects" => $opts["theme_effects"] ?? "",
        "source" => $opts["source"] ?? "",
    ];
}

function ucwc_outgoing_proxy() {
    // Unraid Outgoing Proxy Manager → /var/local/emhttp/proxy.ini（web/php 由 local_prepend putenv）
    static $cached = null;
    if ($cached !== null) return $cached;
    $cached = "";
    $ini_paths = [
        "/var/local/emhttp/proxy.ini",
        "/usr/local/emhttp/state/proxy.ini",
        "/usr/local/emhttp/proxy.ini",
    ];
    foreach ($ini_paths as $p) {
        if (!is_file($p)) continue;
        $cfg = @parse_ini_file($p, true);
        if (!is_array($cfg)) $cfg = @parse_ini_file($p, false);
        if (!is_array($cfg)) continue;
        // flat or sectioned
        $https = $cfg["https_proxy"] ?? ($cfg["proxy"]["https_proxy"] ?? "");
        $http = $cfg["http_proxy"] ?? ($cfg["proxy"]["http_proxy"] ?? "");
        $url = trim((string)($https !== "" ? $https : $http));
        if ($url !== "") {
            $cached = $url;
            break;
        }
    }
    if ($cached === "") {
        $env = getenv("https_proxy") ?: getenv("HTTPS_PROXY") ?: getenv("http_proxy") ?: getenv("HTTP_PROXY");
        if (is_string($env) && trim($env) !== "") $cached = trim($env);
    }
    // 回退：直接读 Outgoing Proxy 配置（active 槽位）
    if ($cached === "" && is_file("/boot/config/plugins/dynamix/outgoingproxy.cfg")) {
        $op = @parse_ini_file("/boot/config/plugins/dynamix/outgoingproxy.cfg");
        if (is_array($op) && !empty($op["proxy_active"])) {
            $i = (string)$op["proxy_active"];
            $u = trim((string)($op["proxy_url_$i"] ?? ""));
            if ($u !== "") $cached = $u;
        }
    }
    return $cached;
}

function ucwc_http_get($url, $timeout = 12) {
    if (!function_exists("curl_init")) return [false, "服务器缺少 curl 扩展。", 0];
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => max(5, (int)$timeout),
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_USERAGENT => "UCWC-ThemeEffects/1.8",
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        // Prefer IPv4: raw.githubusercontent.com AAAA often hangs on some Unraid nets
        CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
    ];
    // PHP curl 不会自动吃 http_proxy 环境变量，必须显式 CURLOPT_PROXY
    $proxy = ucwc_outgoing_proxy();
    if ($proxy !== "") {
        $opts[CURLOPT_PROXY] = $proxy;
        $opts[CURLOPT_HTTPPROXYTUNNEL] = true;
        $opts[CURLOPT_PROXYTYPE] = CURLPROXY_HTTP;
    }
    curl_setopt_array($ch, $opts);
    $data = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($data === false || $data === "") {
        $hint = $proxy !== "" ? "" : "（未检测到出站代理）";
        return [false, ($err !== "" ? $err : "空响应") . $hint, $code];
    }
    if ($code >= 400) return [false, "HTTP $code", $code];
    return [$data, "", $code];
}

function ucwc_fetch_index($repo_raw) {
    [$data, $err] = ucwc_http_get("$repo_raw/versions/index.json", 12);
    if ($data === false) return [null, "拉取版本索引失败：$err"];
    $json = json_decode($data, true);
    if (!is_array($json) || !isset($json["versions"]) || !is_array($json["versions"])) {
        return [null, "版本索引格式无效。"];
    }
    return [$json, ""];
}

function ucwc_fetch_changelog($repo_raw) {
    [$data, $err] = ucwc_http_get("$repo_raw/CHANGELOG.md", 12);
    if ($data === false) return ["", "拉取更新日志失败：$err"];
    return [$data, ""];
}

function ucwc_changelog_section($md, $version) {
    if ($md === "" || $version === "") return "";
    $ver = preg_quote($version, "/");
    if (!preg_match("/^##\\s+" . $ver . "\\b[^\\n]*\\n([\\s\\S]*?)(?=^##\\s+v|\\z)/m", $md, $m)) {
        return "";
    }
    return trim($m[0]);
}

function ucwc_normalize_version_flags($v) {
    return [
        "id" => (string)($v["id"] ?? ""),
        "label" => (string)($v["label"] ?? ""),
        "channel" => (string)($v["channel"] ?? "history"),
        "released_at" => (string)($v["released_at"] ?? ""),
        "apps_enhancement" => !empty($v["apps_enhancement"]),
        "particles" => !empty($v["particles"]),
        "hutao" => !empty($v["hutao"]),
        "theme_effects" => !empty($v["theme_effects"]),
    ];
}

function ucwc_valid_version_id($id) {
    // Allow patch tags like v1.8.3-2
    return is_string($id) && preg_match('/^v[0-9]+\.[0-9]+(\.[0-9]+)?(-[0-9A-Za-z.]+)?$/', $id);
}

function ucwc_job_dir() {
    $d = "/tmp/ucwc-jobs";
    if (!is_dir($d)) @mkdir($d, 0755, true);
    return $d;
}

function ucwc_job_paths($job) {
    $base = ucwc_job_dir() . "/" . $job;
    return [
        "meta" => $base . ".json",
        "log" => $base . ".log",
        "pid" => $base . ".pid",
    ];
}

function ucwc_job_write_meta($job, $meta) {
    $paths = ucwc_job_paths($job);
    $meta["updated_at"] = date("c");
    @file_put_contents($paths["meta"], json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    @chmod($paths["meta"], 0644);
}

function ucwc_job_read_meta($job) {
    $paths = ucwc_job_paths($job);
    if (!is_file($paths["meta"])) return null;
    $raw = @file_get_contents($paths["meta"]);
    $j = json_decode((string)$raw, true);
    return is_array($j) ? $j : null;
}

function ucwc_job_append($job, $line) {
    $paths = ucwc_job_paths($job);
    @file_put_contents($paths["log"], rtrim((string)$line, "\r\n") . "\n", FILE_APPEND);
}

function ucwc_classify_progress($line) {
    $s = (string)$line;
    if ($s === "") return null;
    if (preg_match('/正在安装|开始安装|installing/i', $s)) return ["pct" => 8, "stage" => "准备安装"];
    if (preg_match('/下载|download|curl|Fetching|拉取/i', $s)) return ["pct" => 25, "stage" => "下载文件"];
    if (preg_match('/ThemeEffects|CustomCSS_Loader|ucwc-theme-fx|ucwc-update/i', $s)) return ["pct" => 45, "stage" => "部署主题特效"];
    if (preg_match('/style\.css|style-black|background|hutao|particles|apps-enhancement/i', $s)) return ["pct" => 60, "stage" => "写入主题文件"];
    if (preg_match('/显示|Dynamix|header|color theme/i', $s)) return ["pct" => 78, "stage" => "应用显示设置"];
    if (preg_match('/已安装|完成|success|finished|卸载完成|已卸载/i', $s)) return ["pct" => 95, "stage" => "收尾"];
    if (preg_match('/警告|warn/i', $s)) return ["pct" => null, "stage" => "注意"];
    if (preg_match('/失败|error|fatal/i', $s)) return ["pct" => null, "stage" => "错误"];
    return ["pct" => null, "stage" => null];
}

function ucwc_prepare_install($repo_raw, $upd_log, $mode, $version = "") {
    @ini_set("max_execution_time", "300");
    @set_time_limit(300);
    if (!function_exists("curl_init")) return [false, "服务器缺少 curl 扩展。", "", false, ""];
    if ($mode === "install_version") {
        if (!ucwc_valid_version_id($version)) return [false, "版本号格式无效。", "", false, ""];
    } elseif ($mode !== "install_latest" && $mode !== "uninstall") {
        return [false, "未知安装动作。", "", false, ""];
    }

    $has_fx = false;
    if ($mode === "install_version" || $mode === "install_latest") {
        [$index, $ierr] = ucwc_fetch_index($repo_raw);
        if ($index === null) return [false, $ierr, "", false, ""];
        $latest = (string)($index["latest_version"] ?? "");
        if ($mode === "install_latest") {
            $version = $latest;
            if (!ucwc_valid_version_id($version)) return [false, "远程 latest_version 无效。", "", false, ""];
        }
        $found = false;
        foreach ($index["versions"] as $v) {
            if (($v["id"] ?? "") === $version) {
                $found = true;
                $has_fx = !empty($v["theme_effects"]);
                break;
            }
        }
        if (!$found) return [false, "未知版本：$version", "", false, ""];
    } else {
        $version = "";
    }

    $script = "/tmp/ucwc-install-web.sh";
    [$body, $err] = ucwc_http_get("$repo_raw/scripts/install.sh", 60);
    if ($body === false) return [false, "下载 install.sh 失败：$err", $version, $has_fx, ""];
    if (@file_put_contents($script, $body) === false) return [false, "写入临时脚本失败。", $version, $has_fx, ""];
    @chmod($script, 0755);

    $proxy = ucwc_outgoing_proxy();
    $env_prefix = "";
    if ($proxy !== "") {
        $env_prefix = "http_proxy=" . escapeshellarg($proxy)
            . " https_proxy=" . escapeshellarg($proxy)
            . " HTTP_PROXY=" . escapeshellarg($proxy)
            . " HTTPS_PROXY=" . escapeshellarg($proxy)
            . " no_proxy=" . escapeshellarg("127.0.0.1,localhost")
            . " ";
        @putenv("http_proxy=$proxy");
        @putenv("https_proxy=$proxy");
        @putenv("HTTP_PROXY=$proxy");
        @putenv("HTTPS_PROXY=$proxy");
    }

    if ($mode === "uninstall") {
        $cmd = $env_prefix . "sh " . escapeshellarg($script) . " uninstall 2>&1";
    } else {
        $cmd = $env_prefix . "sh " . escapeshellarg($script) . " install " . escapeshellarg($version) . " 2>&1";
    }
    ucwc_log($upd_log, "prepare mode=$mode version=" . ($version !== "" ? $version : "-") . " proxy=" . ($proxy !== "" ? $proxy : "-") . " cmd=$cmd");
    return [true, "", $version, $has_fx, $cmd];
}

/**
 * Start install/uninstall job immediately (no network in web request).
 * Background CLI PHP does prepare + install so php-fpm is free for job_status / auth.
 */
function ucwc_start_job($mode, $version, $repo_raw, $upd_log) {
    $job = "j" . date("YmdHis") . substr(bin2hex(random_bytes(4)), 0, 8);
    $paths = ucwc_job_paths($job);
    @file_put_contents($paths["log"], "");
    $label = ($mode === "uninstall")
        ? "卸载主题"
        : ("安装 " . ($version !== "" ? $version : "最新版"));
    $meta = [
        "id" => $job,
        "action" => $mode,
        "version" => $version,
        "theme_effects" => true,
        "status" => "running",
        "pct" => 4,
        "stage" => "任务已排队",
        "message" => "后台准备中…",
        "exit_code" => null,
        "created_at" => date("c"),
        "updated_at" => date("c"),
        "done" => false,
        "ok" => null,
        "log_bytes" => 0,
    ];
    ucwc_job_write_meta($job, $meta);
    ucwc_job_append($job, "[" . date("H:i:s") . "] 任务已创建：" . $label);

    $meta_php = var_export($paths["meta"], true);
    $log_php = var_export($paths["log"], true);
    $pid_php = var_export($paths["pid"], true);
    $job_php = var_export($job, true);
    $upd_php = var_export($upd_log, true);
    $mode_php = var_export($mode, true);
    $ver_php = var_export($version, true);
    $repo_php = var_export($repo_raw, true);
    // Self-contained runner: prepare (GitHub) + install outside php-fpm
    $php = <<<'PHP'
<?php
@ini_set("max_execution_time", "600");
@set_time_limit(600);
$job = __JOB__;
$metaPath = __META__;
$logPath = __LOG__;
$pidPath = __PID__;
$updLog = __UPD__;
$mode = __MODE__;
$version = __VER__;
$repoRaw = __REPO__;
@file_put_contents($pidPath, (string)getmypid());

function meta_write($path, $data) {
  $data["updated_at"] = date("c");
  $data["log_bytes"] = isset($data["log_bytes"]) ? $data["log_bytes"] : 0;
  @file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
}
function append_log($path, $line) {
  @file_put_contents($path, rtrim($line, "\r\n") . "\n", FILE_APPEND);
}
function fail_job($metaPath, $logPath, $meta, $msg) {
  $meta["status"] = "error";
  $meta["done"] = true;
  $meta["ok"] = false;
  $meta["pct"] = 100;
  $meta["stage"] = "失败";
  $meta["message"] = $msg;
  $meta["exit_code"] = 1;
  $meta["log_bytes"] = @filesize($logPath) ?: 0;
  meta_write($metaPath, $meta);
  append_log($logPath, "[" . date("H:i:s") . "] 错误：" . $msg);
  exit(1);
}
function classify($line) {
  $s = (string)$line;
  if (preg_match('/正在安装|开始安装|installing/i', $s)) return [12, "准备安装"];
  if (preg_match('/下载|download|curl|Fetching|拉取/i', $s)) return [28, "下载文件"];
  if (preg_match('/ThemeEffects|CustomCSS_Loader|ucwc-theme-fx|ucwc-update/i', $s)) return [48, "部署主题特效"];
  if (preg_match('/style\.css|style-black|background|hutao|particles|apps-enhancement/i', $s)) return [65, "写入主题文件"];
  if (preg_match('/显示|Dynamix|header|color theme/i', $s)) return [82, "应用显示设置"];
  if (preg_match('/已安装|完成|success|finished|卸载完成|已卸载/i', $s)) return [95, "收尾"];
  return [null, null];
}
function detect_proxy() {
  foreach (["/var/local/emhttp/proxy.ini", "/usr/local/emhttp/state/proxy.ini", "/usr/local/emhttp/proxy.ini"] as $p) {
    if (!is_file($p)) continue;
    $cfg = @parse_ini_file($p, true);
    if (!is_array($cfg)) $cfg = @parse_ini_file($p, false);
    if (!is_array($cfg)) continue;
    $https = $cfg["https_proxy"] ?? ($cfg["proxy"]["https_proxy"] ?? "");
    $http = $cfg["http_proxy"] ?? ($cfg["proxy"]["http_proxy"] ?? "");
    $url = trim((string)($https !== "" ? $https : $http));
    if ($url !== "") return $url;
  }
  if (is_file("/boot/config/plugins/dynamix/outgoingproxy.cfg")) {
    $op = @parse_ini_file("/boot/config/plugins/dynamix/outgoingproxy.cfg");
    if (is_array($op) && !empty($op["proxy_active"])) {
      $i = (string)$op["proxy_active"];
      $u = trim((string)($op["proxy_url_$i"] ?? ""));
      if ($u !== "") return $u;
    }
  }
  $env = getenv("https_proxy") ?: getenv("HTTPS_PROXY") ?: getenv("http_proxy") ?: getenv("HTTP_PROXY");
  return is_string($env) ? trim($env) : "";
}
function http_get($url, $timeout, $proxy) {
  if (!function_exists("curl_init")) return [false, "缺少 curl 扩展"];
  $ch = curl_init($url);
  $opts = [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 5,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => max(8, (int)$timeout),
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
    CURLOPT_USERAGENT => "UCWC-JobRunner/1.8",
    CURLOPT_IPRESOLVE => defined("CURL_IPRESOLVE_V4") ? CURL_IPRESOLVE_V4 : 1,
  ];
  if ($proxy !== "") {
    $opts[CURLOPT_PROXY] = $proxy;
    $opts[CURLOPT_HTTPPROXYTUNNEL] = true;
    $opts[CURLOPT_PROXYTYPE] = CURLPROXY_HTTP;
  }
  curl_setopt_array($ch, $opts);
  $data = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = curl_error($ch);
  curl_close($ch);
  if ($data === false || $data === "") return [false, $err !== "" ? $err : "空响应"];
  if ($code >= 400) return [false, "HTTP $code"];
  return [$data, ""];
}

$meta = [
  "id" => $job,
  "action" => $mode,
  "version" => $version,
  "theme_effects" => true,
  "status" => "running",
  "pct" => 6,
  "stage" => "准备中",
  "message" => "检测网络与版本…",
  "exit_code" => null,
  "created_at" => date("c"),
  "updated_at" => date("c"),
  "done" => false,
  "ok" => null,
  "log_bytes" => 0,
];
meta_write($metaPath, $meta);
append_log($logPath, "[" . date("H:i:s") . "] 后台任务开始（CLI，不占用 Web 进程）");
@file_put_contents($updLog, date("c") . " job=$job start\n", FILE_APPEND);

$proxy = detect_proxy();
append_log($logPath, "[" . date("H:i:s") . "] 出站代理：" . ($proxy !== "" ? $proxy : "无"));
$hasFx = true;

if ($mode === "install_version" || $mode === "install_latest") {
  $meta["pct"] = 8;
  $meta["stage"] = "拉取版本索引";
  $meta["message"] = "正在获取 versions/index.json…";
  meta_write($metaPath, $meta);
  append_log($logPath, "[" . date("H:i:s") . "] 拉取版本索引…");
  [$idxBody, $idxErr] = http_get($repoRaw . "/versions/index.json", 25, $proxy);
  if ($idxBody === false) fail_job($metaPath, $logPath, $meta, "拉取版本索引失败：$idxErr");
  $index = json_decode($idxBody, true);
  if (!is_array($index) || empty($index["versions"]) || !is_array($index["versions"])) {
    fail_job($metaPath, $logPath, $meta, "版本索引格式无效。");
  }
  $latest = (string)($index["latest_version"] ?? "");
  if ($mode === "install_latest") {
    $version = $latest;
  }
  if (!is_string($version) || !preg_match('/^v[0-9]+\.[0-9]+(\.[0-9]+)?(-[0-9A-Za-z.]+)?$/', $version)) {
    fail_job($metaPath, $logPath, $meta, "版本号无效：" . $version);
  }
  $found = false;
  $hasFx = false;
  foreach ($index["versions"] as $v) {
    if (($v["id"] ?? "") === $version) {
      $found = true;
      $hasFx = !empty($v["theme_effects"]);
      break;
    }
  }
  if (!$found) fail_job($metaPath, $logPath, $meta, "未知版本：$version");
  $meta["version"] = $version;
  $meta["theme_effects"] = $hasFx;
  $meta["pct"] = 14;
  $meta["stage"] = "下载安装脚本";
  $meta["message"] = "正在下载 install.sh…";
  meta_write($metaPath, $meta);
  append_log($logPath, "[" . date("H:i:s") . "] 目标版本：$version");
  append_log($logPath, "[" . date("H:i:s") . "] 下载 install.sh…");
  [$shBody, $shErr] = http_get($repoRaw . "/scripts/install.sh", 60, $proxy);
  if ($shBody === false) fail_job($metaPath, $logPath, $meta, "下载 install.sh 失败：$shErr");
  $script = "/tmp/ucwc-install-web.sh";
  if (@file_put_contents($script, $shBody) === false) fail_job($metaPath, $logPath, $meta, "写入临时脚本失败。");
  @chmod($script, 0755);
} else {
  $meta["pct"] = 14;
  $meta["stage"] = "下载安装脚本";
  $meta["message"] = "正在下载 install.sh（卸载）…";
  meta_write($metaPath, $meta);
  append_log($logPath, "[" . date("H:i:s") . "] 下载 install.sh（卸载）…");
  [$shBody, $shErr] = http_get($repoRaw . "/scripts/install.sh", 60, $proxy);
  if ($shBody === false) fail_job($metaPath, $logPath, $meta, "下载 install.sh 失败：$shErr");
  $script = "/tmp/ucwc-install-web.sh";
  if (@file_put_contents($script, $shBody) === false) fail_job($metaPath, $logPath, $meta, "写入临时脚本失败。");
  @chmod($script, 0755);
  $version = "";
  $hasFx = true;
}

$env_prefix = "";
if ($proxy !== "") {
  $env_prefix = "http_proxy=" . escapeshellarg($proxy)
    . " https_proxy=" . escapeshellarg($proxy)
    . " HTTP_PROXY=" . escapeshellarg($proxy)
    . " HTTPS_PROXY=" . escapeshellarg($proxy)
    . " no_proxy=" . escapeshellarg("127.0.0.1,localhost")
    . " ";
  @putenv("http_proxy=$proxy");
  @putenv("https_proxy=$proxy");
}
if ($mode === "uninstall") {
  $cmd = $env_prefix . "sh " . escapeshellarg($script) . " uninstall 2>&1";
} else {
  $cmd = $env_prefix . "sh " . escapeshellarg($script) . " install " . escapeshellarg($version) . " 2>&1";
}

$meta["pct"] = 18;
$meta["stage"] = "执行安装脚本";
$meta["message"] = "正在执行…";
$meta["theme_effects"] = $hasFx;
$meta["version"] = $version;
meta_write($metaPath, $meta);
append_log($logPath, "[" . date("H:i:s") . "] 开始执行安装脚本…");

$desc = [1 => ["pipe", "w"], 2 => ["pipe", "w"]];
$proc = @proc_open($cmd, $desc, $pipes, null, null);
if (!is_resource($proc)) {
  fail_job($metaPath, $logPath, $meta, "无法启动安装进程。");
}
stream_set_blocking($pipes[1], false);
stream_set_blocking($pipes[2], false);
$buf = "";
$alive = true;
while ($alive) {
  $chunk = stream_get_contents($pipes[1]);
  $chunk2 = stream_get_contents($pipes[2]);
  if ($chunk === false) $chunk = "";
  if ($chunk2 === false) $chunk2 = "";
  $chunk .= $chunk2;
  if ($chunk !== "") {
    $buf .= $chunk;
    while (($pos = strpos($buf, "\n")) !== false) {
      $line = substr($buf, 0, $pos);
      $buf = substr($buf, $pos + 1);
      $line = rtrim($line, "\r");
      if ($line === "") continue;
      append_log($logPath, $line);
      [$pct, $stage] = classify($line);
      if ($pct !== null) $meta["pct"] = max((int)$meta["pct"], (int)$pct);
      if ($stage) $meta["stage"] = $stage;
      $meta["message"] = function_exists("mb_substr") ? mb_substr($line, 0, 180) : substr($line, 0, 180);
      $meta["log_bytes"] = @filesize($logPath) ?: 0;
      meta_write($metaPath, $meta);
    }
  }
  $st = proc_get_status($proc);
  $alive = !empty($st["running"]);
  if ($alive) usleep(120000);
}
if ($buf !== "") {
  foreach (preg_split("/\r\n|\n|\r/", $buf) as $line) {
    if ($line === "") continue;
    append_log($logPath, $line);
  }
}
$code = proc_close($proc);
$ok = ($code === 0);
$meta["exit_code"] = $code;
$meta["done"] = true;
$meta["ok"] = $ok;
$meta["status"] = $ok ? "done" : "error";
$meta["pct"] = 100;
$meta["stage"] = $ok ? "完成" : "失败";
$meta["message"] = $ok
  ? ($mode === "uninstall" ? "主题已卸载。" : ("已安装 " . ($version !== "" ? $version : "") . "。"))
  : ("操作失败（exit $code）");
$meta["log_bytes"] = @filesize($logPath) ?: 0;
meta_write($metaPath, $meta);
append_log($logPath, "[" . date("H:i:s") . "] " . $meta["message"]);
@file_put_contents($updLog, date("c") . " job=$job exit=$code\n", FILE_APPEND);
PHP;
    $php = str_replace(
        ["__JOB__", "__META__", "__LOG__", "__PID__", "__UPD__", "__MODE__", "__VER__", "__REPO__"],
        [$job_php, $meta_php, $log_php, $pid_php, $upd_php, $mode_php, $ver_php, $repo_php],
        $php
    );
    $phpFile = "/tmp/ucwc-job-" . $job . ".php";
    @file_put_contents($phpFile, $php);
    @chmod($phpFile, 0644);
    // Detach background CLI worker (not php-fpm) so auth/job_status stay responsive
    $bg = "nohup php " . escapeshellarg($phpFile) . " > /dev/null 2>&1 & echo $!";
    $pid = trim((string)@shell_exec($bg));
    if ($pid !== "") @file_put_contents($paths["pid"], $pid);
    ucwc_log($upd_log, "async-job id=$job mode=$mode version=" . ($version !== "" ? $version : "-") . " pid=" . ($pid !== "" ? $pid : "-"));
    return $job;
}

function ucwc_run_install($repo_raw, $upd_log, $mode, $version = "") {
    // Sync fallback (kept for compatibility)
    [$okPrep, $err, $ver, $has_fx, $cmd] = ucwc_prepare_install($repo_raw, $upd_log, $mode, $version);
    if (!$okPrep) return [false, $err, "", $ver, $has_fx];
    $output = [];
    $code = 1;
    @exec($cmd, $output, $code);
    $text = implode("\n", $output);
    ucwc_log($upd_log, "exit=$code\n$text");
    $ok = ($code === 0);
    $msg = $ok
        ? ($mode === "uninstall" ? "主题已卸载。" : "已安装 $ver。")
        : ("操作失败（exit $code）。" . ($text !== "" ? " " . mb_substr($text, 0, 500) : ""));
    return [$ok, $msg, $text, $ver, $has_fx];
}

function ucwc_json_out($payload, $http = 200) {
    http_response_code($http);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$action = "";
if (!empty($_POST["UCWC_ACTION"])) {
    $action = (string)$_POST["UCWC_ACTION"];
} elseif (!empty($_GET["UCWC_ACTION"])) {
    $action = (string)$_GET["UCWC_ACTION"];
}

if ($action === "") {
    ucwc_json_out(["ok" => false, "error" => "缺少 UCWC_ACTION"], 400);
}

$local = ucwc_local_status($persist_dir);

if ($action === "status" || $action === "check_update") {
    [$index, $err] = ucwc_fetch_index($repo_raw);
    if ($index === null) {
        ucwc_json_out(["ok" => false, "error" => $err, "local" => $local], 502);
    }
    $latest = (string)($index["latest_version"] ?? "");
    $latest_meta = null;
    $versions = [];
    foreach ($index["versions"] as $v) {
        $nv = ucwc_normalize_version_flags($v);
        if ($nv["id"] === "") continue;
        $versions[] = $nv;
        if ($nv["id"] === $latest) $latest_meta = $nv;
    }
    $update_available = $local["installed"] && $local["version"] !== "" && $latest !== "" && $local["version"] !== $latest;
    ucwc_json_out([
        "ok" => true,
        "action" => $action,
        "local" => $local,
        "latest_version" => $latest,
        "latest" => $latest_meta,
        "update_available" => $update_available,
        "versions" => $versions,
    ]);
}

if ($action === "changelog" || $action === "list_versions") {
    [$index, $err] = ucwc_fetch_index($repo_raw);
    if ($index === null) {
        ucwc_json_out(["ok" => false, "error" => $err, "local" => $local], 502);
    }
    [$md, $cerr] = ucwc_fetch_changelog($repo_raw);
    $versions = [];
    $want = isset($_POST["version"]) ? (string)$_POST["version"] : (isset($_GET["version"]) ? (string)$_GET["version"] : "");
    foreach ($index["versions"] as $v) {
        $nv = ucwc_normalize_version_flags($v);
        if ($nv["id"] === "") continue;
        $nv["changelog"] = ucwc_changelog_section($md, $nv["id"]);
        if ($nv["changelog"] === "" && $nv["label"] !== "") {
            $nv["changelog"] = $nv["label"];
        }
        $versions[] = $nv;
    }
    $selected = null;
    if ($want !== "" && ucwc_valid_version_id($want)) {
        foreach ($versions as $nv) {
            if ($nv["id"] === $want) { $selected = $nv; break; }
        }
    }
    if ($selected === null && $versions) $selected = $versions[0];
    ucwc_json_out([
        "ok" => true,
        "action" => $action,
        "local" => $local,
        "latest_version" => (string)($index["latest_version"] ?? ""),
        "versions" => $versions,
        "selected" => $selected,
        "changelog_error" => $cerr,
    ]);
}

if ($action === "install_latest" || $action === "install_version" || $action === "uninstall") {
    if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
        ucwc_json_out(["ok" => false, "error" => "写操作需要 POST。"], 405);
    }
    $ver = isset($_POST["version"]) ? trim((string)$_POST["version"]) : "";
    if ($action === "install_version" && !ucwc_valid_version_id($ver)) {
        ucwc_json_out(["ok" => false, "error" => "版本号格式无效。", "message" => "版本号格式无效。", "local" => $local], 400);
    }
    if ($action !== "install_latest" && $action !== "install_version" && $action !== "uninstall") {
        ucwc_json_out(["ok" => false, "error" => "未知安装动作。"], 400);
    }
    $async = !isset($_POST["async"]) || (string)$_POST["async"] !== "0";
    if ($async) {
        // Return job_id immediately — prepare+install runs in CLI background (no php-fpm block)
        $job = ucwc_start_job($action, $ver, $repo_raw, $upd_log);
        ucwc_json_out([
            "ok" => true,
            "async" => true,
            "action" => $action,
            "job_id" => $job,
            "version" => $ver,
            "theme_effects" => true,
            "message" => "任务已启动",
            "local" => $local,
            // Final page_may_vanish decided in job meta when done; optimistic hint for uninstall only
            "page_may_vanish" => ($action === "uninstall"),
        ]);
    }
    $result = ucwc_run_install($repo_raw, $upd_log, $action, $ver);
    $ok = $result[0];
    $message = $result[1];
    $output = $result[2] ?? "";
    $used_ver = $result[3] ?? $ver;
    $has_fx = $result[4] ?? false;
    $local2 = ucwc_local_status($persist_dir);
    ucwc_json_out([
        "ok" => $ok,
        "action" => $action,
        "message" => $message,
        "output" => $output,
        "version" => $used_ver,
        "theme_effects" => $has_fx,
        "local" => $local2,
        "page_may_vanish" => ($action === "uninstall") || ($action === "install_version" && !$has_fx),
    ], $ok ? 200 : 500);
}

if ($action === "job_status") {
    $job = isset($_GET["job_id"]) ? (string)$_GET["job_id"] : (isset($_POST["job_id"]) ? (string)$_POST["job_id"] : "");
    if (!preg_match('/^j[0-9A-Za-z]+$/', $job)) {
        ucwc_json_out(["ok" => false, "error" => "无效 job_id"], 400);
    }
    $meta = ucwc_job_read_meta($job);
    if (!$meta) {
        ucwc_json_out(["ok" => false, "error" => "任务不存在或已过期"], 404);
    }
    $paths = ucwc_job_paths($job);
    $offset = isset($_GET["offset"]) ? max(0, (int)$_GET["offset"]) : (isset($_POST["offset"]) ? max(0, (int)$_POST["offset"]) : 0);
    $log = "";
    $size = is_file($paths["log"]) ? (int)@filesize($paths["log"]) : 0;
    if ($size > $offset && is_file($paths["log"])) {
        $fh = @fopen($paths["log"], "rb");
        if ($fh) {
            @fseek($fh, $offset);
            $log = (string)@stream_get_contents($fh);
            @fclose($fh);
        }
    }
    // If process died without finalizing, mark error
    if (empty($meta["done"])) {
        $pid = is_file($paths["pid"]) ? trim((string)@file_get_contents($paths["pid"])) : "";
        if ($pid !== "" && ctype_digit($pid)) {
            $alive = false;
            if (function_exists("posix_kill")) {
                $alive = @posix_kill((int)$pid, 0);
            } else {
                $alive = (trim((string)@shell_exec("kill -0 " . (int)$pid . " 2>/dev/null; echo $?")) === "0");
            }
            // give runner a moment after start
            $age = time() - (@filemtime($paths["meta"]) ?: time());
            if (!$alive && $age > 2) {
                $meta["done"] = true;
                $meta["ok"] = false;
                $meta["status"] = "error";
                $meta["pct"] = 100;
                $meta["stage"] = "失败";
                $meta["message"] = "安装进程已退出（异常结束）。";
                ucwc_job_write_meta($job, $meta);
            }
        }
    }
    if (!empty($meta["done"])) {
        $meta["local"] = ucwc_local_status($persist_dir);
        $meta["page_may_vanish"] = (($meta["action"] ?? "") === "uninstall")
            || ((($meta["action"] ?? "") === "install_version") && empty($meta["theme_effects"]));
    }
    ucwc_json_out([
        "ok" => true,
        "action" => "job_status",
        "job" => $meta,
        "log" => $log,
        "offset" => $offset,
        "next_offset" => $offset + strlen($log),
        "log_size" => $size,
    ]);
}

ucwc_json_out(["ok" => false, "error" => "未知动作：$action"], 400);
