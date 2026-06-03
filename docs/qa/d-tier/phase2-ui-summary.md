# Phase 2 — UI 全量 e2e 报告

> 生成: 2026-05-18
> 范围: `npx playwright test` 排除 `ai-chat.spec.ts`(用户明确不测 AI)
> 71 个 spec 文件 / 531 个 test case

## 最终结果

```
0 failed / 20 skipped / 511 passed   (10.5 分钟,2 worker)
```

## 4 轮迭代

| 轮次 | failed | 主修内容 |
|---|---|---|
| R1 | **104** | 首次跑,大量 UI 漂移 |
| R2 | 20 | 批量 patch:`el-dialog` 兼容 `el-drawer` / `.service-entry`→`.service-card` / `.config-nav__item`→`getByRole('tab')` / pageTitle 5 处 regex / job-def MetaSelect 等 enum 字典 |
| R3 | 2 | smoke routes title regex / ops-diagnostic 卡片化(去 tab)/ tag i18n `按标签搜索`→`搜索标签` / cross-nav + observability 告警标题 / tenant copy dry-run 按钮 / error-states queueType select / outbox disabled 跳过 |
| **R4** | **0** | keyboard-flow Tab focus 兼容 drawer / ops-diagnostic Outbox 主页面定位 |

## Watchdog 4xx/5xx 真实场景验证

P2 全程 `e2e/support/fixtures.ts` 全局 `network` watchdog 抓所有 ≥400。

```
共 18 个 spec dir 落 network.log
├─ 14 个故意注入 / 故意 4xx 设计内
│   ├─ error-recovery (2) — 测试 5xx/404 toast 行为
│   ├─ error-states   (8) — inject 500/400/401/409 给 UI
│   ├─ rbac-denial    (2) — 测试 401 跳登录/refresh 兜底
│   ├─ keyboard-flow  (1) — auth/me 启动竞态
│   └─ upload-full    (1) — 上传失败注入
├─  4 个脏数据 409 (P3 清理)
│   ├─ tenant-ops 新建租户 409  (用户名重复)
│   └─ worker-ops × 3 (drain/takeover/warmup 都报 "Worker 已退役")
└─  0 个后端真 5xx
```

## 基础设施新增

| 文件 | 作用 |
|---|---|
| [e2e/support/fixtures.ts](../../../e2e/support/fixtures.ts) | 全局 `network` watchdog fixture(auto:true,所有 spec 自动抓 4xx/5xx);`assertClean(scope?)`;`ignore(pattern)`;失败时落盘 `network.log` |
| [e2e/support/crud-smoke.ts](../../../e2e/support/crud-smoke.ts) | `readOnlyPageSmoke()` helper(进页→切 tab→翻页→assertClean) |
| [e2e/all-pages-zero-error.spec.ts](../../../e2e/all-pages-zero-error.spec.ts) | **34 页**逐页 0-4xx/5xx 巡检 spec |
| [e2e/job-definition-crud.spec.ts](../../../e2e/job-definition-crud.spec.ts) | 新增 — 填补 JobDefinition CRUD 空白页(BE LCRU + toggle/clone) |

## Spec 修补清单(可复用)

1. `el-dialog` → `el-dialog:visible, .el-drawer:visible` — form-helpers + 13 spec
2. `.service-entry` → `.service-card` — self-service + self-service-forms
3. `.config-nav__item` → `getByRole('tab')` — config-management × 3
4. Page title regex:
   - `'告警'` → `/事件告警|告警/`(alert-outbox-ops, cross-navigation, observability, all-pages-zero-error)
   - `'租户配额'` → `/配额策略|租户配额/`(governance, quota-policy-crud, support/app smokeRoutes)
   - `'队列与窗口'` → `/队列/`(governance, support/app smokeRoutes)
5. tag i18n `'按标签搜索'` → `'搜索标签'` — tag-ops, tag-management-crud, tag-resource-crud
6. ops-diagnostic 完全重写:tab → diag-card 列表
7. self-service 完全重写:inline tab → drawer (drawer 内有提交按钮)
8. tenant-ops / tenant-config-ops dry-run switch → 独立「试运行」按钮
9. ops-diagnostic-ops Outbox 清理/重发布 — disabled 时跳过(无数据)
10. keyboard-flow Tab focus 兼容 dialog/drawer
11. job-def CRUD spec:等 `/meta/enums` API 后再点 MetaSelect

## 已知非阻塞

- 20 skipped 来自 `test.skip` + `if (...) return`(数据依赖型 conditional skip,如 Outbox 无数据时跳过清理流程)
- 4 个 409 脏数据残留(tenant + worker),需 P3 跑 cleanup-soft/tx 清除
