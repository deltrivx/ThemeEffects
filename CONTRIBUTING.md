# 贡献指南

Issue、文档修正、兼容性反馈和代码贡献均可使用中文。

## 提交前

1. 搜索现有 Issue 与 Release，确认问题尚未解决。
2. 隐去 Unraid 登录信息、Cookie、Token、公网地址和私人文件路径。
3. 界面问题请说明 Unraid、浏览器、设备类型和性能档位。
4. Community Applications 问题请同时提供其版本和受影响页面。

## 开发约定

- 当前运行文件变更后，通过 `scripts/build-release.sh <版本> snapshot` 生成不可变快照。
- 不直接修改已经发布的历史快照。
- 保持 OTA、全量安装、PLG 安装、回滚、离线恢复和卸载对用户配置兼容。
- 不在代码、测试、日志和提交中写入真实凭据或私人资源。
- 中文用户文案应与 README、CHANGELOG 和 PLG 保持一致。

## 验证

```bash
./scripts/verify-release.sh
./scripts/build-release.sh v2.7.0 snapshot
./scripts/verify-release.sh v2.7.0
```

涉及 UI 时还需覆盖桌面/移动端、仪表盘重绘、页面切换和低性能档位。
