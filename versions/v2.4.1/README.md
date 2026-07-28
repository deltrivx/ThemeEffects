# Theme Effects（主题特效）

独立 Unraid WebGUI 主题插件（**不依赖** Custom WebUI CSS）。仓库：[deltrivx/ThemeEffects](https://github.com/deltrivx/ThemeEffects)

当前版本：**v2.4.1** — 正式版；独立插件目录 `theme.effects`，自带全局 Loader。

## 功能

- 全局主题 CSS（黑主题适配）
- 背景壁纸（本地 / 自定义上传 / 在线图库）
- 粒子特效
- 吉祥物（内置胡桃 / 自定义 GIF）
- 应用页增强（侧栏、搜索建议、路由隔离）
- 设置页「主题特效」分段「应用」
- 模糊等级（弱/中/强）与模糊背景性能优化
- 自定义资源双路上传（电脑 / Unraid 本地路径 + 路径树）
- 性能档位（应用时改写粒子/模糊等）/ 首次使用自动优化
- 标题栏运行时总开关（SERVICE）
- 字体 / 颜色可配置（含本地字体）
- 检查更新 / 更新日志

## 系统要求

- Unraid **6.12+**（主测 **7.3.2**）
- 可访问 GitHub Raw
- root 终端（一键脚本）或插件管理器（`.plg`）

**不再需要**安装 Custom WebUI CSS。若曾用旧版寄生安装，升级脚本会自动迁移配置/资源并清理寄生文件。

## 一键安装 / 升级 / 卸载

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/deltrivx/ThemeEffects/main/scripts/install.sh)
```

- 交互终端：菜单（最新版 / 历史版本 / 卸载 / 退出）
- 非交互（管道）：直接安装最新版
- 指定版本：`bash scripts/install.sh install v2.4.1`

### 插件方式

```bash
plugin install https://raw.githubusercontent.com/deltrivx/ThemeEffects/main/theme.effects.plg
```

或：插件 → 安装插件 → 粘贴上述 URL。

## 目录布局

```text
/boot/config/plugins/theme.effects/          # 持久
/usr/local/emhttp/plugins/theme.effects/     # 运行时
├── ThemeEffects.page            # 设置 → 用户偏好 → 主题特效
├── ThemeEffects_Loader.page     # Buttons 全局注入
├── style.css / style-black.css
├── theme.effects.cfg            # SERVICE=enabled|disabled
├── theme-effects.cfg            # 特效开关
├── ucwc-theme-fx-save.php
├── ucwc-update.php
└── assets/
```

## 自动显示设置

安装时写入 Dynamix 黑主题与白色页眉（仅首次备份原值；卸载时恢复）。

## 从 Custom WebUI CSS 寄生版迁移

v2 安装时若检测到 `/boot/config/plugins/custom.css/` 中的旧主题：

1. 复制 `theme-effects.cfg` 与用户壁纸/自定义 GIF
2. 删除寄生的 ThemeEffects / Loader / AJAX 文件
3. 若 `style.css` 为旧主题包则备份并禁用 custom.css SERVICE
4. 新特效由 `theme.effects` 独立提供

上游 **Custom WebUI CSS** 插件本体不会被卸载；若仍需手写 CSS 编辑器可重新启用该插件。

## 版本

- 清单：`versions/index.json`
- 历史包：`versions/v*`
- 日志：[CHANGELOG.md](CHANGELOG.md)

## 常见问题

### 样式未生效

```bash
cat /boot/config/plugins/theme.effects/theme.effects.cfg   # SERVICE="enabled"
ls /usr/local/emhttp/plugins/theme.effects/ThemeEffects_Loader.page
```

强制刷新：Ctrl+F5。

### 背景/吉祥物

```bash
ls -lh /boot/config/plugins/theme.effects/assets/
ls -lh /usr/local/emhttp/plugins/theme.effects/assets/
```

### 卸载

一键脚本菜单选卸载，或：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/deltrivx/ThemeEffects/main/scripts/install.sh) uninstall
# 或
plugin remove theme.effects
```
