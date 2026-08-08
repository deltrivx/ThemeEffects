#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-}"
MODE="${2:-snapshot}"

if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-([Bb]eta|beta)[0-9]*)?$ ]]; then
  echo "用法：$0 v主版本.次版本.修订版本 [snapshot|existing]" >&2
  exit 2
fi
if [[ "$MODE" != "snapshot" && "$MODE" != "existing" ]]; then
  echo "模式只能是 snapshot 或 existing" >&2
  exit 2
fi

VERSION_DIR="$ROOT/versions/$VERSION"
DIST_DIR="$ROOT/dist/$VERSION"
PACKAGE_DIR="$DIST_DIR/ThemeEffects-$VERSION"
RUNTIME_FILES=(
  ThemeEffects.page
  ThemeEffects_Loader.page
  PLUGIN-README.md
  apps-enhancement.js
  style.css
  style-black.css
  theme-effects.cfg
  theme.effects.cfg
  ucwc-auth-request.conf
  ucwc-theme-fx-save.php
  ucwc-update.php
  assets/background.jpg
  assets/background-1.jpg
  assets/background-2.jpg
  assets/hutao.gif
  assets/ucwc-mouse-fx.js
  assets/ucwc-particles.js
  assets/ucwc-theme-fx.css
  assets/ucwc-theme-fx.js
)

if [[ "$MODE" == "snapshot" ]]; then
  rm -rf "$VERSION_DIR"
  mkdir -p "$VERSION_DIR/assets"
  for rel in "${RUNTIME_FILES[@]}"; do
    [[ -f "$ROOT/$rel" ]] || continue
    mkdir -p "$VERSION_DIR/$(dirname "$rel")"
    cp "$ROOT/$rel" "$VERSION_DIR/$rel"
  done
elif [[ ! -d "$VERSION_DIR" ]]; then
  echo "版本目录不存在：$VERSION_DIR" >&2
  exit 1
fi

python3 - "$VERSION" "$VERSION_DIR" <<'PY'
import hashlib, json, pathlib, sys
version = sys.argv[1]
base = pathlib.Path(sys.argv[2])
files = []
for path in sorted(base.rglob('*'), key=lambda path: path.relative_to(base).as_posix()):
    if not path.is_file() or path.name == 'files.manifest':
        continue
    rel = path.relative_to(base).as_posix()
    data = path.read_bytes()
    files.append({'path': rel, 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)})
(base / 'files.manifest').write_text(
    json.dumps({'schema': 1, 'version': version, 'files': files}, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8',
)
PY

rm -rf "$DIST_DIR"
mkdir -p "$PACKAGE_DIR"
cp -R "$VERSION_DIR"/. "$PACKAGE_DIR"/

for doc in README.md ABOUT.md CHANGELOG.md CONTRIBUTING.md SECURITY.md SUPPORT.md LICENSE LICENSE-ASSETS.md NOTICE; do
  [[ -f "$ROOT/$doc" ]] && cp "$ROOT/$doc" "$PACKAGE_DIR/$doc"
done
cp "$ROOT/scripts/install.sh" "$PACKAGE_DIR/install.sh"
cp "$ROOT/theme.effects.plg" "$PACKAGE_DIR/theme.effects.plg"

python3 - "$VERSION" "$PACKAGE_DIR/theme.effects.plg" <<'PY'
import pathlib, re, sys
version = sys.argv[1]
path = pathlib.Path(sys.argv[2])
text = path.read_text(encoding='utf-8')
text = re.sub(r'(<!ENTITY\s+version\s+")[^"]+(">)', rf'\g<1>{version}\2', text, count=1)
text = re.sub(r'(<!ENTITY\s+ver\s+")[^"]+(">)', rf'\g<1>{version}\2', text, count=1)
path.write_text(text, encoding='utf-8')
PY

(
  cd "$DIST_DIR"
  COPYFILE_DISABLE=1 zip -q -X -r "ThemeEffects-$VERSION.zip" "ThemeEffects-$VERSION"
  tar_flags=(--no-xattrs)
  if tar --version 2>&1 | grep -qi bsdtar; then
    tar_flags+=(--no-mac-metadata)
  fi
  COPYFILE_DISABLE=1 tar "${tar_flags[@]}" -czf "ThemeEffects-$VERSION.tar.gz" "ThemeEffects-$VERSION"
  cp "$PACKAGE_DIR/theme.effects.plg" "theme.effects-$VERSION.plg"
  cp "$PACKAGE_DIR/files.manifest" files.manifest
  cp "$PACKAGE_DIR/install.sh" install.sh
  shasum -a 256 \
    "ThemeEffects-$VERSION.zip" \
    "ThemeEffects-$VERSION.tar.gz" \
    "theme.effects-$VERSION.plg" \
    files.manifest \
    install.sh > SHA256SUMS
)

echo "版本目录：$VERSION_DIR"
echo "发布产物：$DIST_DIR"
