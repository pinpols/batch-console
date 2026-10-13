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

1. 两仓 Release PR 合并后记录前后端 commit SHA。
2. 使用 `compose-cd` 固定这两个 SHA、构建不可变镜像并部署 staging。
3. 完成健康检查和真实前后端联合验收。
4. 在已验收 commit 上分别创建同名 `v*` tag；staging-gate 完成前端验收后再给镜像增加版本标签。
5. 两仓分别生成 GitHub Release，并记录相同版本、SHA 与制品 digest；生产按 Release Manifest 晋级。

缺少 staging URL、测试账号、后端文档上下文或验收结果时，发布必须失败。详见[回滚手册](./rollback.md)。
