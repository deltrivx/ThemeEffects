#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-}"
cd "$ROOT"

echo "[1/8] JavaScript、Shell 与 JSON"
node --check apps-enhancement.js
node --check assets/ucwc-mouse-fx.js
node --check assets/ucwc-particles.js
node --check assets/ucwc-theme-fx.js
sh -n scripts/install.sh
bash -n scripts/build-release.sh
bash -n scripts/verify-release.sh
python3 -m json.tool versions/index.json >/dev/null

echo "[2/8] 版本索引"
python3 - <<'PY'
import json, pathlib, re
root = pathlib.Path('.')
index = json.loads((root / 'versions/index.json').read_text())
ids = [item['id'] for item in index['versions']]
assert ids and len(ids) == len(set(ids)), '版本索引为空或存在重复 id'
assert index['default'] == index['latest_version'] == ids[0], '默认、最新和首项不一致'
assert all(not value.startswith('v1.') for value in ids), '索引仍包含 2.0 以前版本'
plg = (root / 'theme.effects.plg').read_text()
match = re.search(r'<!ENTITY\s+version\s+"([^"]+)">', plg)
assert match and match.group(1) == ids[0], 'PLG 版本与索引不一致'
assert ids[0] in (root / 'README.md').read_text(), 'README 未声明当前版本'
assert re.search(r'^##\s+' + re.escape(ids[0]) + r'\b', (root / 'CHANGELOG.md').read_text(), re.M), 'CHANGELOG 缺少当前版本'
print(f'当前版本：{ids[0]}；保留 2.x 版本：{len(ids)}')
PY

echo "[3/8] 所有版本文件清单"
python3 - <<'PY'
import hashlib, json, pathlib
root = pathlib.Path('versions')
count = 0
dirs = sorted(path for path in root.iterdir() if path.is_dir())
assert dirs and all(not path.name.startswith('v1.') for path in dirs), '仍存在 2.0 以前版本目录'
for directory in dirs:
    manifest = directory / 'files.manifest'
    data = json.loads(manifest.read_text())
    assert data.get('version') == directory.name, f'{manifest}: version 不一致'
    listed = set()
    for item in data.get('files', []):
        rel = item['path']; listed.add(rel)
        path = directory / rel
        assert path.is_file(), f'{manifest}: 缺少 {rel}'
        raw = path.read_bytes()
        assert len(raw) == item['size'], f'{path}: size 不一致'
        assert hashlib.sha256(raw).hexdigest() == item['sha256'], f'{path}: sha256 不一致'
        count += 1
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file() and p.name != 'files.manifest'}
    assert listed == actual, f'{manifest}: 清单与目录文件集合不一致'
print(f'已校验 {len(dirs)} 个版本、{count} 个运行文件')
PY

echo "[4/8] PLG XML 内嵌脚本"
python3 - <<'PY'
import html, pathlib, re, subprocess, tempfile
text = pathlib.Path('theme.effects.plg').read_text()
blocks = re.findall(r'<FILE(?: [^>]*)? Run="/bin/bash"(?: [^>]*)?>\s*<INLINE>\n(.*?)\n</INLINE>', text, re.S)
assert blocks, '未找到 PLG 内嵌脚本'
for block in blocks:
    block = html.unescape(block)
    for key, value in {
        '&ver;':'v0.0.0','&flash;':'/tmp/theme.effects','&plugdir;':'/tmp/theme.effects.runtime',
        '&installSH;':'https://example.invalid/install.sh','&github;':'owner/repo'
    }.items():
        block = block.replace(key, value)
    with tempfile.NamedTemporaryFile('w', suffix='.sh') as handle:
        handle.write(block); handle.flush()
        subprocess.run(['bash', '-n', handle.name], check=True)
print(f'已校验 {len(blocks)} 个内嵌脚本')
PY

echo "[5/8] 文档、许可与切割边界"
for file in README.md ABOUT.md CHANGELOG.md PLUGIN-README.md CONTRIBUTING.md SECURITY.md SUPPORT.md LICENSE LICENSE-ASSETS.md NOTICE; do
  test -s "$file" || { echo "缺少文档：$file" >&2; exit 1; }
done
test ! -e style.md5
if find versions -name style.md5 -o -name CustomCSS_Loader.page | grep -q .; then
  echo "仍存在已失效的专属文件" >&2
  exit 1
fi
if command -v rg >/dev/null 2>&1; then
  boundary_hits=$(rg -i 'custom[ _-]*webui|CustomCSS|custom\.css' \
    --glob '!scripts/install.sh' --glob '!scripts/verify-release.sh' \
    --glob '!versions/**' --glob '!CHANGELOG.md' . || true)
else
  boundary_hits=$(grep -RIEi 'custom[ _-]*webui|CustomCSS|custom\.css' . \
    --exclude=install.sh --exclude=verify-release.sh --exclude=CHANGELOG.md \
    --exclude-dir=versions --exclude-dir=.git || true)
fi
if [ -n "$boundary_hits" ]; then
  echo "当前说明或运行代码仍包含旧项目耦合" >&2
  exit 1
fi

echo "[6/8] PHP 语法"
if command -v php >/dev/null 2>&1; then
  for file in ThemeEffects.page ThemeEffects_Loader.page ucwc-theme-fx-save.php ucwc-update.php; do
    php -d short_open_tag=1 -l "$file" >/dev/null
  done
else
  echo "本机无 PHP，留给 Unraid 实机校验"
fi

echo "[7/8] 当前源文件一致性"
if [ -n "$VERSION" ]; then
  test -d "versions/$VERSION" || { echo "版本目录不存在：$VERSION" >&2; exit 1; }
  for rel in ThemeEffects.page ThemeEffects_Loader.page PLUGIN-README.md apps-enhancement.js style.css style-black.css theme-effects.cfg theme.effects.cfg ucwc-auth-request.conf ucwc-theme-fx-save.php ucwc-update.php assets/background.jpg assets/background-1.jpg assets/background-2.jpg assets/hutao.gif assets/ucwc-mouse-fx.js assets/ucwc-particles.js assets/ucwc-theme-fx.css assets/ucwc-theme-fx.js; do
    cmp -s "$rel" "versions/$VERSION/$rel" || { echo "快照不一致：$rel" >&2; exit 1; }
  done
else
  echo "未指定版本，跳过当前快照比较"
fi

echo "[8/8] 发布产物"
if [ -n "$VERSION" ]; then
  (
    cd "dist/$VERSION"
    shasum -a 256 -c SHA256SUMS
    tar -tzf "ThemeEffects-$VERSION.tar.gz" | awk -v p="ThemeEffects-$VERSION" '
      /(^|\/)\._/ { bad=1 }
      $0 == p || index($0, p "/") == 1 { next }
      { bad=1 }
      END { exit bad }
    '
    if zipinfo -1 "ThemeEffects-$VERSION.zip" | grep -Eq '(^|/)\._'; then
      echo "ZIP 含 macOS AppleDouble 元数据" >&2
      exit 1
    fi
  )
else
  echo "未指定版本，跳过发布产物校验"
fi

echo "Theme Effects 发布检查全部通过。"
