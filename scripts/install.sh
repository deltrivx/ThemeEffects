#!/bin/sh
set -eu

REPO_RAW="https://raw.githubusercontent.com/deltrivx/ThemeEffects/main"
# Fallback bases when raw.githubusercontent TLS EOF / blocked (same repo @main)
REPO_MIRRORS="
https://cdn.jsdelivr.net/gh/deltrivx/ThemeEffects@main
https://fastly.jsdelivr.net/gh/deltrivx/ThemeEffects@main
https://raw.gitmirror.com/deltrivx/ThemeEffects/main
https://ghfast.top/https://raw.githubusercontent.com/deltrivx/ThemeEffects/main
"
PERSIST_DIR="/boot/config/plugins/theme.effects"
RUNTIME_DIR="/usr/local/emhttp/plugins/theme.effects"
PLUGIN_BOOT="/boot/config/plugins/theme.effects.plg"
PLUGIN_LOG="/var/log/plugins/theme.effects.plg"
DYNAMIX_CFG="/boot/config/plugins/dynamix/dynamix.cfg"
STATE_FILE="$PERSIST_DIR/ThemeEffects.state"
OPTIONS_FILE="$PERSIST_DIR/ThemeEffects.options"
CA_PAGE="/usr/local/emhttp/plugins/community.applications/Apps.page"
LOADER_PAGE="$PERSIST_DIR/ThemeEffects_Loader.page"
LOADER_RUNTIME="$RUNTIME_DIR/ThemeEffects_Loader.page"
THEME_FX_PAGE="$PERSIST_DIR/ThemeEffects.page"
THEME_FX_RUNTIME="$RUNTIME_DIR/ThemeEffects.page"
THEME_FX_CFG="$PERSIST_DIR/theme-effects.cfg"
CA_MARK_START='<!-- ThemeEffects:apps-enhancement:start -->'
CA_MARK_END='<!-- ThemeEffects:apps-enhancement:end -->'
LOADER_MARK_START='<!-- ThemeEffects:apps-enhancement:start -->'
LOADER_MARK_END='<!-- ThemeEffects:apps-enhancement:end -->'
OLD_SIDEBAR_MARK_START='<!-- ThemeEffects:apps-mobile-sidebar-fix:start -->'
OLD_SIDEBAR_MARK_END='<!-- ThemeEffects:apps-mobile-sidebar-fix:end -->'
PARTICLES_START='/* ThemeEffects:particles:start */'
PARTICLES_END='/* ThemeEffects:particles:end */'
HUTAO_START='/* ===== ThemeEffects:hutao-mascot:start ===== */'
HUTAO_END='/* ===== ThemeEffects:hutao-mascot:end ===== */'

OBSOLETE_PERSIST_DIR="/boot/config/plugins/custom.css"
OBSOLETE_RUNTIME_DIR="/usr/local/emhttp/plugins/custom.css"

# Remove only files that belonged exclusively to the retired plugin, and only
# when Unraid no longer has that plugin installed. Never touch style.css,
# assets, uploads, Theme Effects files, or any active plugin installation.
cleanup_obsolete_residue() {
  if [ -f /boot/config/plugins/custom.css.plg ] || [ -f /var/log/plugins/custom.css.plg ]; then
    return 0
  fi
  _removed=0
  for _root in "$OBSOLETE_PERSIST_DIR" "$OBSOLETE_RUNTIME_DIR"; do
    [ -d "$_root" ] || continue
    for _rel in \
      CustomCSS.page CustomCSS_Loader.page custom.css.cfg \
      unraid-custom-webui-css.state unraid-custom-webui-css.options \
      style.md5 README.md
    do
      if [ -e "$_root/$_rel" ] || [ -L "$_root/$_rel" ]; then
        rm -f "$_root/$_rel" 2>/dev/null || true
        _removed=1
      fi
    done
    rmdir "$_root/assets" "$_root" 2>/dev/null || true
  done
  if [ "$_removed" = "1" ]; then
    ucwc_log "已清除未安装状态下仅属于旧插件的失效残留；用户 CSS、资源与 Theme Effects 文件未改动"
  fi
}

cleanup_theme_effects_residue() {
  _removed=0
  for _path in \
    "$PERSIST_DIR/style.md5" "$RUNTIME_DIR/style.md5" \
    "$PERSIST_DIR/apps-enhancement.js" "$RUNTIME_DIR/apps-enhancement.js" \
    "$PERSIST_DIR/assets/apps-mobile-sidebar-fix.js" \
    "$RUNTIME_DIR/assets/apps-mobile-sidebar-fix.js"
  do
    if [ -e "$_path" ] || [ -L "$_path" ]; then
      rm -f "$_path" 2>/dev/null || true
      _removed=1
    fi
  done
  if [ "$_removed" = "1" ]; then
    ucwc_log "已清除 Theme Effects 旧版本的失效校验和重复脚本"
  fi
}

VERSION=""
INSTALL_MODE="ota"
INSTALL_PARTICLES="yes"
INSTALL_HUTAO="yes"
IS_LATEST="no"
THEME_EFFECTS="false"

# 日志：默认只写 stderr（Web 任务 2>&1 捕获；$(fetch_index) 等 stdout 必须纯净）。
# 插件管理器 popen 只读 stdout → UCWC_PLUGIN_INSTALL=1 时改写 stdout（plg 另 2>&1 合并错误）。
# 勿双写，否则 plg 的 2>&1 会把同一行显示两次。
ucwc_log() {
  if [ "${UCWC_PLUGIN_INSTALL:-}" = "1" ]; then
    echo "$*"
  else
    echo "$*" >&2
  fi
}

progress() {
  # $1=建议百分比 $2=阶段 $3=说明 — Web 安装 UI 会解析这些行
  ucwc_log "[进度 $1%] $2：$3"
}

ucwc_curl() {
  # Candidate mirrors provide retries. Bound each endpoint so a connected but
  # stalled Raw request cannot block a small installer file for minutes.
  curl -4 -fsSL --http1.1 --tlsv1.2 --connect-timeout 8 --retry 0 "$@"
}

