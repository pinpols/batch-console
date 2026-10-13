# 前端发布晋级

## 联合版本约定

前端与配对后端 `file-batch-system` 作为同一平台发布，正式版本和 RC 使用相同的
`MAJOR.MINOR.PATCH[-PRERELEASE]`。完整规则以后端
[版本发布流程](https://github.com/pinpols/file-batch-system/blob/main/docs/runbook/releasing.md)为权威。

- 普通功能、修复、测试、文档和 CI PR 不修改版本号；有发布影响的变更累计到 `[Unreleased]`。
- 只有准备联合发布时才选择 patch/minor/major。两仓始终使用相同目标版本。
- 发布周期版本级别由全部变更中的最高影响决定：兼容修复为 patch，兼容功能为 minor，破坏性变化为 major。
- 即使本仓没有业务变更，也随联合发布对齐版本，并说明仅版本对齐。
- 已发布 tag 不移动、不覆盖、不复用；实际发布与回滚以固定 SHA 和镜像 digest 为准。

## 自动准备 Release PR

在后端仓库 GitHub Actions 手动运行 `prepare-platform-release`，选择 bump 类型。工作流校验两仓当前版本一致，计算下一稳定 SemVer，并在前后端分别创建同名分支和 Release PR。它不自动合并、不创建 tag/GitHub Release，也不部署生产。

启用前需在两个仓库安装同一个 GitHub App，并授予仅针对这两个仓库的 `Contents: read/write`、`Pull requests: read/write` 权限；在后端仓库配置变量 `RELEASE_AUTOMATION_APP_CLIENT_ID` 和 secret `RELEASE_AUTOMATION_APP_PRIVATE_KEY`。两个 Release PR 应一起审核和合并。前端的自动版本准备脚本会更新 `package.json`、`package-lock.json`、`.platform-release-manifest.json` 和 Changelog。

首次部署这套自动化时，先合并前端的脚本/配置 PR，再合并后端 workflow PR；后端 workflow 会从前端 `main` 取脚本。

手工检查版本时执行：

```bash
npm run check:version -- X.Y.Z
```

## 发布晋级

`main` 构建多架构不可变镜像，并发布 `sha-<完整提交>` 与 `latest`。环境晋级必须使用 `sha-*`，不得为同一版本重新构建；部署 Compose 必须显式设置 `IMAGE_TAG`，不会回退到 `latest`。

1. 合并前后端同版本 Release PR，记录两个 commit SHA；此时不创建版本 tag。
2. 使用 `compose-cd` 固定这两个 SHA、组装 Release Manifest，并将对应 `sha-*` 镜像部署到 staging。
3. 确认 `/healthz` 正常、`/version.json` 中 `gitSha` 等于目标前端提交，并完成真实前后端联合验收。
4. 在已验收的两个 commit 上分别创建同名 `v*` tag；tag 触发前端 `staging-gate` 执行 Playwright、axe 与 Lighthouse。
5. `build-image` 等待该 commit 的 staging 验收成功，再为同一 digest 增加版本标签。
6. 两仓分别生成 GitHub Release，并记录相同版本、SHA 与制品 digest。
7. 生产按 Release Manifest 中的 digest 晋级，部署后再次核对 `/version.json`。

缺少 staging URL、测试账号、后端文档上下文或验收结果时，发布必须失败。回滚使用上一已验收 digest，详见[回滚手册](./rollback.md)。
