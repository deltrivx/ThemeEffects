# Theme Effects · 主题特效

[English](README.en.md) | **简体中文** | [Release Index](RELEASES.md)

[![最新版本](https://img.shields.io/github/v/release/deltrivx/ThemeEffects?display_name=tag&sort=semver&label=最新版本)](https://github.com/deltrivx/ThemeEffects/releases/latest)
[![Unraid](https://img.shields.io/badge/Unraid-6.12%2B-F15A2C?logo=unraid&logoColor=white)](https://unraid.net/)
[![代码许可](https://img.shields.io/badge/代码许可-GPL--2.0-blue)](LICENSE)
[![文档与原创视觉](https://img.shields.io/badge/文档与原创视觉-CC%20BY--NC--SA%204.0-8a2be2)](LICENSE-ASSETS.md)

面向 Unraid WebGUI 的独立视觉增强插件。Theme Effects 将壁纸、粒子、鼠标动效、指针、吉祥物、字体配色和应用页增强整合到原生设置页，并提供可回滚、可离线恢复的正式发布链路。

> 当前正式版：**v2.8.7** · 插件 ID：`theme.effects` · 最低 Unraid：**6.12.0**

## 核心能力

| 能力 | 说明 |
|---|---|
| 全局主题 | 原生 WebGUI 深色样式、壁纸、模糊层级与响应式布局 |
| 粒子特效 | 多种背景粒子，可按性能档位自动收敛密度与刷新负载 |
| 鼠标体验 | 柔光、光环、光迹、星火及多套全站指针，也支持上传自定义指针 |
| 吉祥物 | 内置或自定义 GIF，支持位置、尺寸、透明度和模糊程度 |
| 字体与颜色 | 正文/标题字体、字号、颜色预设和本地字体文件 |
| 应用页增强 | Community Applications 侧栏、搜索建议及移动端布局适配 |
| 双路资源上传 | 从浏览器上传，或从 Unraid 本地路径选择壁纸、字体、GIF 和指针 |
| 可靠发布 | Release 归档双重 SHA256 校验、差异写入、历史回滚与 flash 离线恢复 |

音乐播放已由独立项目 [Theme Music](https://github.com/deltrivx/ThemeMusic) 维护，Theme Effects 不包含音乐运行代码。

## 安装

### 方式一：Unraid 插件管理器

进入 **插件 → 安装插件**，粘贴：

```text
https://raw.githubusercontent.com/deltrivx/ThemeEffects/main/theme.effects.plg
```

### 方式二：终端 OTA 安装

OTA 会复用哈希未变化的本地文件，只写入变化项：

```bash
curl -fsSL https://github.com/deltrivx/ThemeEffects/releases/download/v2.8.7/install.sh -o /tmp/theme-effects-install.sh
sh /tmp/theme-effects-install.sh install v2.8.7 ota
```

### 方式三：终端全量修复

全量模式重新写入版本包中的全部运行文件，适合修复损坏或被手动修改的安装：

```bash
curl -fsSL https://github.com/deltrivx/ThemeEffects/releases/download/v2.8.7/install.sh -o /tmp/theme-effects-install.sh
sh /tmp/theme-effects-install.sh install v2.8.7 full
```

安装完成后插件默认关闭。前往 **设置 → 用户偏好 → 主题特效**，手动开启总开关后才会向 WebGUI 注入效果。

## 配置与运行

- 标题栏总开关控制是否向 WebGUI 注入视觉效果。
- 设置页分段应用壁纸、粒子、鼠标、吉祥物、字体和性能参数。
- `PERF_PROFILE=auto|high|balanced|low` 可按设备能力自动降低模糊、粒子与动画负载。
- 用户上传的壁纸、字体、GIF、指针及配置在升级时保留。
- 应用后若浏览器仍显示旧样式，请执行强制刷新（`Ctrl+F5`）。

## 持久化路径

| 内容 | 路径 |
|---|---|
| 插件与版本状态 | `/boot/config/plugins/theme.effects/` |
| 运行时 | `/usr/local/emhttp/plugins/theme.effects/` |
| 服务开关 | `/boot/config/plugins/theme.effects/theme.effects.cfg` |
| 特效设置 | `/boot/config/plugins/theme.effects/theme-effects.cfg` |
| 用户资源 | `/boot/config/plugins/theme.effects/assets/` |
| 设置入口 | `/Settings/ThemeEffects` |

升级安装会自动清理 Theme Effects 自身旧版本留下的失效 Loader、音乐组件、缓存和重复注入，不会迁移、停用或改写其他插件的服务配置、用户 CSS 和上传资源。

## 发布与校验

每个正式 Release 提供：

- `ThemeEffects-<版本>.zip`
- `ThemeEffects-<版本>.tar.gz`
- `theme.effects-<版本>.plg`
- `files.manifest`
- `install.sh`
- `SHA256SUMS`

安装器优先一次下载 Release 归档，先验证归档总 SHA256，再按 `files.manifest` 对运行文件逐一复核。归档不可用时才回退到限时的逐文件镜像下载。

## 兼容性与边界

- 支持 Unraid 6.12 及以上版本，主要在 Unraid 7.3.2 验证。
- 需要 Unraid 自带的 `curl`、`jq`、PHP 和常用归档工具。
- Community Applications 更新可能影响应用页增强的 DOM 结构；基础主题与特效不依赖该增强。
- 项目不修改 Docker 容器、虚拟机、阵列数据或用户媒体文件。

## 项目文档

- [ABOUT.md](ABOUT.md)：项目定位、架构与设计原则
- [CHANGELOG.md](CHANGELOG.md)：2.0 以来的重要中文更新记录
- [CONTRIBUTING.md](CONTRIBUTING.md)：贡献与验证流程
- [SECURITY.md](SECURITY.md)：安全支持与私密报告方式
- [SUPPORT.md](SUPPORT.md)：故障排查与提交信息
- [docs/display-settings.md](docs/display-settings.md)：显示设置说明
- [docs/troubleshooting.md](docs/troubleshooting.md)：常见问题

## 许可证

- 程序源代码采用 [GNU GPL-2.0](LICENSE)：允许用户使用、研究、修改和分发程序；分发修改版本时须遵守 GPL-2.0 的相同许可条件。
- 原创文档、截图和明确标注的原创视觉资产采用 [CC BY-NC-SA 4.0](LICENSE-ASSETS.md)。
- 第三方角色、商标、名称及来源不明的媒体文件不包含在上述视觉资产授权中，详见 [NOTICE](NOTICE)。

## 致谢

感谢 Unraid、Community Applications 社区及所有参与实机测试和反馈的用户。Theme Effects 是独立社区项目，与文中提及的产品或服务不存在官方隶属或背书关系。
