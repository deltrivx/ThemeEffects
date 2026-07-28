#!/bin/sh
set -eu

REPO_RAW="https://raw.githubusercontent.com/deltrivx/ThemeEffects/main"
PERSIST_DIR="/boot/config/plugins/theme.effects"
RUNTIME_DIR="/usr/local/emhttp/plugins/theme.effects"
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

LEGACY_DIR="/boot/config/plugins/custom.css"
LEGACY_RUNTIME="/usr/local/emhttp/plugins/custom.css"

# One-time move of theme data from parasitic custom.css install → theme.effects
migrate_from_legacy_custom_css() {
  [ -d "$LEGACY_DIR" ] || return 0
  mkdir -p "$PERSIST_DIR/assets" "$RUNTIME_DIR/assets"

  if [ -f "$LEGACY_DIR/theme-effects.cfg" ] && [ ! -f "$THEME_FX_CFG" ]; then
    install -m 0644 "$LEGACY_DIR/theme-effects.cfg" "$THEME_FX_CFG"
    echo "已迁移主题特效配置：custom.css → theme.effects"
  fi

  for f in background-custom.jpg background-dynamic.jpg mascot-custom.gif \
           background-1.jpg background-2.jpg background.jpg hutao.gif; do
    if [ -f "$LEGACY_DIR/assets/$f" ] && [ ! -f "$PERSIST_DIR/assets/$f" ]; then
      install -m 0644 "$LEGACY_DIR/assets/$f" "$PERSIST_DIR/assets/$f"
      install -m 0644 "$PERSIST_DIR/assets/$f" "$RUNTIME_DIR/assets/$f" 2>/dev/null || true
    fi
  done

  if [ -f "$LEGACY_DIR/unraid-custom-webui-css.state" ] && [ ! -f "$STATE_FILE" ]; then
    cp -a "$LEGACY_DIR/unraid-custom-webui-css.state" "$STATE_FILE" 2>/dev/null || true
  fi
  if [ -f "$LEGACY_DIR/ThemeEffects.state" ] && [ ! -f "$STATE_FILE" ]; then
    cp -a "$LEGACY_DIR/ThemeEffects.state" "$STATE_FILE" 2>/dev/null || true
  fi

  # Remove parasitic theme files so Buttons does not double-inject
  rm -f \
    "$LEGACY_DIR/ThemeEffects.page" "$LEGACY_RUNTIME/ThemeEffects.page" \
    "$LEGACY_DIR/CustomCSS_Loader.page" "$LEGACY_RUNTIME/CustomCSS_Loader.page" \
    "$LEGACY_DIR/ThemeEffects_Loader.page" "$LEGACY_RUNTIME/ThemeEffects_Loader.page" \
    "$LEGACY_DIR/ucwc-update.php" "$LEGACY_RUNTIME/ucwc-update.php" \
    "$LEGACY_DIR/ucwc-theme-fx-save.php" "$LEGACY_RUNTIME/ucwc-theme-fx-save.php" \
    "$LEGACY_DIR/theme-effects.cfg" \
    "$LEGACY_DIR/ucwc-auth-request.conf" \
    "$LEGACY_DIR/ucwc-upload.ini" \
    "$LEGACY_DIR/assets/ucwc-particles.js" "$LEGACY_RUNTIME/assets/ucwc-particles.js" \
    "$LEGACY_DIR/assets/ucwc-theme-fx.js" "$LEGACY_RUNTIME/assets/ucwc-theme-fx.js" \
    "$LEGACY_DIR/assets/ucwc-theme-fx.css" "$LEGACY_RUNTIME/assets/ucwc-theme-fx.css" \
    "$LEGACY_DIR/assets/apps-enhancement.js" "$LEGACY_RUNTIME/assets/apps-enhancement.js"

  if [ -f "$LEGACY_DIR/style.css" ] && grep -qE "ThemeEffects:theme-effects|ucwc-mascot|#ucwc-particles" "$LEGACY_DIR/style.css" 2>/dev/null; then
    mv -f "$LEGACY_DIR/style.css" "$LEGACY_DIR/style.css.bak-theme-effects" 2>/dev/null || true
    mv -f "$LEGACY_RUNTIME/style.css" "$LEGACY_RUNTIME/style.css.bak-theme-effects" 2>/dev/null || true
    if [ -f "$LEGACY_DIR/custom.css.cfg" ]; then
      printf 'SERVICE="disabled"\n' > "$LEGACY_DIR/custom.css.cfg"
    fi
    echo "已停用 custom.css 中的寄生主题样式（备份为 style.css.bak-theme-effects）。"
  fi
}

VERSION=""
INSTALL_PARTICLES="yes"
INSTALL_HUTAO="yes"
IS_LATEST="no"
THEME_EFFECTS="false"

download() {
  curl -4 -fsSL --connect-timeout 10 --max-time 180 --retry 2 "$@"
}

