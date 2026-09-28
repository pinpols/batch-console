# FE CI / CD Runbook

CI 由 3 个核心门禁、兼容/安全检查和发布辅助 workflow 组成。前端不复制后端容量门禁，浏览器性能由 Lighthouse 与真实 staging 验收负责。

## Workflow 全景

| Workflow | 文件 | 触发 | 角色 | 预估耗时 |
|---|---|---|---|---|
| `pr-gate` | `.github/workflows/pr-gate.yml` | PR → main / push main / 手动 | PR 必过门禁,fast feedback | 5-7 min |
| `frontend-ci` | `.github/workflows/frontend-ci.yml` | PR → main / push main / 手动 | Node 24 兼容 + 前端文档构建 | 8-12 min |
| `full-ci-gate` | `.github/workflows/full-ci-gate.yml` | push main / nightly cron(02:00 UTC = 10:00 Asia/Shanghai)/ 手动 | 全量回归 | 15-20 min |
| `staging-gate` | `.github/workflows/staging-gate.yml` | tag `v*` / 手动(可输入 base_url) | staging 部署前真环境最终关 | 10-15 min |
| `codeql` | `.github/workflows/codeql.yml` | PR / main / 每周 / 手动 | JavaScript/TypeScript 静态安全分析 | 5-10 min |
| `build-image` | `.github/workflows/build-image.yml` | main / tag / 手动 | main 构建不可变镜像；tag 在 staging 通过后晋级同一 digest | 10-30 min |

## pr-gate 详情

```
checkout → setup-node@v5(node 24 + npm cache)
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

## frontend-ci 详情(Node 24 兼容 + 文档)

`frontend-ci` 不再重复 `pr-gate` 的 lint / size / audit 主门禁,只做两件事:

1. **Node 24 兼容构建**:在 Node 24 下跑 `check:version`、`typecheck`、`check:i18n`、`test:unit`、`build`。
2. **统一文档构建**:检出配对后端文档并跑 `npm run docs:build`，确保前后端共享的 `tools/docs-bridge/frontend` 站点可生成，并执行文档 chunk 与搜索索引预算检查。

这样 PR 必过门禁仍由 `pr-gate` 统一承担,Node 新版本兼容和文档站可独立暴露问题,避免同一 PR 出现两套相似 required check 一过一挂。

## full-ci-gate 详情(4 job 并行)

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
tag v* / 手动 ── precheck(URL/账号/healthz/版本必须有效)
                      ├─ e2e-against-staging
                        │   Playwright install --with-deps chromium
                        │   PLAYWRIGHT_BASE_URL = secret.STAGING_URL
                        │   E2E_USERNAME/PASSWORD = secret
                        │   npm run test:e2e:all(含 @slow 的全量场景)
                        │   upload playwright-report artifact
                        │
                        └─ lighthouse-against-staging
                            Lighthouse CI against staging URL
                            阈值同 full-ci(共享 lighthouse-budget.json)
```

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
4. **Lighthouse 阈值统一**(`.github/lighthouse-budget.json`):
   - perf ≥ 0.8 / a11y ≥ 0.9 / SEO ≥ 0.8 / best-practices ≥ 0.85
   - CLS ≤ 0.1 / LCP ≤ 2500ms / FCP ≤ 2000ms / TBT ≤ 300ms

## Secrets 配置(GH repo settings → Secrets)

| Secret | 用途 | 默认 fallback |
|---|---|---|
| `BE_OPENAPI_URL` | 可覆盖 gen:api:check 的后端 OpenAPI 地址 | 默认读取后端 main raw 文件；获取失败直接失败 |
| `STAGING_URL` | staging-gate 的 base URL | 必填,无 fallback |
| `STAGING_E2E_USERNAME` | staging admin 账号 | 必填 |
| `STAGING_E2E_PASSWORD` | staging admin 密码 | 必填 |

## 守护脚本 → workflow 覆盖矩阵

