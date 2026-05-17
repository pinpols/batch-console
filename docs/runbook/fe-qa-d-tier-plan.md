# D 档 QA 完整覆盖 — 测试方案

> 衔接 [fe-qa-c-tier-plan.md](./fe-qa-c-tier-plan.md) 出口标准已 PASS(466/16/0)。
> 本档目标:**移动端操作 / 多浏览器 / 上传完整链路 / 长会话稳定性**。
> **预估**:4–5 天(净工时 20–28 h)。

---

## 目标 & 不做什么

**目标**

1. 把现有移动端冒烟(9 路由可打开)推到「移动端操作矩阵」:approve/reject/retry/republish/filter/bulk/detail-nav 7 个高频操作至少 1 spec/页。
2. 把 Playwright projects 从「单 chromium」扩到「chromium + firefox + webkit」三浏览器矩阵,CI-friendly。
3. 把「Excel 导入」的 happy-path 从「上传 → token」扩到「上传 → preview → apply → 状态轮询 → 审计可见」完整链路。
4. 建一份 soak/长会话 baseline:连续路由切换 + 列表加载 + Dialog 开关 200 次,确认无内存/句柄/console error 累积。

**不做什么**(留人工抽测 / 后续档)

- iOS 真机抓包(webkit 模拟器够用即可)
- 性能基线 / Lighthouse 自动跑(独立专题)
- 大文件上传(>100MB)/ 分片上传抖动(BE 验收专题)
- 长链路 outbox/CDC 端到端(BE 集成测专题)

---

## 现状盘点(开工前已知)

| 维度 | baseline | 缺口 |
|---|---|---|
| **移动端** | `mobile-smoke.spec.ts` 9 路由可打开,no pageerror | 操作未覆盖:approve/reject(MApprovals)/bulk retry(MJobInstances)/republish(MOutbox)/filter(MJobInstances/MOutbox/MFileList) |
| **多浏览器** | `playwright.config.cjs:projects` 只有 chromium | firefox/webkit 全未跑 |
| **上传链路** | `excel-import.spec.ts:上传→uploadToken` | preview 结果断言、apply 后状态轮询、审计 entry 出现都没断言;非依赖 BE 的 mock-link 也没建 |
| **soak** | 无 | 无内存基线、无长会话 spec |

---

## 优先级矩阵

**P0 — 必覆盖**

| 项 | 选入理由 |
|---|---|
| `mobile-ops.spec.ts` MApprovals approve/reject + 列表加载 | 移动 oncall 主要使用路径 |
| `mobile-ops.spec.ts` MJobInstances 筛选 + bulk retry + 详情进入 | 移动主流量页 |
| `mobile-ops.spec.ts` MOutbox 筛选 + republish | 失败重投高频 |
| `mobile-ops.spec.ts` MFileList 筛选 | 文件查找 |
| `mobile-ops.spec.ts` MCatchUp 列表显示(approve/reject 当前 BE 缺 approvalNo,占位) | 见 [[mcatchup_pending_be]] |
| `multi-browser` chromium + firefox + webkit project 拆分 | 同样的核心 smoke + a11y 跨三浏览器 |
| `upload-full-chain.spec.ts` 上传 → 预览结果可见 → apply → 状态轮询 → 审计 | 进生产前最危险的"看似 PASS,实际 BE 没消化"路径 |
| `soak.spec.ts` 200 轮路由切换 + 内存/error 累积监控 | 长会话稳定性,oncall 8h 不刷新场景 |

**P1 — 强烈建议**

- i18n 切换稳定性(zh↔en 在 5 个 P0 页连切 10 次,UI 不残留)
- 权限矩阵全跑:5 个真实角色 × 全菜单 403/200 矩阵(基于 [[rbac_5roles_only]])

**P2 — 顺手做**

- mobile pull-refresh 行为单测(确认 MPullRefresh 不重叠请求)
- multi-browser 仅跑 smoke + a11y(全量跨浏览器成本太高,选择性跑)

---

## 四个维度的检查清单

### 1. mobile-ops(移动操作)

每个 P0 mobile 页跑下面的子矩阵:

| 子项 | 期望 | 失败信号 |
|---|---|---|
| 列表初次加载 skeleton → 数据 | skeleton 消失,m-card 出现 OR m-empty | skeleton 不消失 / 永挂 loading |
| 顶部下拉刷新(pull-to-refresh) | load() 重新调一次 | 双调 / 不调 |
| 筛选条件变更 → 列表自动重查 | onFilterChange 触发 query | 改了条件不响应 |
| 主操作按钮(approve/reject/retry/republish) | toast 成功 + 行从列表消失或状态翻转 | toast 不显示,状态不变 |
| 列表为空时 | m-empty 文案显示,操作按钮不可见 | 报错 / 空 div |
| 列表行点击进入详情 | URL 跳 /m/jobs/:id 等 | 不跳 / 跳错 |

每页用 `page.route('**/api/console/**')` 注入 mock 数据,**不**依赖 BE。

### 2. multi-browser(多浏览器矩阵)

```js
// playwright.config.cjs
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
]
```

约定:
- 默认 `npx playwright test` 仍只跑 chromium(避免本地 dev 慢)
- 跨浏览器跑用 `npx playwright test --project=firefox --project=webkit -g "@cross-browser"`
- 标记关键 spec 加 `test.describe('@cross-browser ...', ...)`,精选 ~30 case 而非全跑