ucwc_url_candidates() {
  # $1 = full URL → print candidates (one per line)
  _u=$1
  _rel=""
  case "$_u" in
    https://github.com/deltrivx/ThemeEffects/releases/download/*)
      printf '%s\n' "$_u"
      printf '%s%s\n' "https://ghfast.top/" "$_u"
      return 0
      ;;
  esac
  case "$_u" in
    https://raw.githubusercontent.com/deltrivx/ThemeEffects/main/*)
      _rel=${_u#https://raw.githubusercontent.com/deltrivx/ThemeEffects/main}
      ;;
    https://cdn.jsdelivr.net/gh/deltrivx/ThemeEffects@main/*)
      _rel=${_u#https://cdn.jsdelivr.net/gh/deltrivx/ThemeEffects@main}
      ;;
    https://fastly.jsdelivr.net/gh/deltrivx/ThemeEffects@main/*)
      _rel=${_u#https://fastly.jsdelivr.net/gh/deltrivx/ThemeEffects@main}
      ;;
    https://raw.gitmirror.com/deltrivx/ThemeEffects/main/*)
      _rel=${_u#https://raw.gitmirror.com/deltrivx/ThemeEffects/main}
      ;;
    https://ghfast.top/https://raw.githubusercontent.com/deltrivx/ThemeEffects/main/*)
      _rel=${_u#https://ghfast.top/https://raw.githubusercontent.com/deltrivx/ThemeEffects/main}
      ;;
  esac
  if [ -z "$_rel" ]; then
    printf '%s\n' "$_u"
    return 0
  fi
  printf '%s%s\n' "https://raw.githubusercontent.com/deltrivx/ThemeEffects/main" "$_rel"
  for _m in $REPO_MIRRORS; do
    [ -n "$_m" ] || continue
    printf '%s%s\n' "${_m%/}" "$_rel"
  done
}

download() {
  # Supports: download -o DEST URL   (and optional extra curl flags before -o)
  _dest=""
  _url=""
  _prev=""
  _extra=""
  for _a in "$@"; do
    if [ "$_prev" = "-o" ]; then
      _dest="$_a"
      _prev=""
      continue
    fi
    case "$_a" in
      -o) _prev="-o" ;;
      http://*|https://*) _url="$_a" ;;
      *) _extra="$_extra $_a" ;;
    esac
  done
  if [ -z "$_url" ]; then
    echo "download: missing URL" >&2
    return 1
  fi
  _bn=$(basename "$_url" | sed 's/[?].*$//')
  ucwc_log "下载文件：$_bn"
  _ok=1
  # shellcheck disable=SC2086
  for _try in $(ucwc_url_candidates "$_url" | tr '\n' ' '); do
    [ -n "$_try" ] || continue
    if [ -n "$_dest" ]; then
      if ucwc_curl --max-time 300 --speed-time 30 --speed-limit 1024 -o "$_dest" $_extra "$_try"; then
        _ok=0
        break
      fi
    else
      if ucwc_curl --max-time 300 --speed-time 30 --speed-limit 1024 $_extra "$_try"; then
        _ok=0
        break
      fi
    fi
    ucwc_log "镜像重试：$_bn"
  done
  return $_ok
}

fetch_index() {
  # Try primary + mirrors; stdout pure JSON. Pin REPO_RAW to first working base.
  _ts=$(date +%s)
  _idx=""
  _bases="$REPO_RAW"
  for _m in $REPO_MIRRORS; do
    [ -n "$_m" ] || continue
    _bases="$_bases $_m"
  done
  for _b in $_bases; do
    _b=${_b%/}
    _idx=$(ucwc_curl --max-time 30 "$_b/versions/index.json?_ts=$_ts" 2>/dev/null) || _idx=""
    case "$_idx" in
      "{"*)
        REPO_RAW="$_b"
        export REPO_RAW
        printf '%s\n' "$_idx"
        return 0
        ;;
      *)
        # strip noise before first brace if any
        _cut=$(printf '%s\n' "$_idx" | sed -n '/^{/,$p' 2>/dev/null || true)
        case "$_cut" in
          "{"*)
            REPO_RAW="$_b"
            export REPO_RAW
            printf '%s\n' "$_cut"
            return 0
            ;;
        esac
        ;;
    esac
    ucwc_log "版本索引镜像重试：$_b"
  done
  return 1
}



file_sha256() {
  # stdout: hex digest or empty
  if [ ! -f "$1" ]; then echo ""; return 0; fi
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" 2>/dev/null | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$1" 2>/dev/null | awk '{print $NF}'
  else
    echo ""
  fi
}

file_size() {
  if [ ! -f "$1" ]; then echo "0"; return 0; fi
  wc -c < "$1" 2>/dev/null | tr -d ' \t\r\n'
}

# Map package-relative path → local persist path used for OTA compare
local_path_for() {
  case "$1" in
    style.css) printf '%s\n' "$PERSIST_DIR/style.css" ;;
    style-black.css) printf '%s\n' "$PERSIST_DIR/style-black.css" ;;
    assets/*) printf '%s\n' "$PERSIST_DIR/$1" ;;
    ThemeEffects.page) printf '%s\n' "$THEME_FX_PAGE" ;;
    ThemeEffects_Loader.page) printf '%s\n' "$LOADER_PAGE" ;;
    PLUGIN-README.md) printf '%s\n' "$PERSIST_DIR/README.md" ;;
    theme-effects.cfg) printf '%s\n' "$THEME_FX_CFG" ;;
    ucwc-update.php) printf '%s\n' "$PERSIST_DIR/ucwc-update.php" ;;
    ucwc-theme-fx-save.php) printf '%s\n' "$PERSIST_DIR/ucwc-theme-fx-save.php" ;;
    ucwc-auth-request.conf) printf '%s\n' "$PERSIST_DIR/ucwc-auth-request.conf" ;;
    apps-enhancement.js) printf '%s\n' "$PERSIST_DIR/assets/apps-enhancement.js" ;;
    *) printf '%s\n' "$PERSIST_DIR/$1" ;;
  esac
}

manifest_get() {
  # $1=path $2=field(sha256|size) → value or empty
  _mp=$1
  _mf=$2
  if [ -z "${MANIFEST_JSON:-}" ]; then echo ""; return 0; fi
  printf '%s' "$MANIFEST_JSON" | jq -r --arg p "$_mp" --arg f "$_mf" \
    '.files[]? | select(.path == $p) | .[$f] // empty' 2>/dev/null || true
}

# 下载或 OTA 复用：$1=tmp目标 $2=远程URL $3=包内相对路径 $4=显示名
# 成功返回 0；失败返回非 0（与 download/curl 一致）
fetch_pkg() {
  _dest=$1
  _url=$2
  _rel=$3
  _label=${4:-$_rel}
  _source=${5:-}
  mkdir -p "$(dirname "$_dest")"

  _expect_sha=$(manifest_get "$_rel" sha256)
  _expect_sz=$(manifest_get "$_rel" size)
  _local=$(local_path_for "$_rel")

  if [ "$INSTALL_MODE" = "ota" ] && [ -n "$_local" ] && [ -f "$_local" ]; then
    _skip=0
    if [ -n "$_expect_sha" ]; then
      _cur=$(file_sha256 "$_local")
      if [ -n "$_cur" ] && [ "$_cur" = "$_expect_sha" ]; then
        _skip=1
      fi
    else
      # 无 sha：用清单 size 或 HEAD Content-Length 粗比对
      if [ -z "$_expect_sz" ] || [ "$_expect_sz" = "0" ] || [ "$_expect_sz" = "null" ]; then
        _expect_sz=$(ucwc_curl --max-time 20 -I "$_url" 2>/dev/null \
          | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} /^Content-Length:/ {print $2; exit}')
      fi
      if [ -n "$_expect_sz" ] && [ "$_expect_sz" != "0" ]; then
        _csz=$(file_size "$_local")
        if [ "$_csz" = "$_expect_sz" ]; then
          _skip=1
        fi
      fi
    fi
    if [ "$_skip" = "1" ]; then
      ucwc_log "OTA 跳过（未变）：$_label"
      OTA_SKIPPED=$(( ${OTA_SKIPPED:-0} + 1 ))
      cp -a "$_local" "$_dest"
      return 0
    fi
  fi

  OTA_FETCHED=$(( ${OTA_FETCHED:-0} + 1 ))
  if [ -n "$_source" ] && [ -f "$_source" ]; then
    if [ -n "$_expect_sha" ]; then
      _source_sha=$(file_sha256 "$_source")
      if [ -z "$_source_sha" ] || [ "$_source_sha" != "$_expect_sha" ]; then
        ucwc_log "归档文件校验失败：$_label"
        return 1
      fi
    fi
    cp -a "$_source" "$_dest"
    return 0
  fi
  download -o "$_dest" "$_url"
}


read_display_value() {
  key=$1
  sed -n "s/^${key}=\"\(.*\)\"$/\1/p" "$DYNAMIX_CFG" | head -n 1
}

set_display_value() {
  key=$1
  value=$2
  if grep -q "^${key}=" "$DYNAMIX_CFG"; then
    sed -i "s/^${key}=.*/${key}=\"${value}\"/" "$DYNAMIX_CFG"
  else
    sed -i "/^\[display\]$/a ${key}=\"${value}\"" "$DYNAMIX_CFG"
  fi
}