| 守护 | pr-gate | full-ci-gate | staging-gate | 本地 hook |
|---|---|---|---|---|
| `eslint --check` | ✅ | ✅ | — | `.husky/pre-commit` `lint-staged` + `preflight:changed` |
| `prettier --check` | (lint 包含)| (lint 包含) | — | `.husky/pre-commit` `lint-staged` |
| `vue-tsc` typecheck | ✅ | ✅ | — | `preflight:changed`(src 变更) |
| `check-i18n-messages.mjs` | ✅ | ✅(含 build 里二次)| — | `preflight:changed`(src / locale 变更) |
| `check-api-drift.sh` | ✅ | ✅ | — | `preflight:changed`(api / generated types 变更) |
| Vitest 全量 | ✅ | ✅ | — | — |
| Vite build | ✅ (`build:fast`)| ✅ (`build` 完整) | — | — |
| `npm audit` | ✅ prod high+ | ✅ 全量 critical 拒 | — | — |
| Docker build | — | ✅ | — | — |
| Trivy 镜像扫 | — | ✅ CRITICAL 拒 | — | — |
| Lighthouse | — | ✅ against preview | ✅ against staging | — |
| Playwright e2e | — | — | ✅ against staging | — |
| 架构/环境/文档/SBOM | ✅ | ✅ | — | 按 staged 变更选择 |
| Shell 语法 / ShellCheck warning | ✅ | ✅ | — | `npm run check:shell` |
| 文档 chunk / 搜索索引预算 | 统一文档 job | Docker 文档构建 | — | `docs:build` 内置 |
| `check-version-alignment.sh` | ✅ | ✅ | — | `preflight:changed`(package 变更) |
| `docs:build` | 统一文档 job | Docker 文档构建 | — | `preflight:changed`(文档站变更) |

Shell 脚本统一使用 Bash/sh；`check:shell` 同时做语法与 ShellCheck 检查，CI 不再额外安装 zsh。

## 本地按需预检

提交前 `.husky/pre-commit` 会先跑 `lint-staged`,再跑:

```bash
npm run preflight:changed
```

该脚本只读取 staged 文件,按变更范围选择检查:

| 变更范围 | 自动检查 |
|---|---|
| `src/**/*.{vue,ts,tsx}` | `lint:check` + `typecheck` + `check:i18n` |
| `src/locales/**` | `check:i18n` |
| `src/api/**` / `src/types/api.generated.ts` / `src/types/**` | `gen:api:check` |
| `src/**` | 架构边界 + 可维护性限制 |
| `.env*` / Docker / Compose / workflow | 环境变量治理 |
| `.github/workflows/**` | workflow 安全检查 |
| `package.json` / `package-lock.json` | 版本对齐 + SBOM / 许可证漂移 |
| `docs/**` / `tools/docs-bridge/**` / `scripts/docs-*` | 文档链接检查 + 统一文档构建 |
| 用户或部署影响文件 | Changelog 覆盖检查 |

`preflight:changed` 只读取 staged 文件；`preflight:changed:all` 合并 working tree 与未跟踪文件，不再扫描全部 tracked 文件。单测覆盖率、bundle size、audit 可通过 `npm run verify:local` 一次执行；Docker/Trivy、Lighthouse、staging e2e 仍由 CI 分层承担。

## 常见故障 / 排查

| 症状 | 根因 | 修法 |
|---|---|---|
| pr-gate `lint:check` `Definition for rule 'es5/no-es6-methods' was not found` | eslint config 没 ignore vitepress cache | `eslint.config.js` ignore 路径检查 |
| pr-gate `gen:api:check` 漂移 | BE OpenAPI yaml 改了 FE 没跑 gen:api | 本地 `npm run gen:api` + commit `src/types/api.generated.ts` |
| pr-gate `npm audit` 在 CI fail 本地通 | npm registry POST 405(代理) | 本地代理特殊,CI ubuntu-latest 正常 |
| full-ci-gate Trivy 报 CRITICAL | base image 漏洞 | `Dockerfile` 升 base image,或加 `.trivyignore` 临时白名单 |
| full-ci-gate Lighthouse perf < 0.8 | 包体增大 / 慢资源 | 看报告找 LCP / TBT 拖累项,常见:vendor chunk 拆分 / 图片压缩 |
| staging-gate playwright fail | staging 服务挂 / 选择器漂 | 看 playwright-report artifact 截图 / 录屏 |

## 耗时基线(2026-05-23 snapshot)

最近一次成功跑的总耗时与 job 分布。指标用于回归告警:任一 wf 超基线 +50% 需排查。

| Workflow | 总耗时 | 触发 | 目标 | 状态 |
|---|---|---|---|---|
| pr-gate | 1:37 | PR / push | ≤6m | ✅ |
| full-ci-gate | 3:48 | push main / nightly / 手动 | ≤6m | ✅ |
| release-please | 0:12 | push main | ≤6m | ✅ |
| renovate | 1:23 | renovate bot | ≤6m | ✅ |
| staging-gate | 历史基线已失效 | tag v* / 手动 | ≤30m | 缺配置时失败 |

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
