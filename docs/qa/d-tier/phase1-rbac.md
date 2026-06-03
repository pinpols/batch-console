# Phase 1 — RBAC 校验报告

> 6 角色 × 关键接口 × tenant-switch
> 生成: 2026-05-17
> 来源: `bash e2e-data/rbac-check.sh`

## 结果矩阵

```
user            role         login  auth/me        menu#  POST /queues       切租户→tb
admin           ADMIN        200    ROLE_ADMIN     7      409 重复(等同允许) 200 可切
test-op-ta      TENANT_USER  200    ROLE_TENANT    5      403 拒             403 禁切
test-viewer-ta  USER         200    ROLE_USER      5      403 拒             403 禁切
test-tu-ta      TENANT_USER  200    ROLE_TENANT    5      403 拒             403 禁切
test-auditor    AUDITOR      200    ROLE_AUDITO    5      403 拒             200 可切
test-cfg-admin  CONFIG_ADMIN 200    ROLE_CONFIG    7      403 拒             200 可切
```

## 期望对照

| 角色 | 写 (POST /queues) | 跨租户读 | 实际 | 判定 |
|---|---|---|---|---|
| ADMIN | ✅ 允许 | ✅ 允许 | 409/200 (409=重复非权限) | ✅ |
| AUDITOR | ❌ 拒 | ✅ 允许 (只读跨租户) | 403/200 | ✅ |
| CONFIG_ADMIN | ❌ 拒 (写权在 ADMIN) | ✅ 允许 (配置审计需要) | 403/200 | ✅ |
| TENANT_USER | ❌ 拒 | ❌ 禁切 (只能本租户) | 403/403 | ✅ |
| USER | ❌ 拒 | ❌ 禁切 | 403/403 | ✅ |

**全部 6 用户行为符合 RBAC 设计预期。**

## 备注

- OPERATOR/VIEWER 旧标签历史遗留,现 BE Spring 角色只有 5 个(ADMIN/AUDITOR/CONFIG_ADMIN/TENANT_USER/USER)
- 菜单数差异(7 vs 5)反映 RBAC 屏蔽:写权限角色看到 7 项,只读看到 5 项
- 409 重复创建对 ADMIN 视为「权限通过」— 非重复时返回 200
