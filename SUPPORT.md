# 支持与故障排查

## 先做这些检查

1. 在 **设置 → 用户偏好 → 主题特效** 确认总开关与相应功能已启用。
2. 强制刷新 WebGUI（`Ctrl+F5`），排除旧 CSS/JavaScript 缓存。
3. 检查 `/boot/config/plugins/theme.effects/ThemeEffects.state` 的版本。
4. 确认 flash 与 runtime 中存在 `ThemeEffects_Loader.page`。
5. 低配设备尝试 `balanced` 或 `low` 性能档位。

## 常见路径

```text
/boot/config/plugins/theme.effects/theme.effects.cfg
/boot/config/plugins/theme.effects/theme-effects.cfg
/boot/config/plugins/theme.effects/ThemeEffects.state
/usr/local/emhttp/plugins/theme.effects/ThemeEffects_Loader.page
/tmp/theme-effects-update.log
```

## 提交 Issue 时请附带

- Theme Effects、Unraid、浏览器和 Community Applications 版本；
- PC/手机端及性能档位；
- 发生问题的功能、连续操作步骤和预期结果；
- 已脱敏的日志、控制台错误或截图。

请勿提交 Cookie、Token、真实公网地址和私人文件路径。安全问题请按 [SECURITY.md](SECURITY.md) 私密报告。