### 3. upload-full-chain(上传完整链路)

阶段 + 断言:

| 阶段 | 断言 |
|---|---|
| 选择文件 | `.upload-zone__file-name` 显示,「开始上传」按钮 enabled |
| 开始上传 | POST /api/console/excel/upload 调用一次,响应 uploadToken |
| token alert 出现 | `.excel-wizard__token-alert` 可见,token 长度 > 16 |
| 进预览步骤 | 步骤指示器 step 2 active |
| 拉预览 | POST /api/console/excel/preview 调用,返回 sheets 数据 |
| 预览结果可见 | 至少 1 个 `.el-table__row` 或 summary `tenant: X, queues: Y` |
| 进 apply 步骤 | 步骤指示器 step 3 active,确认按钮 enabled |
| 确认应用 | POST /api/console/excel/apply 调用,响应 jobId |
| 状态轮询 | GET /api/console/excel/status/:jobId 至少 1 次,响应 SUCCEEDED |
| 审计 entry | GET /api/observability/audits 查询包含 importId,见 1 条新 entry |

非 BE 依赖:用 `page.route` mock 全链路;BE 依赖:env `E2E_REAL_BE=1` 跑真链路。

### 4. soak(长会话稳定性)

```ts
// 在单 browser context 内连续 200 轮:
// - goto /ops/summary → /monitor/job-instances → /governance/queues → open dialog → close → 回 summary
// 监控:
// - console.error 累积 < 5
// - page.errors() 全程 0
// - performance.memory.usedJSHeapSize(若可获取)增长 < 50MB
// - localStorage size 无单 key 增长 > 100KB
```

可调参数:`SOAK_ROUNDS=200`(默认 50,CI 跑 200,本地不烦)。

---

## 执行节奏(4.5 天)

**Day 1 — mobile-ops baseline + spec**

- 写 `e2e/mobile-ops.spec.ts`,P0 5 个 mobile 页 × 4 子用例
- mock 路由统一抽 `support/mobile-mocks.ts`
- 跑通,产物记到 `qa-d-mobile-report.md`

**Day 2 — multi-browser 扩 + 关键 spec 选标**

- 改 `playwright.config.cjs`:加 firefox/webkit/mobile-chrome projects
- 给 `smoke.spec.ts`/`a11y.spec.ts`/`mobile-smoke.spec.ts` 关键用例加 `@cross-browser` tag
- 装 webkit 浏览器(`npx playwright install webkit firefox`)
- 跑 chromium / firefox / webkit 各一遍,矩阵记到 `qa-d-multi-browser-report.md`

**Day 3 — upload-full-chain**

- 写 `e2e/upload-full-chain.spec.ts`,mock 全链路(BE 缺位也可跑绿)
- BE 联调跑一次真链路(`E2E_REAL_BE=1`),抓真实预览输出贴报告
- 失败的 BE 缺口写到 [[fe-be-joint-test-report]] 续

**Day 4 — soak + i18n 切换稳定**

- 写 `e2e/soak.spec.ts` 200 轮长会话
- 写 `e2e/i18n-switch-stability.spec.ts` 5 P0 页 × 10 次切换
- 跑通,内存 / error 累积截图存档

**Day 0.5 — 收尾报告**

- 输出 `docs/runbook/fe-qa-d-tier-report.md`:四维度红绿矩阵 + 跨浏览器差异 list
- 把发现的真 bug PR / commit 关联

---

## 失败记录格式

```
### [mobile-ops / multi-browser / upload / soak / i18n-switch] <page> - <case>
- repro: <最小操作步骤 OR spec 文件:行号>
- expected: ...
- actual: ...
- 浏览器: chromium / firefox / webkit
- 推测原因: ...
- 修复 PR / commit: ...
```

---

## 风险清单

| 风险 | 缓解 |
|---|---|
| webkit 模拟器与真 Safari 行为差异 | 报告里标注"模拟器,真机回归留 release pre-flight" |
| 长 soak 跑时 dev server 内存爆 | soak spec 用 `--reuse-existing-server` 跑 production build (`npm run preview`) 而非 `npm run dev` |
| BE 不可用导致 upload 链路 spec 全 skip | 默认 mock-mode,`E2E_REAL_BE=1` 才走真 BE |
| mobile-chrome project 与现有 mobile-smoke 重复 | mobile-smoke 用 `test.use({ ...Pixel5 })`,改为通过 project 选,统一一处 |

---

## 出口标准(Done = ?)

- [ ] `e2e/mobile-ops.spec.ts` ≥ 20 case PASS
- [ ] `playwright.config.cjs` 4 projects 可选跑,关键用例 @cross-browser 标记
- [ ] `e2e/upload-full-chain.spec.ts` mock-mode 100% PASS,真 BE 单跑 1 次抓快照
- [ ] `e2e/soak.spec.ts` 50 轮(默认)PASS,200 轮(SOAK)PASS
- [ ] `docs/runbook/fe-qa-d-tier-report.md` 红绿矩阵 + bug list

---

## 后续档(E 档预告,不在本次)

| 项 | 预估 |
|---|---|
| 性能 / Lighthouse 基线(LCP/FID/CLS) | 1 天 |
| 大文件上传(>100MB)+ 网络抖动 | 0.5 天 |
| 真机 iOS Safari / Android Chrome 回归 | 0.5 天 release pre-flight |
| 国际化扩展语种(en/zh 之外)抽 1 个 | 0.5 天 |
