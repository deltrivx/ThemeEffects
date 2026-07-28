# 更新日志
## v2.1.2-beta - 2026-07-28

### 概述
字体三期：自定义 CSS 字体名 + 本地字体文件上传（woff2/woff/ttf/otf），Loader 注入 `@font-face`。

### 变更
- 正文字体 / 标题字体新增「自定义名称」「本地字体文件」
- 自定义名称：填写系统已安装字体的 CSS 名（如 Microsoft YaHei）
- 本地字体：上传 ≤4MB 的 woff2/woff/ttf/otf，存于 `assets/fonts/`
- Loader 按需 `@font-face`（UCWC Local Body / Title）
- 升级安装保留 `assets/fonts/*`
- 版本号：**v2.1.2-beta**

## v2.1.1-beta - 2026-07-28

### 概述
字体/颜色二期：更多字体与配色预设、标题字号、硬编码字体改走 CSS 变量、预览区增强。

### 变更
