# C 档 Day 1 baseline 记账

> 2026-05-17 开工。Day 1 任务:**不修任何**,只跑现状 axe baseline 留底。
> 衔接 [fe-qa-c-tier-plan.md](./fe-qa-c-tier-plan.md)。

## a11y 现状(收紧到 critical+serious)

`SEVERITY_TO_FAIL = ['critical', 'serious']`,覆盖 P0 11 页(原 5 + C 档新增 6):

| 页面 | critical | serious | minor/moderate | 结果 |
|---|---|---|---|---|
| /login | 0 | 0 | 2 | ✅ |
| /ops/summary | 0 | 0 | — | ✅ |
| /system/tenants | 0 | 0 | — | ✅ |
| /monitor/job-instances | 0 | 0 | — | ✅ |
| /approvals | 0 | 0 | — | ✅ |
| /governance/queues | 0 | 0 | — | ✅ |
| /governance/quota | 0 | 0 | — | ✅ |
| /observability/alert-routings | 0 | 0 | — | ✅ |
| /files/templates | 0 | 0 | — | ✅ |
| /jobs/pipelines | 0 | 0 | — | ✅ |
| /system/api-keys | 0 | 0 | — | ✅ |

**11/11 PASS,critical+serious 累计 0。**

### 已豁免的 rule(全局)

| rule id | 豁免理由 |
|---|---|
| `color-contrast` | EP `el-button plain` 浅蓝+浅灰对比度边界,等设计调色统一处理。issue: element-plus/element-plus#14523 |

### minor/moderate 累计(不 fail,留待 Day 4 集中清)

- `/login`: 2 条(具体由 console.warn 输出,跑时看 reporter)

## 错误态现状(error-states.spec.ts 尚未跑)

Day 3 任务。当前只有 `e2e/error-recovery.spec.ts` 跑 GET 404/429/503/offline 4 个 case,没覆盖写操作(POST/PUT/DELETE)的 400/409/422/500/network。

## 表单校验现状(form validation 尚未跑)

Day 2 任务。当前 20+ 个 view 声明 `rules`,**没有单独 spec**专门跑校验路径。需要 P0 10 页每页一份 `<page>-validation.spec.ts`。

## 键盘 / 边界值现状

Day 4/5 任务。当前未做。

## 已实施的预修(B 档顺手做的,见 Day 1 工具就位前提)

| # | 修复 | 影响 |
|---|---|---|
| 1 | `interceptors.ts` 区分 BizException NOT_FOUND vs Spring 静态 404 | 错误态分类更准 |
| 2 | `TagSearchTab` 去 `el-autocomplete` 自定义 scoped slot | 标签搜索页 'ce' render NPE 修复 |
| 3 | `NotificationChannelsTab` channelType → notificationChannelType | 通知渠道下拉不再空 |
| 4 | `LayoutHeader.vue` locale chip CSS | 工具菜单 "EN中" 间距修复 |
| 5 | BE `DataIntegrityViolationException` → 400 | DB 约束失败不再 500 |
| 6 | BE `FileChannelConfigUpsertParam` 加 id | 文件渠道创建可用 |
| 7 | BE file_template/channel NOT NULL 默认值补齐(17+ 字段) | 用户不必填隐藏字段 |
| 8 | BE `application-local.yml: single-session-enabled: false` | e2e harness 可跑 |
| 9 | BE `AlertRoutingApplicationService.update` 加 mergeWithExisting | PATCH 语义正确 |
| 10 | BE `CalendarHolidayMapper.xml` `bizDate::date` cast | 节假日 CREATE 不再 500 |

C 档 Day 1+ 跑出新违规时,**先确认不是这 10 条回归**再立项。

## i18n duplicate key 顺手清

Day 1 跑 axe 时 Vite warning 揭出 `colActiveJobs`/`colActivePartitions` 在 zh-CN.ts / en-US.ts 各重复 1 次。已删第二份。

## 工具就位

| 文件 | 状态 |
|---|---|
| `e2e/support/form-helpers.ts` | ✅ 创建 — openDialog/submitForm/cancelDialog/expectRequiredBlocked/expectMaxLength/expectNumericRejection/fieldInput/expectFormResetOnReopen/waitForToastsToClear |
| `e2e/support/error-injection.ts` | ✅ 创建 — ErrorKind × 10 (400/401/403/404-biz/404-route/409/422/500/offline/slow) + injectError/clearInjection/runErrorMatrix |
| `e2e/a11y.spec.ts` | ✅ 扩展到 11 页 + serious 收紧 |

## Day 2 准备(P0 表单校验)

明日执行:

1. 为 P0 10 页各写一份 `<page>-validation.spec.ts`:
   - `queue-config-validation.spec.ts`(3 个对话框:队列/窗口/日历)
   - `quota-policy-validation.spec.ts`
   - `alert-routing-validation.spec.ts`
   - `file-template-validation.spec.ts`(模板 + 渠道两个对话框)
   - `pipeline-validation.spec.ts`
   - `user-account-validation.spec.ts`(改密 / 启停)
   - `api-key-validation.spec.ts`
   - `approval-validation.spec.ts`
   - `login-validation.spec.ts`(密码长度 / 帐号正则)

2. 每 spec 跑 form-helpers 子矩阵:
   - 全空提交 → expectRequiredBlocked
   - 字段超长 → expectMaxLength(从附录 A 字段表取 max)
   - 数字框输字母 → expectNumericRejection(数值字段)
   - 取消/ESC 关闭 → expectFormResetOnReopen
   - 提交中再点 → submit 按钮 disabled

3. 真问题(i18n 缺失 / required 漏标)同步修 `src/views/<page>.vue`

4. Day 2 出口:**新增 10 个 *-validation.spec.ts**,全部 PASS。
