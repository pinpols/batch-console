# D 档 QA 阶段报告

> 目标:真实场景不会报错 4xx/5xx;前端短联合调试结束;所有 CRUD 接口覆盖(除 AI)
> 流程:Phase 1 (API 直打) → Phase 2 (UI 真实场景全量) → Phase 3 (真实用户行为闭环 + 清理)
> 基础设施:`e2e/support/fixtures.ts` 全局 network watchdog + `e2e/all-pages-zero-error.spec.ts` 34 页 0-4xx 巡检
> 生成: 2026-05-18

## 阶段索引

| Phase | 范围 | 状态 | 报告 |
|---|---|---|---|
| **P1-API** | curl 直打 BE 22 实体 CRUD | ✅ **62/0 全绿** | [phase1-api-crud-stdout.log](phase1-api-crud-stdout.log) |
| **P1-Boundary** | 边界值矩阵(应 400 不应 500) | ✅ **25/0 全绿** | [phase1-boundary.md](phase1-boundary.md) |
| **P1-RBAC** | 6 角色 × tenant-switch | ✅ **6/6 符合预期** | [phase1-rbac.md](phase1-rbac.md) |
| **P2-UI** | playwright 全量 (排除 ai-chat) | ✅ **0 fail / 20 skip / 511 pass** | [phase2-ui-summary.md](phase2-ui-summary.md) |
| **P3-Journey** | 跨页真实用户 CRUD 闭环 | ✅ **9/9 全过 0 4xx/5xx** | [phase3-journey.md](phase3-journey.md) |
| **P4-Mobile-RealBE** | 移动端真 BE 联调 | ✅ **13/0 全过 + 6 空态 skip** | [phase4-mobile-real-be.md](phase4-mobile-real-be.md) |
| **P5-API-Full** | 全 endpoint 扫描(302 个) | ✅ **218/0 全过 (83% 覆盖)** | [phase5-api-full-coverage.md](phase5-api-full-coverage.md) |
| **P5-Final** | 最终联调总评 + BE/seed 修复 | ✅ **867/0 + 0 真 5xx** | [phase5-final-summary.md](phase5-final-summary.md) |
| **P5b-Replication** | 主从断 11 天 → dev 止血 + prod 监控 + BE lag-aware | ✅ 落地 4 alert + BE 兜底 | [phase5b-replication-fix.md](phase5b-replication-fix.md) |

## 总评

```
Phase 1 API:    62/0     22 实体 × CRUD
Phase 1 边界值: 25/0     enum + 字段边界
Phase 1 RBAC:   6/6      角色权限矩阵
Phase 2 UI:     511/0   71 spec / 531 case(20 conditional skip)
Phase 3 闭环:    9/0     跨 9 页面 CRUD,全程 0 unignored 4xx/5xx
```

**目标对照**

| 目标条件 | 验证 |
|---|---|
| 真实场景不会报错 4xx/5xx | ✅ watchdog 抓 0 真后端 5xx;故意注入/脏数据 409 都已分类 |
| 前端短联合调试结束 | ✅ 4 轮迭代 104→20→2→0 |
| 所有 CRUD 接口覆盖(除 AI) | ✅ API 层 22 实体 + UI 层 71 spec;`/system/ai-chat` 已排除 |

## 关键基础设施

| 文件 | 作用 |
|---|---|
| [e2e/support/fixtures.ts](../../../e2e/support/fixtures.ts) | 全局 `network` watchdog,所有 spec 自动抓 ≥400,失败时落 `network.log` |
| [e2e/support/crud-smoke.ts](../../../e2e/support/crud-smoke.ts) | `readOnlyPageSmoke()` helper |
| [e2e/all-pages-zero-error.spec.ts](../../../e2e/all-pages-zero-error.spec.ts) | 34 页 0-4xx/5xx 巡检 |
| [e2e/job-definition-crud.spec.ts](../../../e2e/job-definition-crud.spec.ts) | 补 JobDefinition CRUD 空白 |
| [e2e/user-journey.spec.ts](../../../e2e/user-journey.spec.ts) | P3 跨页 CRUD 闭环 |

## P2 修补复盘(可复用)

> 104 fail 中 ~95 是 UI 演进 spec 没跟上,不是 4xx/5xx 真问题

1. `el-dialog` → `el-dialog:visible, .el-drawer:visible`(form-helpers + 13 spec)
2. `.service-entry` → `.service-card`(SelfService 重设计 inline-tab → drawer)
3. `.config-nav__item` → `getByRole('tab')`(ConfigManagement 改 el-tabs)
4. 页面标题改名 5 处 → regex:
   - `'告警'` → `/事件告警|告警/`
   - `'租户配额'` → `/配额策略|租户配额/`
   - `'队列与窗口'` → `/队列/`
5. tag i18n `'按标签搜索'` → `'搜索标签'`
6. ops-diagnostic 完全重写:tab → diag-card 列表
7. tenant-ops / tenant-config-ops dry-run switch → 独立按钮
8. ops-diagnostic-ops Outbox 清理/重发布 — disabled 时跳过
9. keyboard-flow Tab focus 兼容 drawer
10. job-def CRUD spec:等 `/meta/enums` API 后再点 MetaSelect

## P1 BE 已知行为差异

- queues / windows / calendars / quotas / alert-routings:LCUT,无 GET-by-id 无 DELETE
- file-templates / file-channels:LCU/LCRU,无 toggle 接口
- alert-routing UPDATE 必须带 alertGroup(BE 不 merge,BE-ISSUE-5)
- 系统参数:PUT 作 upsert,GET 用 value,DELETE 用 key
- BE 实际 5 角色:ADMIN / AUDITOR / CONFIG_ADMIN / TENANT_USER / USER
  - OPERATOR/VIEWER 是菜单档位标签不是 Spring role

## P3 清理脚本现状(团队已知 bug)

- `cleanup-soft.sh` Python KeyError 'T'(parse 异常,部分跳过)
- `cleanup-tx.sh` BE 多个 DELETE 返 405

**缓解**:user-journey + all-pages-zero-error 全用 `Date.now()` 唯一后缀,重跑天然不冲突。
