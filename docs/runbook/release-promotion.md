# 前端发布晋级

## 制品模型

`main` 每次提交构建 `linux/amd64` 与 `linux/arm64` 镜像，并发布 `sha-<完整提交>` 和 `latest`。环境晋级必须使用 `sha-*`，不得重新构建同一版本。

## 发布顺序

1. 将目标 `sha-*` 镜像部署到 staging。
2. 确认 `/healthz` 正常，且 `/version.json` 的 `gitSha` 等于目标提交。
3. 创建 `v*` tag。`staging-gate` 对真实环境执行 Playwright、axe 与 Lighthouse。
4. `build-image` 等待该 commit 的 staging 验收成功，再给同一 digest 增加版本标签。
5. 生产环境按版本标签或 digest 部署，部署后再次核对 `/version.json`。

缺少 staging URL、测试账号、后端文档上下文或验收结果时，发布必须失败。回滚使用上一已验收 digest，详见[回滚手册](./rollback.md)。