apply_display_settings() {
  if [ ! -f "$STATE_FILE" ]; then
    {
      printf 'theme=%s\n' "$(read_display_value theme)"
      printf 'header=%s\n' "$(read_display_value header)"
      printf 'headermetacolor=%s\n' "$(read_display_value headermetacolor)"
      printf 'background=%s\n' "$(read_display_value background)"
    } > "$STATE_FILE"
  else
    for key in theme header headermetacolor background; do
      if ! grep -q "^${key}=" "$STATE_FILE" 2>/dev/null; then
        printf '%s=%s\n' "$key" "$(read_display_value "$key")" >> "$STATE_FILE"
      fi
    done
  fi
  set_display_value theme black
  set_display_value header ffffff
  set_display_value headermetacolor ffffff
  set_display_value background 000000
}

restore_display_settings() {
  [ -f "$STATE_FILE" ] || return 0
  while IFS='=' read -r key value; do
    case "$key" in
      theme|header|headermetacolor|background) set_display_value "$key" "$value" ;;
    esac
  done < "$STATE_FILE"
  rm -f "$STATE_FILE"
}

strip_css_block() {
  file=$1
  start=$2
  end=$3
  [ -f "$file" ] || return 0
  if grep -Fq "$start" "$file" && grep -Fq "$end" "$file"; then
    awk -v s="$start" -v e="$end" '
      $0 == s { skip=1; next }
      $0 == e { skip=0; next }
      !skip { print }
    ' "$file" > "$file.tmp"
    mv "$file.tmp" "$file"
  fi
}

remove_apps_enhancement() {
  if [ -f "$CA_PAGE" ]; then
    sed -i "\|$CA_MARK_START|,\|$CA_MARK_END|d" "$CA_PAGE" 2>/dev/null || true
    sed -i "\|$OLD_SIDEBAR_MARK_START|,\|$OLD_SIDEBAR_MARK_END|d" "$CA_PAGE" 2>/dev/null || true
  fi
  for page in "$LOADER_PAGE" "$LOADER_RUNTIME"; do
    if [ -f "$page" ]; then
      sed -i "\|$LOADER_MARK_START|,\|$LOADER_MARK_END|d" "$page" 2>/dev/null || true
      sed -i "\|$OLD_SIDEBAR_MARK_START|,\|$OLD_SIDEBAR_MARK_END|d" "$page" 2>/dev/null || true
    fi
  done
  rm -f \
    "$PERSIST_DIR/assets/apps-enhancement.js" \
    "$RUNTIME_DIR/assets/apps-enhancement.js" \
    "$PERSIST_DIR/assets/apps-mobile-sidebar-fix.js" \
    "$RUNTIME_DIR/assets/apps-mobile-sidebar-fix.js"
}

inject_loader_enhancement() {
  install -m 0644 "$tmp/apps-enhancement.js" "$PERSIST_DIR/assets/apps-enhancement.js"
  install -m 0644 "$PERSIST_DIR/assets/apps-enhancement.js" "$RUNTIME_DIR/assets/apps-enhancement.js"

  snippet=$(cat <<EOF
$LOADER_MARK_START
<script src="/plugins/theme.effects/assets/apps-enhancement.js?v=$VERSION"></script>
$LOADER_MARK_END
EOF
)

  if [ -f "$LOADER_PAGE" ]; then
    printf '\n%s\n' "$snippet" >> "$LOADER_PAGE"
    if [ -f "$LOADER_RUNTIME" ]; then
      printf '\n%s\n' "$snippet" >> "$LOADER_RUNTIME"
    else
      mkdir -p "$RUNTIME_DIR"
      cp -a "$LOADER_PAGE" "$LOADER_RUNTIME" 2>/dev/null || true
    fi
  elif [ -f "$CA_PAGE" ]; then
    printf '\n%s\n' "$snippet" >> "$CA_PAGE"
  else
    echo "未检测到 ThemeEffects_Loader / Community Applications，已跳过应用页增强注入。"
  fi
}

remove_hutao_assets() {
  rm -f "$PERSIST_DIR/assets/hutao.gif" "$RUNTIME_DIR/assets/hutao.gif"
}

