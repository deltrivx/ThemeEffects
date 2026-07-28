# Theme Effects v2.4.0

发布日期：2026-07-29

## 本版要点

- **仪表盘图标**：模块标题区控件统一 1.8rem；关闭磁贴移入右侧图标组最前（解锁时同行显示）
- **关闭磁贴**：修复主题 CSS 强制 `display` 导致常显；无 right-controls 的模块自动补容器
- **性能档位生效**：修复 `sectionOfButton` 将 perf 误判为 all；应用时按档位改写粒子/模糊/动效配置
- **去掉 GPU_ACCEL**：无实际客户端减负，仅保留 PERF_PROFILE + 首次建议 toast
- **保存安全**：部分 POST / toast 不再误清粒子、吉祥物、模糊等开关
- **磁贴控件**：System 停机/重启/电源与齿轮等对齐；颜色统一

完整说明见仓库根目录 `CHANGELOG.md`。
