# FE CI / CD Runbook

CI 由 3 个核心门禁、兼容/安全检查和发布辅助 workflow 组成。前端不复制后端容量门禁，浏览器性能由 Lighthouse 与真实 staging 验收负责。

GitHub Security 告警的分类、修复、误报处理和合并后验证遵循[安全告警治理](./security-alert-governance.md)。CodeQL workflow 成功不等于开放告警已关闭。

## Workflow 全景

| Workflow                         | 文件                                 | 触发                                                                        | 角色                                                                                                                                            | 预估耗时  |
| -------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `pr-gate`                        | `.github/workflows/pr-gate.yml`      | PR → main / push main / 手动                                                | PR 必过门禁,fast feedback                                                                                                                       | 5-7 min   |
| `frontend-ci`                    | `.github/workflows/frontend-ci.yml`  | PR → main / push main / 手动                                                | Node 24 兼容 + 前端文档构建；Markdown-only PR 跳过兼容构建                                                                                      | 8-12 min  |
| `full-ci-gate`                   | `.github/workflows/full-ci-gate.yml` | PR → main / push main / nightly cron(02:00 UTC = 10:00 Asia/Shanghai)/ 手动 | 全量回归；Markdown-only PR 保留 required check 但跳过构建和全量审计                                                                             | 15-20 min |
| `staging-gate`                   | `.github/workflows/staging-gate.yml` | tag `v*` / 手动(可输入 base_url)                                            | 真实环境安全头、Playwright/axe、视觉及跨浏览器路由验收                                                                                          | 20-35 min |
| `codeql`                         | `.github/workflows/codeql.yml`       | PR / main / 每周 / 手动                                                     | JavaScript/TypeScript 静态安全分析                                                                                                              | 5-10 min  |
| `build-image`                    | `.github/workflows/build-image.yml`  | main / tag / 每日 19:00 UTC(北京时间 03:00) / 手动                          | main 构建不可变镜像；nightly 按前后端代码变更决定是否构建，后端有变更时等待配对后端 daily sim-strict 成功；tag 在 staging 通过后晋级同一 digest | 10-75 min |
| `Quarterly dependency inventory` | `.github/workflows/renovate.yml`     | 每季度 / 手动                                                               | 只生成 Renovate dry-run 盘点和一张 Issue，不创建 PR                                                                                             | 5-15 min  |

## pr-gate 详情

```
checkout@v7 → setup-node@v7(node 24 + npm cache)
        → npm ci --no-audit --no-fund
        → npm run check:version
        → npm run lint:check       (ESLint check 模式)
        → npm run gen:api:check    (OpenAPI yaml ↔ api.generated.ts 漂移)
        → npm run typecheck        (vue-tsc --noEmit)
        → npm run check:i18n       (zh-CN ↔ en-US 1:1)
        → architecture / env / maintainability / workflow / shell / docs / SBOM governance
        → npm run test:unit -- --coverage
        → npm run build:fast       (Vite 生产产物)
        → npm run size
        → npm audit --omit=dev --audit-level=high
```

并发控制:同 PR `cancel-in-progress: true` 取消过期任务。15 min timeout。

业务与规范检查采用失败聚合模式：单项失败会记录稳定错误码并继续执行其余独立检查，
job 末尾一次性列出全部失败并返回非零。checkout、Node 安装、`npm ci` 等后续检查
无法继续的基础环境步骤仍立即失败。本地 `npm run verify:local` 使用相同汇总行为。

### 快速失败与失败汇总边界

| 入口 | 失败行为 | 继续/停止边界 |
|---|---|---|
| `npm run preflight:changed` / `preflight:changed:all` | 对本次变更选出的检查按顺序执行，首个失败立即返回 | 提交前快速反馈；修复后重跑即可，不承诺收集后续检查结果 |
| PR `pr-gate`、`full-ci-gate` 和 `frontend-ci` 的静态/Node 兼容步骤 | `run-gate.sh` 在 `BATCH_GATE_COLLECT=1` 下记录单项结果并继续；`verify-governance.sh` 收集其内部独立门禁；各 job 末尾 `gate_assert_collected` 汇总并非零退出 | 同一 job 的独立 lint、配置、测试、构建等门禁尽量收齐；安装、checkout、运行时等前置步骤失败仍会阻断依赖它们的阶段 |
| `npm run verify:local` | `scripts/ci.sh` 聚合独立检查并在结尾返回总结果 | 真实依赖/环境准备失败、必须依赖前序产物的步骤失败时，不执行依赖阶段 |
| `frontend-ci` 的文档构建、`staging-gate` 的环境预检与浏览器验收 | job/步骤按依赖关系失败即停止 | 文档站构建或真实环境预检失败时，不继续执行依赖该结果的发布/浏览器验收；不把未执行阶段算通过 |

