# D 档 QA 阶段报告

> 目标:真实场景不会报错 4xx/5xx;所有 CRUD 接口覆盖(除 AI)
> 流程:Phase 1 (API 直打) → Phase 2 (UI 真实用户场景) → Phase 3 (清理 + E2E 闭环)
> 基础设施:`e2e/support/fixtures.ts` 全局 network watchdog + `e2e/all-pages-zero-error.spec.ts` 34 页 0-4xx 巡检

## 阶段索引

| Phase | 范围 | 状态 | 报告 |
|---|---|---|---|
| **P1-API** | curl 直打 BE 22 实体 CRUD | ✅ 全绿 | [phase1-api-crud-stdout.log](phase1-api-crud-stdout.log) / [phase1-api-crud.md](phase1-api-crud.md) |
| **P1-Boundary** | 边界值矩阵(应 400 不应 500) | ✅ 全绿 | [phase1-boundary.md](phase1-boundary.md) |
| **P1-RBAC** | 6 角色 × tenant-switch | ✅ 全绿 | [phase1-rbac.md](phase1-rbac.md) |
| **P2-UI** | playwright 全量 (排除 ai-chat) | 🔄 进行中 | [phase2-ui-summary.md](phase2-ui-summary.md) |
| **P3-Cleanup** | 脏数据清理 + 端到端 journey | ⏳ 待开 | — |

## Phase 1 总结(2026-05-17)

```
api-crud.sh:   PASS 62 / FAIL 0 / SKIP 0  (22 实体 × CRUD 操作)
boundary.sh:   PASS 25 / FAIL 0          (字段边界 + enum 校验)
rbac-check.sh: PASS 6/6 角色             (admin/operator/viewer/tu/auditor/cfg-admin)
```

3 处 WARN (HTTP 200 但响应无 id):
- 通知渠道 CREATE
- 节假日 CREATE
- Tag CREATE

均为 BE LCRU 但响应体不含 id,不影响 CRUD 流程,记录为已知非阻塞项。

## 已知 BE 行为差异(已固化到 api-crud.sh 注释)

- queues / windows / calendars / quotas / alert-routings:LCUT,无 GET-by-id 无 DELETE
- file-templates / file-channels:LCU/LCRU,无 toggle 接口
- alert-routing UPDATE 必须带 alertGroup(BE 不 merge,BE-ISSUE-5)
- 系统参数:PUT 作 upsert,GET 用 value,DELETE 用 key
- Tag:composite-key,无 list-by-id
- Notification rule:依赖 channel,chain create
- BE 实际 5 角色(ADMIN/AUDITOR/CONFIG_ADMIN/TENANT_USER/USER),OPERATOR/VIEWER 是菜单档位标签不是 Spring role
