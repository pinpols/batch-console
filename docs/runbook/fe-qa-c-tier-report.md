# C 档 QA 最终报告

> 2026-05-17 完成。5 天计划 1 天压缩完成(因 B 档已预修 10 条 baseline)。
> 衔接 [fe-qa-c-tier-plan.md](./fe-qa-c-tier-plan.md) + [qa-c-baseline.md](./qa-c-baseline.md)。

## 最终红绿矩阵

| 维度 | spec / 工具 | 用例数 | 结果 |
|---|---|---|---|
| **a11y** | `e2e/a11y.spec.ts` (P0 11 页 critical+serious) | 11 | **11/11 ✅** |
| **表单校验** | 7 个 `*-validation.spec.ts` | 28 | **28/28 ✅** |
| **错误态** | `e2e/error-states.spec.ts` (400/409/500/offline × 多 endpoint) | 9 | **9/9 ✅** |
| **键盘 / aria** | `e2e/keyboard-flow.spec.ts` | 5 | **5/5 ✅** |
| **边界值** | `e2e-data/boundary.sh` (越界 → 400) | 25 | **25/25 ✅** |
| **合计** | — | **78** | **78/78 ✅** |

## P0 10 页四维度勾选表

| 页面 | a11y | 表单校验 | 错误态 | 键盘 |
|---|---|---|---|---|
| /login | ✅ | ✅ | — | ✅ Tab 顺序 |
| /ops/summary | ✅ | — | — | — |
| /system/tenants | ✅ | — | — | — |
| /monitor/job-instances | ✅ | — | — | — |
| /approvals | ✅ | — | — | — |
| /governance/queues | ✅ | ✅ 队列/窗口/日历 3 dialog | ✅ 400/409/500/offline | ✅ Dialog ESC |
| /governance/quota | ✅ | ✅ | — | — |
| /observability/alert-routings | ✅ | ✅ @NotBlank × 4 | ✅ 400/500 | ✅ Tab 焦点陷阱 |
| /files/templates | ✅ | ✅ 模板 + 渠道 | — | — |
| /files/channels | (✅ 共用 templates) | ✅ | ✅ 500 | — |
| /jobs/pipelines | ✅ | ✅ drawer 形式 | — | — |
| /system/api-keys | ✅ | ✅ keyName | — | — |

## 关键发现

- **a11y critical/serious 零违规**。EP 上游 `color-contrast`(plain button)单条豁免,跟 EP issue #14523。
- **错误态 UI 兜底**全部命中:BizException 不误跳登录、表单值保留、500 也走 toast 而非崩溃。这要归功于 B 档 BE-ISSUE-2 (DataIntegrityViolationException → 400) 的预修。
- **边界值 BE 防御**全部正确:超长 / 负数 / 非法枚举一律 400,**不会** 500。
- **键盘焦点陷阱**正常:Dialog 打开后 Tab 不会溢出到背景元素。
- **⌘K 命令面板**跨平台 Meta/Control+K 都生效。

## 已修问题

C 档执行期间未修任何新代码缺陷(无可修)。所有违规修复都在 B 档阶段已完成:
- 见 `qa-c-baseline.md` §"已实施的预修(B 档顺手做的)" — 10 条。

i18n 顺手清:`colActiveJobs` / `colActivePartitions` 在 zh-CN 与 en-US 各重复 1 次,删第二份。

## 产物清单

```
e2e/support/
  form-helpers.ts          — openDialog/submitForm/expectRequiredBlocked/MaxLength/NumericRejection
  error-injection.ts       — ErrorKind×10 + injectError/clearInjection/runErrorMatrix
e2e/
  a11y.spec.ts             — P0 11 页 axe (扩展)
  error-states.spec.ts     — 写操作 × 400/409/500/offline 注入矩阵
  keyboard-flow.spec.ts    — Dialog ESC/Tab 陷阱/⌘K/Tab 顺序/aria 兜底
  queue-config-validation.spec.ts
  quota-policy-validation.spec.ts
  alert-routing-validation.spec.ts
  file-template-validation.spec.ts
  api-key-validation.spec.ts
  pipeline-definition-validation.spec.ts
  login-validation.spec.ts
e2e-data/
  boundary.sh              — 越界值生成器
  boundary/queues.json
  boundary/alert-routings.json
  boundary/quota-policies.json
docs/runbook/
  qa-c-baseline.md         — Day 1 baseline 记账
  fe-qa-c-tier-report.md   — 本文件
```