# Purge obsolete built-in music leftovers from Theme Effects. The independent
# Theme Music plugin is outside both roots and is never touched.
purge_obsolete_music_residue() {
  _purged=0
  for _root in "$PERSIST_DIR" "$RUNTIME_DIR"; do
    [ -n "$_root" ] || continue
    [ -e "$_root" ] || continue
    for _f in \
      "$_root/ucwc-music-api.php" \
      "$_root/assets/ucwc-music.js" \
      "$_root/assets/ucwc-music.css" \
      "$_root/assets/ucwc-music-host.html" \
      "$_root/ucwc-music.js" \
      "$_root/ucwc-music.css" \
      "$_root/ucwc-music-host.html"
    do
      if [ -e "$_f" ] || [ -L "$_f" ]; then
        rm -f "$_f" 2>/dev/null || true
        _purged=1
      fi
    done
    # Any stray music-named assets under theme.effects (not theme.music)
    if [ -d "$_root/assets" ]; then
      find "$_root/assets" -maxdepth 1 \( \
        -name 'ucwc-music*' -o -name '*music-host*' -o -name 'theme-music*' \
      \) -type f -exec rm -f {} + 2>/dev/null || true
    fi
    # Legacy music cover/lyrics caches that lived under theme.effects
    if [ -d "$_root/cover-cache" ]; then
      rm -rf "$_root/cover-cache" 2>/dev/null || true
      _purged=1
    fi
    if [ -d "$_root/lyrics-cache" ]; then
      rm -rf "$_root/lyrics-cache" 2>/dev/null || true
      _purged=1
    fi
    if [ -d "$_root/assets/cover-cache" ]; then
      rm -rf "$_root/assets/cover-cache" 2>/dev/null || true
      _purged=1
    fi
    if [ -d "$_root/assets/lyrics-cache" ]; then
      rm -rf "$_root/assets/lyrics-cache" 2>/dev/null || true
      _purged=1
    fi
  done

  # Drop MUSIC_* keys from theme-effects.cfg (keep all other settings)
  if [ -f "$THEME_FX_CFG" ] && grep -qE '^[[:space:]]*MUSIC_' "$THEME_FX_CFG" 2>/dev/null; then
    _cfg_tmp=$(mktemp /tmp/theme-effects-cfg.XXXXXX 2>/dev/null || echo /tmp/theme-effects-cfg.purge)
    if grep -vE '^[[:space:]]*MUSIC_' "$THEME_FX_CFG" > "$_cfg_tmp" 2>/dev/null; then
      install -m 0644 "$_cfg_tmp" "$THEME_FX_CFG" 2>/dev/null || mv -f "$_cfg_tmp" "$THEME_FX_CFG"
      _purged=1
    fi
    rm -f "$_cfg_tmp" 2>/dev/null || true
  fi

  # Scrub accidental music inject markers left in Loader / CA page
  for _page in "$LOADER_PAGE" "$LOADER_RUNTIME" "$CA_PAGE"
  do
    [ -f "$_page" ] || continue
    if grep -qE 'ucwc-music|__UCWC_MUSIC__|ThemeMusic:music|theme\.music/assets/ucwc-music' "$_page" 2>/dev/null; then
      _pg_tmp=$(mktemp /tmp/te-loader-scrub.XXXXXX 2>/dev/null || echo /tmp/te-loader-scrub)
      # Drop script tags that load TE-bundled music assets; keep apps-enhancement etc.
      if sed -E \
        -e '/ucwc-music(\.js|\.css|\/)/d' \
        -e '/__UCWC_MUSIC__/d' \
        -e '/ThemeMusic:music/d' \
        "$_page" > "$_pg_tmp" 2>/dev/null; then
        # Only replace if sed produced non-empty output
        if [ -s "$_pg_tmp" ]; then
          install -m 0644 "$_pg_tmp" "$_page" 2>/dev/null || cp -f "$_pg_tmp" "$_page"
          _purged=1
        fi
      fi
      rm -f "$_pg_tmp" 2>/dev/null || true
    fi
  done

  if [ "$_purged" = "1" ]; then
    ucwc_log "已清除主题特效内置音乐残留（文件/缓存/MUSIC_* 配置键）；独立插件 theme.music 不受影响"
  fi
}

remove_theme_effects() {
  purge_obsolete_music_residue
  rm -f \
    "$THEME_FX_PAGE" "$THEME_FX_RUNTIME" \
    "$THEME_FX_CFG" \
    "$PERSIST_DIR/ucwc-update.php" \
    "$RUNTIME_DIR/ucwc-update.php" \
    "$PERSIST_DIR/ucwc-theme-fx-save.php" \
    "$RUNTIME_DIR/ucwc-theme-fx-save.php" \
    "$PERSIST_DIR/ucwc-music-api.php" \
    "$RUNTIME_DIR/ucwc-music-api.php" \
    "$PERSIST_DIR/assets/ucwc-particles.js" \
    "$RUNTIME_DIR/assets/ucwc-particles.js" \
    "$PERSIST_DIR/assets/ucwc-mouse-fx.js" \
    "$RUNTIME_DIR/assets/ucwc-mouse-fx.js" \
    "$PERSIST_DIR/assets/ucwc-theme-fx.js" \
    "$RUNTIME_DIR/assets/ucwc-theme-fx.js" \
    "$PERSIST_DIR/assets/ucwc-theme-fx.css" \
    "$RUNTIME_DIR/assets/ucwc-theme-fx.css" \
    "$PERSIST_DIR/assets/ucwc-music.js" \
    "$RUNTIME_DIR/assets/ucwc-music.js" \
    "$PERSIST_DIR/assets/ucwc-music.css" \
    "$RUNTIME_DIR/assets/ucwc-music.css" \
    "$PERSIST_DIR/assets/ucwc-music-host.html" \
    "$RUNTIME_DIR/assets/ucwc-music-host.html" \
    "$PERSIST_DIR/assets/background-1.jpg" \
    "$RUNTIME_DIR/assets/background-1.jpg" \
    "$PERSIST_DIR/assets/background-2.jpg" \
    "$RUNTIME_DIR/assets/background-2.jpg" \
    "$PERSIST_DIR/assets/background-custom.jpg" \
    "$RUNTIME_DIR/assets/background-custom.jpg" \
    "$PERSIST_DIR/assets/background-dynamic.jpg" \
    "$RUNTIME_DIR/assets/background-dynamic.jpg"
  rm -rf \
    "$PERSIST_DIR/cover-cache" "$RUNTIME_DIR/cover-cache" \
    "$PERSIST_DIR/lyrics-cache" "$RUNTIME_DIR/lyrics-cache" 2>/dev/null || true
}

write_options() {
  {
    printf 'version=%s\n' "$VERSION"
    printf 'install_mode=%s\n' "$INSTALL_MODE"
    printf 'particles=%s\n' "$INSTALL_PARTICLES"
    printf 'hutao=%s\n' "$INSTALL_HUTAO"
    printf 'theme_effects=%s\n' "$THEME_EFFECTS"
    printf 'updated_at=%s\n' "$(date +%Y%m%d-%H%M%S)"
    printf 'source=deltrivx/ThemeEffects\n'
  } > "$OPTIONS_FILE"
}