门禁判定的拦截与放行示例见下方覆盖矩阵和 [测试事实来源约定](../testing/README.md#91-测试数据与配置来源)。

### 派生产物与人工维护边界

- `package.json` / `package-lock.json` 已暂存且没有同文件未暂存改动时，pre-commit 会自动重建并暂存前端 SBOM 与第三方许可证清单；CI 只读比对，不在机器人账号下回写 PR。
- `src/types/api.generated.ts` 可确定性生成，但权威输入位于配对后端仓库。接口契约变更仍由开发者确认后执行 `npm run gen:api`，避免本地后端分支或远端下载源被静默带入提交。
- Changelog、环境变量 owner/phase、可维护性基线、bundle/Lighthouse 预算、视觉快照和许可证证据覆盖需要语义或风险判断，门禁只负责提示漂移，不自动放宽或改写。

### Action 版本基线

CI 使用 GitHub 托管的 `ubuntu-26.04`，Action 运行时统一到 Node 24 兼容主版本。禁止使用浮动的 `ubuntu-latest`，避免 GitHub 分阶段迁移镜像时同一分支出现不同系统环境：

`actionlint` 1.7.12 的内置标签表尚未收录 `ubuntu-26.04`，因此 `.github/actionlint.yaml` 临时登记该标签；升级到已原生识别此标签的 actionlint 后应删除兼容项。

- `actions/checkout` v7、`actions/setup-node` v7
- `actions/upload-artifact` v7、`actions/download-artifact` v8
- `docker/setup-qemu-action` v4、`docker/setup-buildx-action` v4
- `docker/login-action` v4、`docker/metadata-action` v6、`docker/build-push-action` v7
- `googleapis/release-please-action` v5、`renovatebot/github-action` v46.3.6

上述版本仅用于阅读；workflow 实际引用必须是对应的 40 位 commit SHA。Node 基线由 `.node-version`/`.nvmrc` 固定到精确 patch，Dockerfile 基础镜像固定 tag + digest。

artifact 上传下载升级后，必须手动运行一次 `full-ci-gate`，确认 `static-and-unit` 上传的 `dist` 能在 `lighthouse` job 下载、解压并启动预览；仅通过 workflow 语法检查不算闭环验证。

## frontend-ci 详情(Node 24 兼容 + 文档)

`frontend-ci` 不再重复 `pr-gate` 的 lint / size / audit 主门禁,只做两件事:

1. **Node 24 兼容构建**:在 Node 24 下跑 `check:version`、`typecheck`、`check:i18n`、`test:unit`、`build`。
2. **统一文档构建**:检出配对后端文档并跑 `npm run docs:build`，确保前后端共享的 `tools/docs-bridge/frontend` 站点可生成，并执行文档 chunk 与搜索索引预算检查。

这样 PR 必过门禁仍由 `pr-gate` 统一承担,Node 新版本兼容和文档站可独立暴露问题,避免同一 PR 出现两套相似 required check 一过一挂。

## full-ci-gate 详情(4 个执行 job 并行 + 1 个范围探测 job)

PR 进入 workflow 后先执行 `Detect change scope`。仅包含 Markdown、`docs/**` 或 `.agents/**` 的 PR 会跳过 `Static checks + Unit` 和 `Security audit (full)` 两个重 job；required check 以 skipped-success 状态回报，不改变 main push / nightly / 手动运行的全量门禁。包含 workflow、脚本、配置、源码、依赖或部署文件的 PR 仍完整执行。

```
                         ┌─ static-and-unit ──→ upload dist artifact
                         │   (full build with i18n + typecheck)
push main / nightly ────┤
                         ├─ docker-and-scan (needs static-and-unit)
                         │   Docker build + Trivy CRITICAL block
                         │   + HIGH+CRITICAL SARIF report upload
                         │
                         ├─ lighthouse (needs static-and-unit)
                         │   Download dist + vite preview + Lighthouse CI
                         │   阈值见 .github/lighthouse-budget.json
                         │
                         └─ security-audit
                             全量 npm audit JSON → critical 挡 / high warning
                             报告上传 artifact
```

## staging-gate 详情

```
tag v* / 手动 ── precheck(URL/账号/healthz/部署安全头/版本必须有效)
                      ├─ e2e-against-staging
                        │   Playwright install --with-deps chromium
                        │   PLAYWRIGHT_BASE_URL = secret.STAGING_URL
                        │   E2E_USERNAME/PASSWORD = secret
                        │   npm run test:e2e:all(含 @slow 的全量场景)
                        │   键盘与 axe 基线在 Chromium 验收
                        │   安装 Firefox/WebKit 后运行 smoke.spec.ts @cross-browser
                        │   覆盖 Chromium / Firefox / WebKit / Pixel 5
                        │   upload playwright-report artifact
                        │
                        └─ lighthouse-against-staging
                            Lighthouse CI against staging URL
                            阈值同 full-ci(共享 lighthouse-budget.json)
```

`precheck` 使用 `scripts/check-security-headers.mjs` 对 `/`、`/login` 和 `/healthz` 发起真实 HTTP 请求，验证最终响应的 CSP 基线、安全响应头及 HTTPS HSTS。该检查验证部署后的响应，不替代 Nginx 配置审查或渗透测试。

## 关键决策(锁住,不要再翻案)

1. **Playwright e2e 只在 staging-gate 跑**(against 真 staging URL),不在 pr-gate / full-ci-gate 跑
   - 理由:CI 起 BE testcontainers 太脆(需 BE 仓 sibling checkout + docker-compose),业界 Vercel/Netlify 标准做法
   - e2e fail block **release image promotion**,不 block PR merge
   - 接口契约破坏由 `gen:api:check` + BE 仓 pr-gate 兜
2. **Trivy 镜像扫只挡 CRITICAL**,HIGH 出 SARIF 报告但不 fail build
   - 理由:HIGH 几乎不可避免有 zero-day 噪音,挡 build 会假死
3. **npm audit 双层**:
   - pr-gate:`--omit=dev --audit-level=high`(只 prod 依赖 + high+critical)
   - full-ci-gate:全量(含 dev),critical 挡 / high warning
   - SBOM 同时覆盖运行与开发依赖；AGPL/GPL/SSPL/BUSL/CPAL/EUPL、Commons Clause、Elastic、PolyForm 直接阻断，未知许可证也阻断，只有精确包版本和可复核证据可以覆盖缺失元数据。
4. **Lighthouse 阈值统一**(`.github/lighthouse-budget.json`):
   - perf ≥ 0.8 / a11y ≥ 0.9 / SEO ≥ 0.8 / best-practices ≥ 0.85
   - CLS ≤ 0.1 / LCP ≤ 2500ms / FCP ≤ 2000ms / TBT ≤ 300ms

## Secrets 配置(GH repo settings → Secrets)

| Secret                 | 用途                                     | 默认 fallback                                |
| ---------------------- | ---------------------------------------- | -------------------------------------------- |
| `BE_OPENAPI_URL`       | 可覆盖 gen:api:check 的后端 OpenAPI 地址 | 默认读取后端 main raw 文件；获取失败直接失败 |
| `STAGING_URL`          | staging-gate 的 base URL                 | 必填,无 fallback                             |
| `STAGING_E2E_USERNAME` | staging admin 账号                       | 必填                                         |
| `STAGING_E2E_PASSWORD` | staging admin 密码                       | 必填                                         |

## 守护脚本 → workflow 覆盖矩阵

| 守护                            | pr-gate           | full-ci-gate        | staging-gate       | 本地 hook                                               |
| ------------------------------- | ----------------- | ------------------- | ------------------ | ------------------------------------------------------- |
| `eslint --check`                | ✅                | ✅                  | —                  | `.husky/pre-commit` `lint-staged` + `preflight:changed` |
| `prettier --check`              | (lint 包含)       | (lint 包含)         | —                  | `.husky/pre-commit` `lint-staged`                       |
| `vue-tsc` typecheck             | ✅                | ✅                  | —                  | `preflight:changed`(src 变更)                           |
| `check-i18n-messages.mjs`       | ✅                | ✅(含 build 里二次) | —                  | `preflight:changed`(src / locale 变更)                  |
| `check-api-drift.sh`            | ✅                | ✅                  | —                  | `preflight:changed`(api / generated types 变更)         |
| Vitest 全量                     | ✅                | ✅                  | —                  | —                                                       |
| Vite build                      | ✅ (`build:fast`) | ✅ (`build` 完整)   | —                  | —                                                       |
| `npm audit`                     | ✅ prod high+     | ✅ 全量 critical 拒 | —                  | —                                                       |
| Docker build                    | —                 | ✅                  | —                  | —                                                       |
| Trivy 镜像扫                    | —                 | ✅ CRITICAL 拒      | —                  | —                                                       |
| Lighthouse                      | —                 | ✅ against preview  | ✅ against staging | —                                                       |
| Playwright e2e                  | —                 | —                   | ✅ against staging | —                                                       |
| 架构/环境/文档/SBOM/许可证      | ✅                | ✅                  | —                  | 按 staged 变更选择                                      |
| 测试 fixture 事实来源 (`check:test-fixture-sources`) | ✅ (`verify-governance.sh`) | ✅ (`verify-governance.sh`) | — | `src/**` 变更时由 `preflight:changed` 触发 |
| Shell 语法 / ShellCheck warning | ✅                | ✅                  | —                  | `npm run check:shell`                                   |
| 文档 chunk / 搜索索引预算       | 统一文档 job      | Docker 文档构建     | —                  | `docs:build` 内置                                       |
| 上线准入文档覆盖                | ✅                | ✅                  | —                  | `preflight:changed`(文档变更)                           |
| `check-version-alignment.sh`    | ✅                | ✅                  | —                  | `preflight:changed`(package 变更)                       |
| `docs:build`                    | 统一文档 job      | Docker 文档构建     | —                  | `preflight:changed`(文档桥接、站点配置或构建脚本变更)   |

Shell 脚本统一使用 Bash/sh；`check:shell` 同时做语法与 ShellCheck 检查，CI 不再额外安装 zsh。

## 门禁结果格式

CI workflow 和本地聚合门禁统一通过 `scripts/ci/run-gate.sh` /
`scripts/lib/gate-result.sh` 输出最终状态行：

```text
✅ 通过 | code=FE_VERSION | gate=版本对齐 | exit_code=0
❌ 不通过 | code=FE_VERSION | gate=版本对齐 | exit_code=1
```

状态行固定包含状态、`code`、`gate` 和 `exit_code`，后续可追加 `reason`、`files`、
`version` 等诊断字段。扫描器明细、测试进度、构建日志和人工排查提示不强行改成状态行，
但每个门禁脚本的最终结论必须可被人和机器稳定识别。

## 本地按需预检

提交前 `.husky/pre-commit` 会先跑 `lint-staged`,再跑:

```bash
npm run preflight:changed
```

该脚本只读取 staged 文件,按变更范围选择检查:

| 变更范围                                                     | 自动检查                                  |
| ------------------------------------------------------------ | ----------------------------------------- |
| `src/**/*.{vue,ts,tsx}`                                      | `lint:check` + `typecheck` + `check:i18n` |
| `src/locales/**`                                             | `check:i18n`                              |
| `src/api/**` / `src/types/api.generated.ts` / `src/types/**` | `gen:api:check`                           |
| `src/**`                                                     | 架构边界 + 可维护性限制                   |
| `.env*` / Docker / Compose / workflow                        | 环境变量治理                              |
| `.github/workflows/**`                                       | workflow 安全检查                         |
| `package.json` / `package-lock.json`                         | 版本对齐 + SBOM / 许可证漂移              |
| `docs/**` / `tools/docs-bridge/**` / `scripts/docs-*`        | 文档链接检查 + 统一文档构建               |
| 用户或部署影响文件                                           | Changelog 覆盖检查                        |

`preflight:changed` 只读取 staged 文件；`preflight:changed:all` 合并 working tree 与未跟踪文件，不再扫描全部 tracked 文件。普通 `docs/**` 变更只执行链接、路径和上线准入检查；只有文档桥接、站点配置或构建脚本变化才在本地执行完整 `docs:build`，统一文档 CI 继续对所有文档交付做构建兜底。单测覆盖率、bundle size、audit 可通过 `npm run verify:local` 一次执行；Docker/Trivy、Lighthouse、staging e2e 仍由 CI 分层承担。

## 常见故障 / 排查

| 症状                                                                          | 根因                                    | 修法                                                         |
| ----------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| pr-gate `lint:check` `Definition for rule 'es5/no-es6-methods' was not found` | eslint config 没 ignore vitepress cache | `eslint.config.js` ignore 路径检查                           |
| pr-gate `gen:api:check` 漂移                                                  | BE OpenAPI yaml 改了 FE 没跑 gen:api    | 本地 `npm run gen:api` + commit `src/types/api.generated.ts` |
| pr-gate `npm audit` 在 CI fail 本地通                                         | npm registry POST 405(代理)             | 本地代理特殊，CI `ubuntu-26.04` 正常                         |
| full-ci-gate Trivy 报 CRITICAL                                                | base image 漏洞                         | `Dockerfile` 升 base image,或加 `.trivyignore` 临时白名单    |
| full-ci-gate Lighthouse perf < 0.8                                            | 包体增大 / 慢资源                       | 看报告找 LCP / TBT 拖累项,常见:vendor chunk 拆分 / 图片压缩  |
| staging-gate playwright fail                                                  | staging 服务挂 / 选择器漂               | 看 playwright-report artifact 截图 / 录屏                    |

## 耗时基线(2026-05-23 snapshot)

最近一次成功跑的总耗时与 job 分布。指标用于回归告警:任一 wf 超基线 +50% 需排查。

| Workflow       | 总耗时         | 触发                       | 目标 | 状态         |
| -------------- | -------------- | -------------------------- | ---- | ------------ |
| pr-gate        | 1:37           | PR / push                  | ≤6m  | ✅           |
| full-ci-gate   | 3:48           | push main / nightly / 手动 | ≤6m  | ✅           |
| release-please | 0:12           | push main                  | ≤6m  | ✅           |
| renovate       | 1:23           | renovate bot               | ≤6m  | ✅           |
| staging-gate   | 历史基线已失效 | tag v* / 手动              | ≤30m | 缺配置时失败 |

### Job 级分布

**pr-gate(单 job)**

- Lint / Typecheck / Unit / Build:1:32

**full-ci-gate(4 job 并行,瓶颈 Lighthouse)**

- Security audit (full) 0:25 / Static checks + Unit 1:21 / Docker build + Trivy 1:25 / **Lighthouse 2:18** ← critical path

**staging-gate(配置完整时)**

- precheck 校验 URL、账号、健康状态与发布版本；配置缺失或版本不匹配会直接失败，不允许跳过发布验收

### staging-gate 发布语义

precheck 读取 `STAGING_URL`、测试账号并校验 `/healthz`。tag 发布还要求 `/version.json.gitSha` 与 tag commit 一致。任一条件不满足即失败；`build-image` 只在该 commit 的 staging run 成功后给既有 `sha-*` 镜像增加版本标签。

---

## 关联文件

- `.github/workflows/*.yml` — 核心门禁、兼容、安全和发布工作流
- `.github/lighthouse-budget.json` — Lighthouse 阈值
- `package.json` `scripts` — npm 命令源
- `eslint.config.js` — lint ignore 路径(变更目录结构时易漏)
- `playwright.config.cjs` — e2e 配置
- `scripts/check-api-drift.sh` `scripts/check-i18n-messages.mjs` — 校验脚本
- `fe-acceptance` Agent skill — 本地手跑等价验收(对应 BE be-acceptance)
