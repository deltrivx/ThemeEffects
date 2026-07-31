# 关于 Theme Effects

Theme Effects 是面向 Unraid WebGUI 的独立视觉增强插件。它以原生设置页和全局 Loader 为入口，在不修改 Unraid 核心文件的前提下提供主题、壁纸、粒子、指针、吉祥物、字体配色和应用页增强。

## 设计原则

1. **独立运行**：所有运行文件、配置、状态和用户资源均位于 `theme.effects` 命名空间。
2. **配置优先**：服务总开关与设备性能档位决定注入范围，不制造额外隐藏状态。
3. **升级可恢复**：flash 保存完整运行文件；网络不可用时仍可恢复 WebGUI 运行时。
4. **用户资源不覆盖**：升级只补齐默认配置键，保留壁纸、字体、GIF、指针和现有设置。
5. **低配设备可用**：粒子数量、模糊和动画根据性能档位收敛，避免无意义的高频重绘。
6. **边界清晰**：音乐功能由 Theme Music 维护；安装器不修改其他插件的服务或用户内容。

## 架构

```text
ThemeEffects.page（设置与上传）
        │
        ├── theme.effects.cfg / theme-effects.cfg
        │
ThemeEffects_Loader.page（全局注入）
        │
        ├── style.css / style-black.css
        ├── ucwc-theme-fx.js / ucwc-theme-fx.css
        ├── particles / mouse / mascot / fonts
        └── apps-enhancement.js（可选应用页增强）
```

## 发布模型

- `versions/index.json` 提供可安装的 2.x 版本索引。
- `versions/<版本>/files.manifest` 记录运行文件大小和 SHA256。
- `scripts/install.sh` 负责归档校验、OTA、全量修复、回滚、残留清理和 PLG 元数据同步。
- GitHub Release 提供完整包、PLG、安装器、文件清单和总校验和。

Theme Effects 与 Unraid、Community Applications 及其他提及项目不存在官方隶属或背书关系。