sync_plugin_metadata() {
  _dst="$1"
  _url="https://github.com/deltrivx/ThemeEffects/releases/download/$VERSION/theme.effects-$VERSION.plg"
  if ! download -o "$_dst" "$_url"; then
    ucwc_log "提示：PLG 元数据下载失败，运行文件已安装；下次更新时会重试"
    return 0
  fi
  _plg_ver=$(sed -n 's/.*<!ENTITY[[:space:]]\+version[[:space:]]\+"\([^"]*\)".*/\1/p' "$_dst" | head -1)
  if [ "$_plg_ver" != "$VERSION" ] || ! grep -q '<PLUGIN name="&name;"' "$_dst"; then
    ucwc_log "提示：PLG 元数据校验失败（期望 $VERSION，得到 ${_plg_ver:-空}）"
    return 0
  fi
  install -m 0644 "$_dst" "$PLUGIN_BOOT"
  if [ -d "$(dirname "$PLUGIN_LOG")" ]; then
    install -m 0644 "$_dst" "$PLUGIN_LOG"
  fi
  ucwc_log "已同步 Unraid 插件列表元数据：$VERSION"
}

install_pair() {
  src=$1
  dst_f=$2
  dst_r=$3
  [ -f "$src" ] || return 0
  install -m 0644 "$src" "$dst_f"
  install -m 0644 "$src" "$dst_r"
}