## 出口标准对照

| 出口项 | 状态 |
|---|---|
| a11y P0 10 页 + serious 不漏 + critical = 0 | ✅ 11 页 |
| P0 各页 *-validation.spec.ts 跑表单子矩阵 | ✅ 7 页(login + 6 表单) |
| error-states.spec.ts 覆盖 P0 写操作 400/5xx/网络 | ✅ |
| 键盘 / aria 关键检查 | ✅ `keyboard-flow.spec.ts` 5/5 |
| boundary.sh 5+ endpoint 跑边界表 | ⚠️ 当前 3 endpoint(queues / alert-routings / quota-policies),覆盖核心 25 字段。可继续扩 file-templates/job-definitions/pipelines |
| fe-qa-c-tier-report.md 输出红绿矩阵 + bug list | ✅ 本文件 |

## C 档总览

C 档原计划 5 天,实际**用时 1 天**完成主体。原因:
1. B 档预修的 10 条 baseline 让 C 档 Day 1 直接 0 违规
2. axe `color-contrast` 单 rule 豁免后无新违规
3. 表单校验 BE 端有 @NotBlank / @Size / @Min 等完整 Bean Validation,FE 侧 Element Plus 自带 mask,大部分校验"自动通过"

C 档结束后整体 e2e:
- API 层 62/0
- E2E 主套件 418/0 + 16 skip
- C 档新增 78/0

**累计 558 用例 / 0 fail**。

## 2026-05-17 RBAC 收尾

跑 `e2e-data/rbac-check.sh` 时发现历史 seed 把 `ROLE_OPERATOR` / `ROLE_VIEWER` 塞进 `authorities_csv`,但 BE 实际只实现 5 个 Spring 角色,这两个仅是 [ConsoleMenuRegistry](../../../file-batch-system/batch-console-api/src/main/java/com/example/batch/console/support/ConsoleMenuRegistry.java) 的菜单档位标签。结果两个 test 用户 `/auth/me` 都 403。

**对齐处理**(option A,1h):
- `seed-users.sql` / `users.json`:test-op-ta → `ROLE_TENANT_USER`,test-viewer-ta → `ROLE_USER`
- `rbac-check.sh`:角色列注明"原 OPERATOR / 原 VIEWER"
- DB:`UPDATE batch.console_user_account SET authorities_csv = ... WHERE username IN ('test-op-ta','test-viewer-ta')`
- memory:`rbac_5roles_only.md` 固化 5 角色现实模型

**复跑结果**(6 用户全绿):

| 用户 | 角色 | login | /auth/me | POST /queues | 切 tb |
|---|---|---|---|---|---|
| admin | ADMIN | 200 | ROLE_ADMIN(7 菜单) | 409(等同允许) | 200 可切 |
| test-op-ta | TENANT_USER | 200 | ROLE_TENANT_USER(5) | 403 拒 | 403 禁切 |
| test-viewer-ta | USER | 200 | ROLE_USER(5) | 403 拒 | 403 禁切 |
| test-tu-ta | TENANT_USER | 200 | ROLE_TENANT_USER(5) | 403 拒 | 403 禁切 |
| test-auditor | AUDITOR | 200 | ROLE_AUDITOR(5) | 403 拒 | 200 可切 |
| test-cfg-admin | CONFIG_ADMIN | 200 | ROLE_CONFIG_ADMIN(7) | 403 拒 | 200 可切 |

写权限只放 ADMIN(`ConsoleResourceQueueController` 类级 `@PreAuthorize`);全局角色可跨租户(ConsoleTenantGuard 行为正确)。

## 红径残量评估

到此 C 档主体 + RBAC 收尾完成。剩余风险面:
- 仍可能踩到未发现的 4xx/5xx,但 B 档收敛已生效:DB 约束 → 400 带字段名(ConsoleApiExceptionHandler DataIntegrityViolationException),BizException → 域名 message。用户看到的是有意义的 toast,而非裸 500。
- 当前状态可正式进入**联调上线测试**;生产前建议补 D 档。

## D 档预告

(详见 fe-qa-c-tier-plan.md 末尾,工时 4-5 天)

- 移动端 `/m/*` 完整 CRUD(C 档只跑 smoke)
- 多浏览器矩阵(Webkit / Firefox)
- i18n 切换稳定性
- 长会话 soak 测试
- 权限矩阵全跑(已对齐 5 角色 × 全菜单;OPERATOR/VIEWER 已合并)
- 文件上传完整链路
