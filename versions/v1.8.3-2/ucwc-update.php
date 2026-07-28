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
    return is_string($id) && preg_match('/^v[0-9]+\.[0-9]+(\.[0-9]+)?$/', $id);
}

function ucwc_run_install($repo_raw, $upd_log, $mode, $version = "") {
    @ini_set("max_execution_time", "300");
    @set_time_limit(300);
    if (!function_exists("curl_init")) return [false, "服务器缺少 curl 扩展。", "", "", false];
    if ($mode === "install_version") {
        if (!ucwc_valid_version_id($version)) return [false, "版本号格式无效。", "", "", false];
    } elseif ($mode !== "install_latest" && $mode !== "uninstall") {
        return [false, "未知安装动作。", "", "", false];
    }

    $has_fx = false;
    if ($mode === "install_version" || $mode === "install_latest") {
        [$index, $ierr] = ucwc_fetch_index($repo_raw);
        if ($index === null) return [false, $ierr, "", "", false];
        $latest = (string)($index["latest_version"] ?? "");
        if ($mode === "install_latest") {
            $version = $latest;
            if (!ucwc_valid_version_id($version)) return [false, "远程 latest_version 无效。", "", "", false];
        }
        $found = false;
        foreach ($index["versions"] as $v) {
            if (($v["id"] ?? "") === $version) {
                $found = true;
                $has_fx = !empty($v["theme_effects"]);
                break;
            }
        }
        if (!$found) return [false, "未知版本：$version", "", "", false];
    } else {
        $version = "";
    }

    $script = "/tmp/ucwc-install-web.sh";
    [$body, $err] = ucwc_http_get("$repo_raw/scripts/install.sh", 60);
    if ($body === false) return [false, "下载 install.sh 失败：$err", "", $version, $has_fx];
    if (@file_put_contents($script, $body) === false) return [false, "写入临时脚本失败。", "", $version, $has_fx];
    @chmod($script, 0755);

    // 让 install.sh 内 curl 也走 Unraid 出站代理
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

    ucwc_log($upd_log, "run mode=$mode version=" . ($version !== "" ? $version : "-") . " proxy=" . ($proxy !== "" ? $proxy : "-") . " cmd=$cmd");
    $output = [];
    $code = 1;
    @exec($cmd, $output, $code);
    $text = implode("\n", $output);
    ucwc_log($upd_log, "exit=$code\n$text");

    $ok = ($code === 0);
    $msg = $ok
        ? ($mode === "uninstall" ? "主题已卸载。" : "已安装 $version。")
        : ("操作失败（exit $code）。" . ($text !== "" ? " " . mb_substr($text, 0, 500) : ""));
    return [$ok, $msg, $text, $version, $has_fx];
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

ucwc_json_out(["ok" => false, "error" => "未知动作：$action"], 400);
