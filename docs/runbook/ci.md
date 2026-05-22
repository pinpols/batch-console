# FE CI / CD Runbook

3 个 GH workflow,对齐 BE 仓 `pr-gate / full-ci-gate / staging-gate` 模式。FE 不需要 `capacity-gate`(无容量压测需求,性能指标走 Lighthouse)。

## Workflow 全景

| Workflow | 文件 | 触发 | 角色 | 预估耗时 |
|---|---|---|---|---|
| `pr-gate` | `.github/workflows/pr-gate.yml` | PR → main / push main / 手动 | PR 必过门禁,fast feedback | 5-7 min |
| `full-ci-gate` | `.github/workflows/full-ci-gate.yml` | push main / nightly cron(02:00 UTC = 10:00 Asia/Shanghai)/ 手动 | 全量回归 | 15-20 min |
| `staging-gate` | `.github/workflows/staging-gate.yml` | tag `v*` / 手动(可输入 base_url) | staging 部署前真环境最终关 | 10-15 min |

## pr-gate 详情(7 步顺序)

```
checkout → setup-node@v4(node 20 + npm cache)
        → npm ci --no-audit --no-fund
        → npm run lint:check       (ESLint check 模式)
        → npm run gen:api:check    (OpenAPI yaml ↔ api.generated.ts 漂移)
        → npm run typecheck        (vue-tsc --noEmit)
        → npm run check:i18n       (zh-CN ↔ en-US 1:1)
        → npm run test:unit        (Vitest 全量)
        → npm run build:fast       (Vite 生产产物)
        → npm audit --omit=dev --audit-level=high
```

并发控制:同 PR `cancel-in-progress: true` 取消过期任务。15 min timeout。

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

## staging-gate 详情(2 job 并行 against staging URL)

```
tag v* / 手动 ─────────┬─ e2e-against-staging
                        │   Playwright install --with-deps chromium
                        │   PLAYWRIGHT_BASE_URL = secret.STAGING_URL
                        │   E2E_USERNAME/PASSWORD = secret
                        │   npm run test:e2e(82 specs)
                        │   upload playwright-report artifact
                        │
                        └─ lighthouse-against-staging
                            Lighthouse CI against staging URL
                            阈值同 full-ci(共享 lighthouse-budget.json)
```

## 关键决策(锁住,不要再翻案)

1. **Playwright e2e 只在 staging-gate 跑**(against 真 staging URL),不在 pr-gate / full-ci-gate 跑
   - 理由:CI 起 BE testcontainers 太脆(需 BE 仓 sibling checkout + docker-compose),业界 Vercel/Netlify 标准做法
   - e2e fail block **staging deploy**,不 block PR merge
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
| `BE_OPENAPI_URL` | gen:api:check 在 CI 拉 raw github yaml | 本地有 sibling 路径优先 |
| `STAGING_URL` | staging-gate 的 base URL | 必填,无 fallback |
| `STAGING_E2E_USERNAME` | staging admin 账号 | 必填 |
| `STAGING_E2E_PASSWORD` | staging admin 密码 | 必填 |

## 守护脚本 → workflow 覆盖矩阵

| 守护 | pr-gate | full-ci-gate | staging-gate | 本地 hook |
|---|---|---|---|---|
| `eslint --check` | ✅ | ✅ | — | `.husky/pre-commit` `lint-staged` |
| `prettier --check` | (lint 包含)| (lint 包含) | — | `.husky/pre-commit` `lint-staged` |
| `vue-tsc` typecheck | ✅ | ✅ | — | — |
| `check-i18n-messages.mjs` | ✅ | ✅(含 build 里二次)| — | — |
| `check-api-drift.sh` | ✅ | ✅ | — | — |
| Vitest 全量 | ✅ | ✅ | — | — |
| Vite build | ✅ (`build:fast`)| ✅ (`build` 完整) | — | — |
| `npm audit` | ✅ prod high+ | ✅ 全量 critical 拒 | — | — |
| Docker build | — | ✅ | — | — |
| Trivy 镜像扫 | — | ✅ CRITICAL 拒 | — | — |
| Lighthouse | — | ✅ against preview | ✅ against staging | — |
| Playwright e2e | — | — | ✅ 82 specs against staging | — |

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
| staging-gate | 0:12 | tag v* / 手动 | ≤6m | ✅ skip(无 STAGING_URL) |

### Job 级分布

**pr-gate(单 job)**
- Lint / Typecheck / Unit / Build:1:32

**full-ci-gate(4 job 并行,瓶颈 Lighthouse)**
- Security audit (full) 0:25 / Static checks + Unit 1:21 / Docker build + Trivy 1:25 / **Lighthouse 2:18** ← critical path

**staging-gate(precheck-only,无 STAGING_URL secret)**
- precheck 4s → Playwright e2e + Lighthouse against staging 双 job skip,workflow 总 12s

### staging-gate skip 机制

precheck job 读 `secrets.STAGING_URL`(或 dispatch input `base_url`)。空 → 输出 `should_run=false`,Playwright + Lighthouse 双 job 跳过,workflow warning(非 failure)。配上 secret 后自动启用 82 specs Playwright + Lighthouse 全量。BE 对应模式见 `../file-batch-system/docs/runbook/ci.md`(2026-05-23 BE 仓 PR #23 对齐)。

---

## 关联文件

- `.github/workflows/*.yml` — 3 个 workflow
- `.github/lighthouse-budget.json` — Lighthouse 阈值
- `package.json` `scripts` — npm 命令源
- `eslint.config.js` — lint ignore 路径(变更目录结构时易漏)
- `playwright.config.cjs` — e2e 配置
- `scripts/check-api-drift.sh` `scripts/check-i18n-messages.mjs` — 校验脚本
- `fe-acceptance` Claude skill — 本地手跑等价验收(对应 BE be-acceptance)
