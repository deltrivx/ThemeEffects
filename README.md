# Unraid Custom WebUI CSS 主题

这是一个基于 **Custom WebUI CSS** 插件实现的 Unraid WebGUI 自定义主题，针对 Unraid 7.3.2 进行适配。v1.8.1 在 v1.8.0 基础上修复一键菜单交互，并完善主题特效与移动端全屏壁纸。

## 效果预览

![仪表盘完整效果图](screenshots/dashboard-full.png)

## 安装前准备

1. 在 Unraid 的 Apps / Community Applications 中安装 **Custom WebUI CSS** 插件。
2. 确认 Unraid 可以访问 GitHub Raw 文件地址。
3. 使用 root 用户打开 Unraid 终端。

本主题使用 Custom WebUI CSS 插件，不是 Theme Engine。

## 一键安装、升级、回滚与卸载

所有操作只使用下面一个命令：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/deltrivx/unraid-custom-webui-css/main/scripts/install.sh)
```

上述命令进入**顶层菜单**（安装/升级、历史版本、卸载）。

自 **v1.8.0** 起：选择「一键安装 / 升级最新版」时**不再询问**是否安装粒子 / 胡桃，默认完整安装；安装后可在 WebGUI「设置 → 用户偏好 → 主题特效」中自行调整背景、粒子与吉祥物。

菜单选项：

1. 一键安装 / 升级最新版：未安装时自动安装，已安装时自动覆盖升级（完整安装，不询问粒子/胡桃）。
2. 查看并安装全部版本：可选择最新版或任意历史版本进行安装、降级或回滚。
3. 一键卸载主题：删除主题文件、禁用 Custom WebUI CSS，并恢复安装前的显示设置。
4. 退出。

也可直接：

```bash
# 安装指定版本
bash <(curl -fsSL https://raw.githubusercontent.com/deltrivx/unraid-custom-webui-css/main/scripts/install.sh) install v1.7.1
# 卸载
bash <(curl -fsSL https://raw.githubusercontent.com/deltrivx/unraid-custom-webui-css/main/scripts/install.sh) uninstall
```

安装 `v1.6.0` 及后续支持版本时，脚本还会安装独立的应用页增强文件 `apps-enhancement.js`（侧栏、路由隔离、搜索建议）。脚本不会覆盖完整 CA 页面，优先向 Custom WebUI CSS Loader 注入带标记的脚本引用；重复升级会自动去重，回滚历史版本或卸载主题时会自动移除。

## 自动显示设置

安装任意版本时，脚本会自动执行 README 原先要求用户手动完成的显示设置：

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
└── assets/
    ├── background.jpg
    ├── background-1.jpg
    ├── background-2.jpg
    ├── apps-enhancement.js
    ├── ucwc-particles.js
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

执行：`bash <(curl -fsSL https://raw.githubusercontent.com/deltrivx/unraid-custom-webui-css/main/scripts/install.sh) uninstall`。

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
- `scripts/install.sh`：一键安装脚本（默认显示顶层菜单；安装最新版默认完整安装，不询问粒子/胡桃）。
- `versions/index.json`：版本清单。
- `CHANGELOG.md`：中文更新日志。
