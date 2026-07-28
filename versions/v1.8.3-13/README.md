# Unraid Custom WebUI CSS 主题

这是一个基于 **Custom WebUI CSS** 插件实现的 Unraid WebGUI 自定义主题，针对 Unraid 7.3.2 进行适配。v1.8.3-13：标题统一、上传大小提示、取消更新日志与完整安装。

## 效果预览

![仪表盘完整效果图](screenshots/dashboard-full.png)

## 安装前准备

1. 在 Unraid 的 Apps / Community Applications 中安装 **Custom WebUI CSS** 插件。
2. 确认 Unraid 可以访问 GitHub Raw 文件地址。
3. 使用 root 用户打开 Unraid 终端。

本主题使用 Custom WebUI CSS 插件，不是 Theme Engine。

## 一键安装 / 升级 / 卸载

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/deltrivx/unraid-custom-webui-css/main/scripts/install.sh)
```

- **交互终端**：显示菜单（安装/升级最新版、历史版本、卸载、退出）。
- **非交互**（如管道执行）：直接完整安装最新版。
- 安装默认包含全部功能（粒子、胡桃、主题特效等），不询问；可在 WebGUI「设置 → 用户偏好 → 主题特效」中自行调整；同页提供检测更新 / 更新日志，可安装指定版本或卸载。

菜单选项：

1. 一键安装 / 升级最新版（完整安装）
2. 查看并安装指定版本
3. 一键卸载主题
4. 退出

安装 `v1.6.0` 及后续支持版本时，脚本还会安装独立的应用页增强文件 `apps-enhancement.js`（侧栏、路由隔离、搜索建议）。脚本不会覆盖完整 CA 页面，优先向 Custom WebUI CSS Loader 注入带标记的脚本引用；重复升级会自动去重，回滚历史版本或卸载主题时会自动移除。

## 自动显示设置

安装任意版本时，脚本会自动执行显示设置：

```text
Dynamix color theme: Black
Header custom text color: #ffffff
Header custom secondary text color: #ffffff
Header custom background color: #000000
```

对应配置会写入 `/boot/config/plugins/dynamix/dynamix.cfg`。脚本仅在第一次安装时记录原值；重复升级不会覆盖备份。一键卸载时会恢复安装前的值。

## 主题文件

```text
/boot/config/plugins/custom.css/
├── style.css
├── style-black.css
├── ThemeEffects.page
├── CustomCSS_Loader.page
├── theme-effects.cfg
├── ucwc-update.php
├── ucwc-theme-fx-save.php
└── assets/
    ├── background.jpg
    ├── background-1.jpg
    ├── background-2.jpg
    ├── apps-enhancement.js
    ├── ucwc-particles.js
    ├── ucwc-theme-fx.js
    ├── ucwc-theme-fx.css
    └── hutao.gif
```

脚本同步维护持久目录与 WebGUI 运行目录，只管理本仓库的主题与增强文件。应用页增强仅在版本索引标记支持时启用；安装历史版本会自动撤销。

## 版本管理

- `versions/latest_version` 记录在 `versions/index.json` 中。
- `versions/v*` 保存可安装的语义化历史版本。
- GitHub 最新 Release 会标记为 Latest。
- 详细变化见 [CHANGELOG.md](CHANGELOG.md)。

## 常见问题

### 样式没有生效

检查 Custom WebUI CSS 是否启用：

```bash
cat /boot/config/plugins/custom.css/custom.css.cfg
```

正常应看到 `SERVICE="enabled"`。安装或升级后请强制刷新浏览器缓存：Windows/Linux 使用 `Ctrl + F5`，macOS 使用 `Command + Shift + R`。

### 背景图没有显示

```bash
ls -lh /boot/config/plugins/custom.css/assets/background.jpg
ls -lh /usr/local/emhttp/plugins/custom.css/assets/background.jpg
```

### 如何彻底清除主题

在 Unraid 终端重新执行一键命令，在菜单中选择「一键卸载主题」。

### 更新 Community Applications 后增强失效

CA 更新可能重建 `/usr/local/emhttp/plugins/community.applications/Apps.page`。重新执行一键安装命令，脚本会重新添加唯一的增强加载标记。

## 文件说明

- `style.css`：主题主样式。
- `style-black.css`：黑色主题兼容样式。
- `assets/background.jpg` / `background-1.jpg` / `background-2.jpg`：主题背景与本地壁纸。
- `assets/hutao.gif`：胡桃吉祥物。
- `assets/ucwc-particles.js`：粒子引擎（受主题特效配置控制）。
- `apps-enhancement.js`：应用页增强（路由隔离、侧栏、搜索建议）。
- `ThemeEffects.page` / `theme-effects.cfg`：主题特效页与配置（v1.8.0+）。
- `scripts/install.sh`：一键安装脚本（无额外参数即可完整安装；交互终端显示菜单）。
- `versions/index.json`：版本清单。
- `CHANGELOG.md`：中文更新日志。