fetch_index() {
  download "$REPO_RAW/versions/index.json"
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

remove_theme_effects() {
  rm -f \
    "$THEME_FX_PAGE" "$THEME_FX_RUNTIME" \
    "$THEME_FX_CFG" \
    "$PERSIST_DIR/ucwc-update.php" \
    "$RUNTIME_DIR/ucwc-update.php" \
    "$PERSIST_DIR/ucwc-theme-fx-save.php" \
    "$RUNTIME_DIR/ucwc-theme-fx-save.php" \
    "$PERSIST_DIR/assets/ucwc-particles.js" \
    "$RUNTIME_DIR/assets/ucwc-particles.js" \
    "$PERSIST_DIR/assets/ucwc-theme-fx.js" \
    "$RUNTIME_DIR/assets/ucwc-theme-fx.js" \
    "$PERSIST_DIR/assets/ucwc-theme-fx.css" \
    "$RUNTIME_DIR/assets/ucwc-theme-fx.css" \
    "$PERSIST_DIR/assets/background-1.jpg" \
    "$RUNTIME_DIR/assets/background-1.jpg" \
    "$PERSIST_DIR/assets/background-2.jpg" \
    "$RUNTIME_DIR/assets/background-2.jpg" \
    "$PERSIST_DIR/assets/background-custom.jpg" \
    "$RUNTIME_DIR/assets/background-custom.jpg" \
    "$PERSIST_DIR/assets/background-dynamic.jpg" \
    "$RUNTIME_DIR/assets/background-dynamic.jpg"
}

write_options() {
  {
    printf 'version=%s\n' "$VERSION"
    printf 'particles=%s\n' "$INSTALL_PARTICLES"
    printf 'hutao=%s\n' "$INSTALL_HUTAO"
    printf 'theme_effects=%s\n' "$THEME_EFFECTS"
    printf 'updated_at=%s\n' "$(date +%Y%m%d-%H%M%S)"
    printf 'source=deltrivx/ThemeEffects\n'
  } > "$OPTIONS_FILE"
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
  tmp=$(mktemp -d /tmp/ThemeEffects.XXXXXX)
  trap 'rm -rf "$tmp"' EXIT INT TERM

  mkdir -p "$tmp/assets" "$PERSIST_DIR/assets" "$RUNTIME_DIR/assets"
  migrate_from_legacy_custom_css
  download -o "$tmp/style.css" "$base/style.css"
  download -o "$tmp/style-black.css" "$base/style-black.css"
  download -o "$tmp/assets/background.jpg" "$base/assets/background.jpg"

  if [ "$apps_enhancement" = "true" ]; then
    download -o "$tmp/apps-enhancement.js" "$base/apps-enhancement.js"
  fi

  if [ "$INSTALL_HUTAO" = "yes" ]; then
    download -o "$tmp/assets/hutao.gif" "$base/assets/hutao.gif"
  fi

  if [ "$THEME_EFFECTS" = "true" ]; then
    download -o "$tmp/ThemeEffects.page" "$base/ThemeEffects.page"
    download -o "$tmp/ThemeEffects_Loader.page" "$base/ThemeEffects_Loader.page"
    download -o "$tmp/theme-effects.cfg" "$base/theme-effects.cfg"
    download -o "$tmp/assets/background-1.jpg" "$base/assets/background-1.jpg"
    download -o "$tmp/assets/background-2.jpg" "$base/assets/background-2.jpg"
    download -o "$tmp/assets/ucwc-particles.js" "$base/assets/ucwc-particles.js"
    # 主题特效页 UI + AJAX 保存 + 版本管理 API（优先版本包，回退仓库根）
    for f in ucwc-update.php ucwc-theme-fx-save.php ucwc-auth-request.conf assets/ucwc-theme-fx.js assets/ucwc-theme-fx.css; do
      bn=$(basename "$f")
      dir=$(dirname "$f")
      mkdir -p "$tmp/$dir"
      if download -o "$tmp/$f" "$base/$f"; then
        :
      elif download -o "$tmp/$f" "$REPO_RAW/$f"; then
        :
      elif download -o "$tmp/$f" "$REPO_RAW/assets-$bn" 2>/dev/null; then
        :
      else
        echo "警告：未找到 $f，相关 WebUI 功能可能不可用。" >&2
        rm -f "$tmp/$f"
      fi
    done
  fi

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
    install_pair "$tmp/assets/ucwc-particles.js" "$PERSIST_DIR/assets/ucwc-particles.js" "$RUNTIME_DIR/assets/ucwc-particles.js"
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
  apply_display_settings
  write_options
  {
    grep -vE '^(version|particles|hutao|apps_enhancement|theme_effects|updated_at|source)=' "$STATE_FILE" 2>/dev/null || true
    printf 'version=%s\n' "$VERSION"
    printf 'particles=%s\n' "$INSTALL_PARTICLES"
    printf 'hutao=%s\n' "$INSTALL_HUTAO"
    printf 'apps_enhancement=%s\n' "$apps_enhancement"
    printf 'theme_effects=%s\n' "$THEME_EFFECTS"
    printf 'updated_at=%s\n' "$(date +%Y%m%d-%H%M%S)"
    printf 'source=deltrivx/ThemeEffects\n'
  } > "$STATE_FILE.tmp"
  mv "$STATE_FILE.tmp" "$STATE_FILE"

  echo "已安装：主题 $VERSION"
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
    if [ "$#" -ge 2 ]; then
      VERSION=$2
    else
      VERSION=$(fetch_index | jq -r '.latest_version')
    fi
    echo "正在安装：$VERSION…"
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