install_version() {
  case "$INSTALL_MODE" in
    ota|full) ;;
    *) INSTALL_MODE="ota" ;;
  esac

  index=$(fetch_index)
  printf '%s' "$index" | jq -e --arg version "$VERSION" \
    '.versions[] | select(.id == $version)' >/dev/null || {
    echo "未知版本：$VERSION" >&2
    exit 64
  }

  latest=$(printf '%s' "$index" | jq -r '.latest_version')
  if [ "$VERSION" = "$latest" ]; then
    IS_LATEST="yes"
  else
    IS_LATEST="no"
  fi

  # 一律完整安装（粒子+吉祥物+主题特效能力），不询问；仅当包内无对应资源时静默跳过下载
  INSTALL_PARTICLES="yes"
  INSTALL_HUTAO="yes"

  apps_enhancement=$(printf '%s' "$index" | jq -r --arg version "$VERSION" \
    '.versions[] | select(.id == $version) | .apps_enhancement // false')
  THEME_EFFECTS=$(printf '%s' "$index" | jq -r --arg version "$VERSION" \
    '.versions[] | select(.id == $version) | .theme_effects // false')
  has_hutao=$(printf '%s' "$index" | jq -r --arg version "$VERSION" \
    '.versions[] | select(.id == $version) | .hutao // false')
  has_particles=$(printf '%s' "$index" | jq -r --arg version "$VERSION" \
    '.versions[] | select(.id == $version) | .particles // false')

  # 极旧包无资源时才关闭对应能力（不向用户询问）
  if [ "$has_hutao" = "false" ]; then
    INSTALL_HUTAO="no"
  fi
  if [ "$has_particles" = "false" ]; then
    INSTALL_PARTICLES="no"
  fi

  base="$REPO_RAW/versions/$VERSION"
  release_base="https://github.com/deltrivx/ThemeEffects/releases/download/$VERSION"
  tmp=$(mktemp -d /tmp/ThemeEffects.XXXXXX)
  trap 'rm -rf "$tmp"' EXIT INT TERM
  OTA_SKIPPED=0
  OTA_FETCHED=0
  MANIFEST_JSON=""

  if [ "$INSTALL_MODE" = "full" ]; then
    echo "正在全量安装 $VERSION …"
    progress 18 "准备安装" "全量模式：将重新下载全部包文件"
  else
    echo "正在 OTA 安装 $VERSION …"
    progress 18 "准备安装" "OTA 模式：比对本地后仅下载变更文件"
  fi
  mkdir -p "$tmp/assets" "$PERSIST_DIR/assets" "$RUNTIME_DIR/assets"
  progress 20 "清理残留" "清除旧路径文件与已拆分的音乐组件（不影响其他插件）"
  cleanup_obsolete_residue
  cleanup_theme_effects_residue
  purge_obsolete_music_residue

  # 清单：用于 OTA 哈希比对；缺失时 OTA 退化为「有本地同名则按 size 试跳，否则下载」
  progress 22 "拉取清单" "files.manifest（OTA 差异比对）"
  if download -o "$tmp/files.manifest" "$release_base/files.manifest" \
    || download -o "$tmp/files.manifest" "$base/files.manifest?_ts=$(date +%s)"; then
    MANIFEST_JSON=$(cat "$tmp/files.manifest" 2>/dev/null || true)
    case "$MANIFEST_JSON" in
      "{"*) ucwc_log "已加载文件清单（OTA 可用 sha256 比对）" ;;
      *) MANIFEST_JSON=""; ucwc_log "清单无效，OTA 将仅按本地存在性/大小尝试跳过" ;;
    esac
  else
    ucwc_log "无 files.manifest（旧包），OTA 将尽量复用同尺寸本地文件"
  fi

  # Prefer one checksummed Release archive. After the archive-level checksum,
  # fetch_pkg still validates every file against files.manifest before install.
  ARCHIVE_DIR=""
  archive="$tmp/ThemeEffects-$VERSION.tar.gz"
  sums="$tmp/SHA256SUMS"
  if download -o "$sums" "$release_base/SHA256SUMS" \
    && download -o "$archive" "$release_base/ThemeEffects-$VERSION.tar.gz"; then
    archive_expect=$(awk -v n="ThemeEffects-$VERSION.tar.gz" '$2 == n {print $1; exit}' "$sums" 2>/dev/null || true)
    archive_actual=$(file_sha256 "$archive")
    archive_root="ThemeEffects-$VERSION"
    if [ -n "$archive_expect" ] && [ "$archive_actual" = "$archive_expect" ] \
      && tar -tzf "$archive" | awk -v p="$archive_root" '
        $0 == p || index($0, p "/") == 1 {
          if ($0 ~ /(^|\/)\.\.(\/|$)/) bad=1
          next
        }
        { bad=1 }
        END { exit bad }
      ' \
      && ! tar -tvzf "$archive" | awk '$1 ~ /^[lh]/ { found=1 } END { exit !found }'; then
      mkdir -p "$tmp/release"
      if tar -xzf "$archive" -C "$tmp/release" \
        && [ -d "$tmp/release/$archive_root" ]; then
        ARCHIVE_DIR="$tmp/release/$archive_root"
        ucwc_log "已验证并展开 Release 归档（单次下载，逐文件 SHA256）"
      fi
    fi
  fi
  if [ -z "$ARCHIVE_DIR" ]; then
    ucwc_log "Release 归档不可用，将回退到逐文件镜像下载"
  fi

  progress 28 "下载文件" "主题样式与壁纸"
  fetch_pkg "$tmp/style.css" "$base/style.css" "style.css" "style.css" "${ARCHIVE_DIR:+$ARCHIVE_DIR/style.css}" || exit 1
  fetch_pkg "$tmp/style-black.css" "$base/style-black.css" "style-black.css" "style-black.css" "${ARCHIVE_DIR:+$ARCHIVE_DIR/style-black.css}" || exit 1
  fetch_pkg "$tmp/assets/background.jpg" "$base/assets/background.jpg" "assets/background.jpg" "background.jpg" "${ARCHIVE_DIR:+$ARCHIVE_DIR/assets/background.jpg}" || exit 1

  if [ "$apps_enhancement" = "true" ]; then
    progress 36 "下载文件" "应用页增强脚本"
    fetch_pkg "$tmp/apps-enhancement.js" "$base/apps-enhancement.js" "apps-enhancement.js" "apps-enhancement.js" "${ARCHIVE_DIR:+$ARCHIVE_DIR/apps-enhancement.js}" || exit 1
  fi

  if [ "$INSTALL_HUTAO" = "yes" ]; then
    progress 42 "下载文件" "吉祥物 GIF（体积较大；OTA 未变则跳过）"
    fetch_pkg "$tmp/assets/hutao.gif" "$base/assets/hutao.gif" "assets/hutao.gif" "hutao.gif" "${ARCHIVE_DIR:+$ARCHIVE_DIR/assets/hutao.gif}" || exit 1
  fi

  if [ "$THEME_EFFECTS" = "true" ]; then
    progress 52 "下载文件" "主题特效页面与资源"
    fetch_pkg "$tmp/ThemeEffects.page" "$base/ThemeEffects.page" "ThemeEffects.page" "ThemeEffects.page" "${ARCHIVE_DIR:+$ARCHIVE_DIR/ThemeEffects.page}" || exit 1
    fetch_pkg "$tmp/ThemeEffects_Loader.page" "$base/ThemeEffects_Loader.page" "ThemeEffects_Loader.page" "ThemeEffects_Loader.page" "${ARCHIVE_DIR:+$ARCHIVE_DIR/ThemeEffects_Loader.page}" || exit 1
    fetch_pkg "$tmp/PLUGIN-README.md" "$base/PLUGIN-README.md" "PLUGIN-README.md" "PLUGIN-README.md" "${ARCHIVE_DIR:+$ARCHIVE_DIR/PLUGIN-README.md}" || exit 1
    fetch_pkg "$tmp/theme-effects.cfg" "$base/theme-effects.cfg" "theme-effects.cfg" "theme-effects.cfg" "${ARCHIVE_DIR:+$ARCHIVE_DIR/theme-effects.cfg}" || exit 1
    fetch_pkg "$tmp/assets/background-1.jpg" "$base/assets/background-1.jpg" "assets/background-1.jpg" "background-1.jpg" "${ARCHIVE_DIR:+$ARCHIVE_DIR/assets/background-1.jpg}" || exit 1
    fetch_pkg "$tmp/assets/background-2.jpg" "$base/assets/background-2.jpg" "assets/background-2.jpg" "background-2.jpg" "${ARCHIVE_DIR:+$ARCHIVE_DIR/assets/background-2.jpg}" || exit 1
    fetch_pkg "$tmp/assets/ucwc-particles.js" "$base/assets/ucwc-particles.js" "assets/ucwc-particles.js" "ucwc-particles.js" "${ARCHIVE_DIR:+$ARCHIVE_DIR/assets/ucwc-particles.js}" || exit 1
    fetch_pkg "$tmp/assets/ucwc-mouse-fx.js" "$base/assets/ucwc-mouse-fx.js" "assets/ucwc-mouse-fx.js" "ucwc-mouse-fx.js" "${ARCHIVE_DIR:+$ARCHIVE_DIR/assets/ucwc-mouse-fx.js}" || true
    # 主题特效页 UI + AJAX 保存 + 版本管理 API（优先版本包，回退仓库根）
    for f in ucwc-update.php ucwc-theme-fx-save.php ucwc-auth-request.conf assets/ucwc-theme-fx.js assets/ucwc-theme-fx.css; do
      bn=$(basename "$f")
      dir=$(dirname "$f")
      mkdir -p "$tmp/$dir"
      if fetch_pkg "$tmp/$f" "$base/$f" "$f" "$bn" "${ARCHIVE_DIR:+$ARCHIVE_DIR/$f}"; then
        :
      elif download -o "$tmp/$f" "$REPO_RAW/$f"; then
        OTA_FETCHED=$((OTA_FETCHED + 1))
      elif download -o "$tmp/$f" "$REPO_RAW/assets/$bn" 2>/dev/null; then
        OTA_FETCHED=$((OTA_FETCHED + 1))
      else
        ucwc_log "警告：未找到 $f，相关 WebUI 功能可能不可用。"
        rm -f "$tmp/$f"
      fi
    done
  fi

  if [ "$INSTALL_MODE" = "ota" ]; then
    ucwc_log "OTA 统计：跳过 ${OTA_SKIPPED:-0} 个未变文件，下载 ${OTA_FETCHED:-0} 个"
    progress 65 "OTA 比对完成" "跳过 ${OTA_SKIPPED:-0} · 下载 ${OTA_FETCHED:-0}"
  fi

  progress 70 "写入主题文件" "安装样式与资源到插件目录"
  # 主题特效由 cfg 控制时，CSS 内粒子/胡桃块保留，运行时再开关
  if [ "$THEME_EFFECTS" != "true" ]; then
    if [ "$INSTALL_PARTICLES" != "yes" ]; then
      strip_css_block "$tmp/style.css" "$PARTICLES_START" "$PARTICLES_END"
    fi
    if [ "$INSTALL_HUTAO" != "yes" ]; then
      strip_css_block "$tmp/style.css" "$HUTAO_START" "$HUTAO_END"
    fi
  fi

  install -m 0644 "$tmp/style.css" "$PERSIST_DIR/style.css"
  install -m 0644 "$tmp/style-black.css" "$PERSIST_DIR/style-black.css"
  install -m 0644 "$tmp/assets/background.jpg" "$PERSIST_DIR/assets/background.jpg"
  printf 'SERVICE="enabled"\n' > "$PERSIST_DIR/theme.effects.cfg"
  # Also place auth/upload helpers on flash for Loader reinject
  if [ -f "$tmp/ucwc-auth-request.conf" ]; then
    install -m 0644 "$tmp/ucwc-auth-request.conf" "$PERSIST_DIR/ucwc-auth-request.conf"
  elif download -o "$PERSIST_DIR/ucwc-auth-request.conf" "$REPO_RAW/ucwc-auth-request.conf" 2>/dev/null; then
    :
  fi
  if [ ! -f "$PERSIST_DIR/ucwc-upload.ini" ]; then
    printf '%s\n' \
      '; ThemeEffects: wallpaper upload limits' \
      'upload_max_filesize = 12M' \
      'post_max_size = 16M' \
      'max_file_uploads = 20' > "$PERSIST_DIR/ucwc-upload.ini"
  fi

  install -m 0644 "$PERSIST_DIR/style.css" "$RUNTIME_DIR/style.css"
  install -m 0644 "$PERSIST_DIR/style-black.css" "$RUNTIME_DIR/style-black.css"
  install -m 0644 "$PERSIST_DIR/assets/background.jpg" "$RUNTIME_DIR/assets/background.jpg"

  if [ "$INSTALL_HUTAO" = "yes" ]; then
    install -m 0644 "$tmp/assets/hutao.gif" "$PERSIST_DIR/assets/hutao.gif"
    install -m 0644 "$PERSIST_DIR/assets/hutao.gif" "$RUNTIME_DIR/assets/hutao.gif"
  else
    remove_hutao_assets
  fi

  if [ "$THEME_EFFECTS" = "true" ]; then
    install_pair "$tmp/ThemeEffects.page" "$THEME_FX_PAGE" "$THEME_FX_RUNTIME"
    install_pair "$tmp/ThemeEffects_Loader.page" "$LOADER_PAGE" "$LOADER_RUNTIME"
    install_pair "$tmp/PLUGIN-README.md" "$PERSIST_DIR/README.md" "$RUNTIME_DIR/README.md"
    if [ -f "$tmp/ucwc-update.php" ]; then
      install_pair "$tmp/ucwc-update.php" "$PERSIST_DIR/ucwc-update.php" "$RUNTIME_DIR/ucwc-update.php"
    fi
    if [ -f "$tmp/ucwc-theme-fx-save.php" ]; then
      install_pair "$tmp/ucwc-theme-fx-save.php" "$PERSIST_DIR/ucwc-theme-fx-save.php" "$RUNTIME_DIR/ucwc-theme-fx-save.php"
    fi
    # 仅首次写入默认 cfg，避免覆盖用户已调设置
    if [ ! -f "$THEME_FX_CFG" ]; then
      install -m 0644 "$tmp/theme-effects.cfg" "$THEME_FX_CFG"
    else
      # 补齐缺失键
      while IFS='=' read -r k v; do
        [ -n "$k" ] || continue
        case "$k" in \#*) continue ;; esac
        if ! grep -q "^${k}=" "$THEME_FX_CFG" 2>/dev/null; then
          printf '%s=%s\n' "$k" "$v" >> "$THEME_FX_CFG"
        fi
      done < "$tmp/theme-effects.cfg"
    fi
    install_pair "$tmp/assets/background-1.jpg" "$PERSIST_DIR/assets/background-1.jpg" "$RUNTIME_DIR/assets/background-1.jpg"
    install_pair "$tmp/assets/background-2.jpg" "$PERSIST_DIR/assets/background-2.jpg" "$RUNTIME_DIR/assets/background-2.jpg"
    # Preserve user custom wallpaper / mascot / dynamic cache / fonts across upgrades
    for uf in background-custom.jpg mascot-custom.gif background-dynamic.jpg; do
      if [ -f "$PERSIST_DIR/assets/$uf" ]; then
        install -m 0644 "$PERSIST_DIR/assets/$uf" "$RUNTIME_DIR/assets/$uf" 2>/dev/null || true
      fi
    done
    if [ -d "$PERSIST_DIR/assets/fonts" ]; then
      mkdir -p "$RUNTIME_DIR/assets/fonts"
      for ff in "$PERSIST_DIR/assets/fonts"/*; do
        [ -f "$ff" ] || continue
        install -m 0644 "$ff" "$RUNTIME_DIR/assets/fonts/" 2>/dev/null || true
      done
    fi
    install_pair "$tmp/assets/ucwc-particles.js" "$PERSIST_DIR/assets/ucwc-particles.js" "$RUNTIME_DIR/assets/ucwc-particles.js"
    if [ -f "$tmp/assets/ucwc-mouse-fx.js" ]; then
      install_pair "$tmp/assets/ucwc-mouse-fx.js" "$PERSIST_DIR/assets/ucwc-mouse-fx.js" "$RUNTIME_DIR/assets/ucwc-mouse-fx.js"
    fi
    if [ -f "$tmp/assets/ucwc-theme-fx.js" ]; then
      install_pair "$tmp/assets/ucwc-theme-fx.js" "$PERSIST_DIR/assets/ucwc-theme-fx.js" "$RUNTIME_DIR/assets/ucwc-theme-fx.js"
    fi
    if [ -f "$tmp/assets/ucwc-theme-fx.css" ]; then
      install_pair "$tmp/assets/ucwc-theme-fx.css" "$PERSIST_DIR/assets/ucwc-theme-fx.css" "$RUNTIME_DIR/assets/ucwc-theme-fx.css"
    fi
    if [ -f "$tmp/ucwc-auth-request.conf" ]; then
      install -m 0644 "$tmp/ucwc-auth-request.conf" "$PERSIST_DIR/ucwc-auth-request.conf"
    fi
  fi

  remove_apps_enhancement
  if [ "$apps_enhancement" = "true" ]; then
    inject_loader_enhancement
  fi
  # Re-purge after file writes in case an old package reintroduced music assets
  cleanup_obsolete_residue
  cleanup_theme_effects_residue
  purge_obsolete_music_residue
  apply_display_settings
  write_options
  {
    grep -vE '^(version|install_mode|particles|hutao|apps_enhancement|theme_effects|updated_at|source)=' "$STATE_FILE" 2>/dev/null || true
    printf 'version=%s\n' "$VERSION"
    printf 'install_mode=%s\n' "$INSTALL_MODE"
    printf 'particles=%s\n' "$INSTALL_PARTICLES"
    printf 'hutao=%s\n' "$INSTALL_HUTAO"
    printf 'apps_enhancement=%s\n' "$apps_enhancement"
    printf 'theme_effects=%s\n' "$THEME_EFFECTS"
    printf 'updated_at=%s\n' "$(date +%Y%m%d-%H%M%S)"
    printf 'source=deltrivx/ThemeEffects\n'
  } > "$STATE_FILE.tmp"
  mv "$STATE_FILE.tmp" "$STATE_FILE"

  sync_plugin_metadata "$tmp/theme.effects-$VERSION.plg"

  progress 92 "收尾" "写入状态并应用显示设置"
  echo "已安装：主题 $VERSION（模式：$INSTALL_MODE）"
  if [ "$INSTALL_MODE" = "ota" ]; then
    echo "  OTA：跳过 ${OTA_SKIPPED:-0} 个未变文件，实际下载 ${OTA_FETCHED:-0} 个"
  fi
  if [ "$THEME_EFFECTS" = "true" ]; then
    echo "  主题特效页：已安装（设置 → 用户偏好 → 主题特效）"
  fi
  echo "显示主题和标题背景已设为黑色，页眉文字已设为白色。"
  echo "可在 WebGUI「设置 → 用户偏好 → 主题特效」中调整各项开关。"
  echo "请强制刷新 Unraid WebGUI（Ctrl+F5）。"
}

select_and_install_version() {
  index=$(fetch_index)
  count=$(printf '%s' "$index" | jq '.versions | length')
  echo "可安装版本："
  i=0
  while [ "$i" -lt "$count" ]; do
    id=$(printf '%s' "$index" | jq -r ".versions[$i].id")
    label=$(printf '%s' "$index" | jq -r ".versions[$i].label")
    released=$(printf '%s' "$index" | jq -r ".versions[$i].released_at")
    channel=$(printf '%s' "$index" | jq -r ".versions[$i].channel")
    suffix=""
    [ "$channel" = "latest" ] && suffix=" [最新版]"
    printf '  %s) %s%s - %s（%s）\n' "$((i + 1))" "$id" "$suffix" "$label" "$released"
    i=$((i + 1))
  done
  printf '请选择版本 [1]：'
  read -r choice
  choice=${choice:-1}
  case "$choice" in *[!0-9]*|'') echo "无效选择" >&2; exit 64 ;; esac
  [ "$choice" -ge 1 ] && [ "$choice" -le "$count" ] || {
    echo "选择超出范围" >&2
    exit 64
  }
  VERSION=$(printf '%s' "$index" | jq -r ".versions[$((choice - 1))].id")
  install_version
}

uninstall_theme() {
  cleanup_obsolete_residue
  cleanup_theme_effects_residue
  rm -f "$PERSIST_DIR/style.css" "$PERSIST_DIR/style-black.css" \
    "$PERSIST_DIR/assets/background.jpg"
  rm -f "$RUNTIME_DIR/style.css" "$RUNTIME_DIR/style-black.css" \
    "$RUNTIME_DIR/assets/background.jpg"
  remove_hutao_assets
  remove_apps_enhancement
  remove_theme_effects
  rm -f \
    "$LOADER_PAGE" "$LOADER_RUNTIME" \
    "$PERSIST_DIR/theme.effects.cfg" \
    "$RUNTIME_DIR/theme.effects.cfg" \
    "$PERSIST_DIR/README.md" "$RUNTIME_DIR/README.md" \
    "$OPTIONS_FILE"
  printf 'SERVICE="disabled"\n' > "$PERSIST_DIR/theme.effects.cfg" 2>/dev/null || true
  restore_display_settings
  # Runtime tree can go; keep flash user uploads unless empty
  rm -rf "$RUNTIME_DIR"
  rmdir "$PERSIST_DIR/assets" 2>/dev/null || true
  echo "主题已卸载，安装前的显示设置已恢复。请强制刷新 Unraid WebGUI。"
}

show_menu() {
  latest=$(fetch_index | jq -r '.latest_version')
  installed="未安装"
  [ -f "$PERSIST_DIR/style.css" ] && installed="已安装"
  cat <<EOF
Theme Effects（主题特效）— 独立插件 theme.effects
当前状态：$installed
最新版：$latest

  1) 一键安装 / 升级最新版（$latest）
  2) 查看并安装指定版本
  3) 一键卸载主题
  4) 退出
EOF
  printf '请选择操作 [1]：'
  read -r action
  action=${action:-1}
  case "$action" in
    1) VERSION=$latest; install_version ;;
    2) select_and_install_version ;;
    3) uninstall_theme ;;
    4) exit 0 ;;
    *) echo "无效选择" >&2; exit 64 ;;
  esac
}

# 环境变量可覆盖模式：UCWC_INSTALL_MODE=ota|full
if [ -n "${UCWC_INSTALL_MODE:-}" ]; then
  case "$UCWC_INSTALL_MODE" in ota|full) INSTALL_MODE="$UCWC_INSTALL_MODE" ;; esac
fi

[ "$(id -u)" -eq 0 ] || { echo "请使用 root 用户运行。" >&2; exit 77; }
command -v curl >/dev/null 2>&1 || { echo "缺少 curl。" >&2; exit 69; }
command -v jq >/dev/null 2>&1 || { echo "缺少 jq。" >&2; exit 69; }
[ -f "$DYNAMIX_CFG" ] || { echo "未找到 Unraid 显示设置文件。" >&2; exit 66; }
# 无参数即可用：交互终端显示菜单；非交互（curl|bash）直接安装最新版。
# 可选参数：install [version] | uninstall | menu | list
if [ "$#" -eq 0 ]; then
  if [ -t 0 ]; then
    show_menu
  else
    VERSION=$(fetch_index | jq -r '.latest_version')
    echo "正在安装：$VERSION…"
    install_version
  fi
  exit 0
fi

case "$1" in
  install)
    VERSION=""
    # 保留环境变量 UCWC_INSTALL_MODE；命令行 ota|full 可再覆盖
    case "${INSTALL_MODE:-}" in
      ota|full) ;;
      *) INSTALL_MODE="ota" ;;
    esac
    shift
    for _arg in "$@"; do
      case "$_arg" in
        ota|full) INSTALL_MODE="$_arg" ;;
        v[0-9]*) VERSION="$_arg" ;;
        *)
          # 兼容旧调用：第二参为版本
          if [ -z "$VERSION" ] && printf '%s' "$_arg" | grep -qE '^v[0-9]'; then
            VERSION="$_arg"
          fi
          ;;
      esac
    done
    if [ -z "$VERSION" ]; then
      VERSION=$(fetch_index | jq -r '.latest_version')
    fi
    echo "正在安装：$VERSION（模式：$INSTALL_MODE）…"
    install_version
    ;;
  uninstall)
    uninstall_theme
    ;;
  menu)
    [ -t 0 ] || { echo "menu 需要交互式终端。" >&2; exit 64; }
    show_menu
    ;;
  list)
    index=$(fetch_index)
    count=$(printf '%s' "$index" | jq '.versions | length')
    latest=$(printf '%s' "$index" | jq -r '.latest_version')
    echo "latest=$latest"
    i=0
    while [ "$i" -lt "$count" ]; do
      id=$(printf '%s' "$index" | jq -r ".versions[$i].id")
      label=$(printf '%s' "$index" | jq -r ".versions[$i].label")
      channel=$(printf '%s' "$index" | jq -r ".versions[$i].channel")
      printf '%s\t%s\t%s\n' "$id" "$channel" "$label"
      i=$((i + 1))
    done
    ;;
  *)
    echo "用法：install.sh [install [version]|uninstall|menu|list]" >&2
    echo "无参数：交互终端显示菜单；非交互直接安装最新版。" >&2
    exit 64
    ;;
esac
