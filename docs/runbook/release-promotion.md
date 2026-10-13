# 前端发布晋级

## 联合版本约定

前端与配对后端 `file-batch-system` 作为同一平台发布，正式版本和 RC 使用相同的
`MAJOR.MINOR.PATCH[-PRERELEASE]`。完整规则以后端
[版本发布流程](https://github.com/pinpols/file-batch-system/blob/main/docs/runbook/releasing.md)为权威；
前端 `release-please` 负责生成 Release PR、Changelog、tag 和 GitHub Release，不单独决定跨仓库版本。

- 普通功能、修复、测试、文档和 CI PR 不修改 `package.json` 版本，只把有发布影响的变化累计到 `[Unreleased]`。
- 只有准备联合发布时才创建前端 Release PR，并使 `package.json`、`package-lock.json` 和 release-please manifest 与后端目标版本一致。
- 联合版本取本发布周期前后端变更中的最高级别：只有兼容修复时递增 `PATCH`，有兼容新功能时递增 `MINOR`，有破坏性变化时递增 `MAJOR`。
- 即使前端本周期没有业务变化，也随联合发布对齐版本，并在 Release Notes 中注明“仅版本及兼容组合对齐”。
- RC 在 `RC.1` 前冻结功能范围；后续发布阻断修复通过 `RC.2`、`RC.3` 重新验收，普通修复 PR 不逐个改版本。
- 已发布 tag 不移动、不覆盖、不复用。版本号表达兼容语义，实际发布与回滚以固定的前端 SHA、后端 SHA 和镜像 digest 为准。

前端 Release PR 合并前必须执行：

```bash
npm run check:version -- X.Y.Z
```

同时核对后端根 `pom.xml` 的 `<revision>` 为同一 `X.Y.Z`。release-please 生成的版本若与已批准的
联合版本不同，不得合并或创建 tag；先修正 Release PR，再重新执行版本与契约检查。

## 当前自动化边界

- release-please 目前通过手动 workflow 创建或更新前端 Release PR；Release PR 合并后再次触发，才创建 tag 和 GitHub Release。
- 后端 `compose-cd` 已能固定前后端 SHA、构建不可变镜像、生成 Release Manifest，并可执行 staging 部署与联合验收。
- 当前没有跨仓 workflow 自动决定联合版本或同时创建两张 Release PR，因此版本仍由发布计划明确输入，并在合并前人工核对两仓一致。
- 普通 PR 不触发版本递增。后续跨仓自动化只能创建或更新 Release PR；tag、GitHub Release 和生产晋级继续受 staging 结果与环境审批约束。

后续自动化使用单一 `release_version` 输入，校验 SemVer 单调递增、前后端版本一致、后端 OpenAPI 与
前端生成类型无漂移，并把版本、双仓 SHA 和镜像 digest 关联到同一次发布。自动化不得移动已存在 tag，
也不得静默推断破坏性版本升级。

## 制品模型

`main` 每次提交构建 `linux/amd64` 与 `linux/arm64` 镜像，并发布 `sha-<完整提交>` 和 `latest`。环境晋级必须使用 `sha-*`，不得重新构建同一版本；部署 Compose 必须显式设置 `IMAGE_TAG`，不会默认回退到 `latest`。

## 发布顺序

1. 合并前后端同版本 Release PR，记录两个待发布 commit SHA；此时不创建 tag。
2. 使用 `compose-cd` 从这两个 SHA 组装 Release Manifest，并将对应 `sha-*` 镜像部署到 staging。
3. 确认 `/healthz` 正常、`/version.json` 的 `gitSha` 等于目标前端提交，并完成真实前后端联合验收。
4. 在已验收的两个 commit 上分别创建同名 `v*` tag；`staging-gate` 对前端真实环境执行 Playwright、axe 与 Lighthouse。
5. `build-image` 等待该 commit 的 staging 验收成功，再给同一 digest 增加版本标签。
6. 两个仓库分别生成 GitHub Release，并在说明中记录相同的目标版本、前后端 SHA 和制品 digest。
7. 生产环境按 Release Manifest 中的 digest 晋级，部署后再次核对 `/version.json`。

缺少 staging URL、测试账号、后端文档上下文或验收结果时，发布必须失败。回滚使用上一已验收 digest，详见[回滚手册](./rollback.md)。
