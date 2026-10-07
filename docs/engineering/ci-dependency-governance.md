# CI 依赖治理

本文定义 Batch Console 的 GitHub Actions、Runner 镜像和 CI 工具依赖如何选型、升级、验证与回滚。具体 workflow 职责、触发方式和故障排查见 [CI 门禁运行手册](../runbook/ci.md)。Node 与 npm 运行时约束见[运行时与依赖版本](./runtime-versions.md)。

## 目标与边界

治理目标：

- CI 环境可重复，不因浮动 Runner 镜像或 Action 运行时迁移产生随机差异。
- 升级按风险分批，每一批都能独立验证和回滚。
- 产物上传下载、镜像构建、文档构建和安全扫描均有真实闭环证据。
- 本地治理、PR 门禁、主干门禁使用同一套约束，不依赖人工记忆。

本文只管理前端仓库的 CI 基础设施，不越过以下职责边界：

- npm 业务依赖、Vue 生态和测试框架主版本按独立 PR 升级，不与 Action 升级混合。
- 后端 Java、数据库、Worker 和 Console API 的 CI 由 `file-batch-system` 仓库治理。
- staging 真实业务验收仍由 `staging-gate` 负责，静态检查和本地 mock 不能替代真实环境。
- CI 通过不等于生产发布完成；镜像晋级与回滚遵循[发布晋级](../runbook/release-promotion.md)和[回滚手册](../runbook/rollback.md)。

## 当前基线

版本权威源是 `.github/workflows/*.yml`，本文只记录治理基线，不替代代码配置。

| 类别 | 基线 | 约束 |
|---|---|---|
| Runner | `ubuntu-26.04` | 使用显式 GA 标签，禁止 `ubuntu-latest` |
| Node | Node 24.21.0 | `.node-version` 与 `.nvmrc` 固定精确 patch，工作流通过 `setup-node` 读取 |
| 仓库检出 | `actions/checkout` v7 对应 SHA | 跨仓文档检出同样使用该基线 |
| Artifact | `actions/upload-artifact@v7`、`actions/download-artifact@v8` | 升级后必须验证跨 Job 上传、下载、解压和消费 |
| Docker | QEMU/Buildx/Login v4、Metadata v6、Build Push v7 | 必须覆盖多架构构建、GHCR 登录和推送 |
| 发布与更新 | Release Please v5、Renovate v46 | Renovate 使用精确版本，发布 Action 使用受支持主版本 |
| 安全与质量 | CodeQL、Trivy、Lighthouse | 版本变化必须保持原有阻断语义和报告产物 |

所有外部 Action 必须固定到 40 位 commit SHA，保留版本注释供人工阅读；`docker://` Action 必须同时保留可读 tag 和不可变 digest。`scripts/check-workflows.mjs` 在本地与 CI 强制执行该约束。npm 包由 `package-lock.json` 的 integrity 校验，容器基础镜像由 tag + 多架构 manifest digest 锁定。

## Runner 策略

所有 GitHub-hosted Linux Job 固定到明确的 GA 镜像版本。原因是 `ubuntu-latest` 会在迁移窗口内逐步指向新镜像，同一分支的不同运行可能落到不同系统版本，影响系统库、Docker、浏览器和预编译二进制文件。

迁移到新 Runner 时按以下顺序执行：

1. 查阅 GitHub Runner Images 官方公告，确认目标标签已 GA。
2. 在独立分支统一替换所有 workflow，不允许只迁移部分门禁形成双基线。
3. 运行 actionlint 和仓库 workflow 治理检查。
4. 通过 PR 自动门禁确认 Runner 可被实际分配。
5. 手动运行 `full-ci-gate`，覆盖 Docker、Trivy、Artifact 和 Lighthouse。
6. 合并后观察 `main` 的完整门禁和镜像构建。

`actionlint` 1.7.12 的内置标签表暂未包含 `ubuntu-26.04`，`.github/actionlint.yaml` 用兼容白名单登记该标签。升级到原生识别 Ubuntu 26.04 的 actionlint 后，应删除该白名单并重新运行静态检查。

## 季度集中升级

Renovate 只在每年 1、4、7、10 月首日以 `dryRun=full` 生成依赖盘点并创建一张 Issue，不修改分支、不创建 PR、不自动合并。维护者基于最新 `main` 创建一张人工依赖治理 PR；可达的 Critical/High 安全漏洞可以单独紧急修复，不等待季度窗口。

精确版本用于保证同一提交反复执行时解析相同内容，但不同生态还必须依赖不可变校验：Action SHA、Docker digest、npm lockfile integrity。只写一个语义版本号不能防止上游 tag 或制品被替换。

## 分批升级规则

每批只处理一种风险面：

| 批次 | 内容 | 必须验证 |
|---|---|---|
| A | Checkout、Setup Node、CodeQL 等基础 Action | workflow 语法、Node 安装、lint、类型、单测、构建 |
| B | Artifact 上传下载 | 同一次运行中的上传、跨 Job 下载、解压、预览消费 |
| C | Docker、发布、Renovate | Buildx、多架构镜像、GHCR 登录、元数据和更新任务 |
| D | Runner 镜像 | PR 全门禁、手动 full gate、合并后主干镜像构建 |
| E | npm 主版本依赖 | 独立锁文件变更、完整单测/构建、必要的业务回归 |

禁止把 Action 主版本、Runner 系统版本和 npm 框架主版本放在同一提交中。否则失败时无法快速判断是 Action 运行时、系统库还是应用依赖导致。

## 标准变更流程

### 1. 盘点

```bash
rg -n 'uses:|runs-on:' .github/workflows
npm outdated
```

核对官方 Release、迁移说明、最低 Runner 版本和破坏性参数变化。搜索结果只用于发现候选项，最终版本以官方仓库和当前 workflow 实际用法为准。

### 2. 本地验证

```bash
npm run check:workflows
npm run check:encoding
npm run check:docs
npm run check:changelog
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667
npm run preflight:changed:all
```

本地检查证明配置、文档和代码可构建，但不能证明 GitHub 能分配目标 Runner，也不能证明 Artifact 服务和 GHCR 链路正常。

### 3. PR 验证

PR 至少应通过：

- `Lint / Typecheck / Unit / Build`
- `Node 24 compatibility`
- `Frontend documentation build`
- `Static checks + Unit`
- `Security audit (full)`
- `CodeQL JavaScript/TypeScript`

`skipped` 只能按 workflow 条件解释，不能写成“已通过”。PR 场景中 Docker/Trivy 和 Lighthouse 会按设计跳过，因此涉及 Runner、Docker 或 Artifact 的升级还必须执行下一步。

### 4. 手动完整门禁

```bash
gh workflow run full-ci-gate.yml --ref <branch>
gh run watch <run-id> --exit-status
```

完整门禁必须实际看到：

- `static-and-unit` 构建并上传 `dist`。
- `lighthouse` 下载 `dist`、启动 Vite Preview 并完成检查。
- Docker 镜像构建成功。
- Trivy 阻断扫描、报告扫描与 SARIF 上传成功。
- npm audit 报告上传成功。

### 5. 合并后确认

合并后检查目标提交触发的 `pr-gate`、`frontend-ci`、`full-ci-gate`、`codeql` 和 `build-image`。发布相关 Job 在非 tag 事件中按条件跳过属于正常行为，镜像 `build` Job 不应跳过。

## 回滚

当新版 Action 或 Runner 导致主干失败时：

1. 保留失败 Run URL 和首个真实错误，不以重跑覆盖证据。
2. 确认失败属于 CI 基础设施，而不是应用测试、OpenAPI 漂移或安全门禁。
3. 在独立修复 PR 中回退到上一组已验证版本；不要直接关闭检查或改为 `continue-on-error`。
4. 对 Artifact 问题同时回退上传和下载 Action，避免协议组合未经验证。
5. 对 Runner 问题回退到上一明确版本，例如 `ubuntu-24.04`，不要回退到浮动的 `ubuntu-latest`。
6. 重新执行 PR 门禁和手动 `full-ci-gate`。

## 2026-09-30 落地证据

本轮治理由 PR `#244` 落地，主干合并提交为 `5dc6f038b78d714a14211f5c150391c13d02269e`。验证范围包括：

- Action 运行时升级到 Node 24 兼容主版本。
- Artifact v7/v8 跨 Job 上传、下载和 Lighthouse 消费闭环。
- Ubuntu 26.04 Runner 的 PR 自动门禁和手动完整门禁。
- Docker Buildx、Trivy、CodeQL、文档构建、安全审计与生产构建。

该段只记录本轮历史证据。当前版本与当前门禁状态始终以 workflow 文件和 GitHub Actions 最新运行结果为准。
