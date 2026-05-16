# C 档 QA 完整覆盖 — 测试方案

> 衔接 [fe-be-joint-test-plan.md](./fe-be-joint-test-plan.md) 的档位定义。
> A 档(冒烟)/ B 档(CRUD 闭环)已 PASS。本档目标:**表单校验 / 错误态 / 键盘 / a11y / 边界值** 的系统性 QA。
> **预估**:3–5 天(净工时 16–28 h,看人工抽测多少)。

---

## 目标 & 不做什么

**目标**

1. 把现有 axe baseline 从「5 页 critical-only」推到「全部业务页 critical + serious + 表单 keyboard flow」。
2. 把现有 20 个声明 `rules` 的表单的校验路径写成 spec,捕住 i18n 缺失、required 漏标、type 校验跳过等回归。
3. 把"接口 5xx / 404 / 网络抖动"的错误态从 1 个 spec 扩到典型 P0 写操作页。
4. 把"边界值"做成数据驱动表,而不是逐 case 手工。

**不做什么**(留人工抽测 / 后续档)

- 移动端 `/m/*`(viewport 切换 + 触摸事件成本高,留下一档)
- 多浏览器矩阵(Safari/Firefox)(只在 release 前手工跑)
- 性能 / 内存基线(独立专题)
- `/workflow/designer` X6 拖拽 a11y(图编辑器 a11y 是研究课题,不在本档)

---

## 现状盘点(开工前已知)

| 维度 | baseline | 缺口 |
|---|---|---|
| **a11y** | `e2e/a11y.spec.ts` 跑 5 页 axe wcag2aa,只 critical fail | 业务页未覆盖、serious 全部宽容、`aria-label` 整体仅 7 处 |
| **错误态** | `e2e/error-recovery.spec.ts` 跑 GET 404/429/503/offline | 写操作(POST/PUT/DELETE)5xx/409/422 全没覆盖 |
| **表单校验** | 20 个 view 声明 `rules`,但没有 spec 单独跑校验路径 | required 漏标、disable→submit 路径、异步校验失败未测 |
| **键盘** | 全局 `:focus-visible` + Login 一处可达 | Tab 链未审、Dialog ESC 关闭未审、ProTable 列表行键盘选中未审 |
| **边界值** | 散落在各 CRUD spec,无统一表 | 跨页一致性差(同一字段在 A 页 max=200,B 页限 500) |

工具栈已就位:`@axe-core/playwright` ^4.11、Playwright `test`、`expect` 都有。

---

## 优先级矩阵

**P0 — 必覆盖**(写操作 + 高频 + 已知踩过坑)

| 页面 | 选入理由 |
|---|---|
| `/login` | 入口,a11y / 键盘必须无障碍 |
| `/governance/queues` (4 个对话框) | 字段最多 + i18n 刚改 |
| `/governance/quota` | 同上 |
| `/observability/alert-routings` | 9 字段 + 联调发现过 BE bug |
| `/files/templates` | 11 字段表单 + 抽屉 + 编辑器 |
| `/files/channels` | 8 字段 |
| `/jobs/pipelines` | 步骤编辑器 + 拖拽 |
| `/system/users` | 改密 / 启停 / 重置 — 误操作风险 |
| `/system/api-keys` | revoke / 重生成 — 不可逆 |
| `/approvals`(两个 tab) | OPERATOR / ADMIN 两套权限路径 |

**P1 — 强烈建议覆盖**

| 页面 | 理由 |
|---|---|
| `/governance/calendars`(含节假日抽屉) | 嵌套表单层级深 |
| `/scheduler/snapshot` | 表单 + 列表混合 |
| `/system/notifications`(渠道 / 订阅 / Webhook) | 三 tab 之间状态串扰风险 |
| `/system/tenant-list` | 跨租户切换 + 表单 |
| `/system/triggers` | pause/resume 切换 |
| `/observability/audit` | 长 description HTML 解码已踩过 |

**P2 — 顺手做**

- `/ops/diagnostic` / `/ops/summary` / `/observability/event-catalog` / `/files/list`(纯只读为主,a11y 跑通就行)

---

## 四个维度的检查清单

### 1. 表单校验(form-validation)

每个 P0 表单跑以下子矩阵:

| 子项 | 期望 | 失败信号 |
|---|---|---|
| 全空提交 | submit disabled OR 弹 required 文案 | 提交进 BE 拿 400 / 静默关闭 |
| 单个 required 字段空 | 该字段红 + 文案 + submit 不发请求 | 文案是 i18n key `form.xxx.required` 而非渲染值 |
| 长度超上限 | 超出即触发 max 文案,**不允许继续输入** | 允许超出但 submit 才报 |
| 长度刚到上限 | 通过,正常 submit | min/max 边界写反 |
| 类型不匹配(数字框输字母) | input mask 拒收 OR 校验失败 | 提交后 BE 500 |
| 异步校验失败(如 code 重名) | 文案显示 + submit 失败 | 没绑 form 状态导致 submit 仍发请求 |
| 提交中再次点 submit | 按钮 loading + disabled | 并发提交 |
| 取消按钮 | 关闭弹窗 + reset 表单 | 下次打开残留上次输入 |
| ESC 键 | 同取消 | 不响应 |

**记录格式**

```
[form-validation] /governance/queues - 新建队列
  case: maxRunningJobs 输入字母
  expected: input 拒收 OR rule 触发 message 显示
  actual: 允许输入 "abc",submit 后 BE 返回 500
  page: src/views/governance/QueueConfig.vue:line
```

### 2. 错误态(error-state)

模板:用 `page.route(...)` 拦截关键写操作,注入以下响应,断言 UI 兜底。

| 注入 | 期望 UI 行为 |
|---|---|
| 400 `{code:"VALIDATION_FAILED", message:"...", traceId}` | toast 显示 message,**保留**表单已填值 |
| 401 | 跳登录,清本地态(已有 baseline,仅回归) |
| 403 | toast "权限不足",**不**跳登录 |
| 404 业务(`{code:"NOT_FOUND",message:"queue not found"}`) | 显示领域 message,**不**触发"接口不存在" |
| 404 路由真缺(Spring 默认) | 触发"接口不存在或版本不匹配"(交互测互拦) |
| 409 `{code:"CONFLICT"}` | toast,表单保留 |
| 422 `{code:"BIZ_INVALID"}` | toast,表单保留 |
| 5xx `{code:"SYSTEM_ERROR", traceId}` | toast 含 traceId 可复制 |
| 网络挂(`context.setOffline(true)`) | toast 提示离线,不卡死 |
| 慢请求(>10s 延迟) | submit 按钮 loading,不重复发请求 |

**最低覆盖**:每个 P0 写操作至少注入 `400 / 5xx / 网络挂` 三类。

### 3. 键盘 / a11y(keyboard + a11y)

**单页 a11y baseline 收紧**

```ts
// e2e/a11y.spec.ts 把 SEVERITY_TO_FAIL 从 ['critical'] 改为 ['critical','serious']
// 并把覆盖页从 5 个扩到上面 P0 列表(10 页)。
// 例外用 builder.disableRules(['color-contrast-enhanced']) 单页声明,不批量豁免。
```

**键盘流程**(每个 P0 跑一次)

| 步骤 | 期望 |
|---|---|
| Tab 进页 | 第一个可聚焦元素拿到 ring(`:focus-visible` 起效) |
| Tab 一圈 | 焦点顺序与视觉顺序一致,不跳跃 |
| 列表行 Enter | 进入详情 OR 触发主操作 |
| 打开 Dialog 后 Tab | 焦点**陷阱**在 Dialog 内,不溢出到背景 |
| Dialog ESC | 关闭 |
| Dialog Enter(焦点在文本框) | 提交 OR 走 textarea 换行,**不**误提交 |
| 列表选中状态 + ↑↓ | 在行间移动 |

**aria 必检项**

- 所有 `el-button` 纯图标必须有 `aria-label`(grep 兜底:`<el-button[^>]*><el-icon` 后面 50 字符内无 `aria-label` → 报错)
- Dialog 必须有 `role="dialog"` + `aria-labelledby` 指向标题(EP 默认已加,抽样验证)
- 表单 label 必须 `for` 绑定 input id(EP 默认已加,抽样验证)
- 列表分页器 `nav role="navigation"` + 当前页 `aria-current="page"`

### 4. 边界值(boundary)

**统一表**:为每个 P0 写操作建一份 `boundary.json`,格式如下:

```json
{
  "endpoint": "POST /api/console/queues",
  "fields": [
    { "name": "queueCode", "type": "string", "min": 1, "max": 64, "regex": "^[a-zA-Z0-9_-]+$" },
    { "name": "maxRunningJobs", "type": "int", "min": 1, "max": 10000 },
    { "name": "fairShareWeight", "type": "decimal", "min": 0, "max": 1 }
  ]
}
```

**生成器跑 6 类用例 / 字段**(min-1, min, min+1, max-1, max, max+1),空 + null + 全空白 + 控制字符 各一,记到 `boundary-report.md`。

这部分**不必每字段每次都跑**,改一次 endpoint 跑一次即可,挂在 e2e 选跑模式后面。

---

## 执行节奏(5 天)

**Day 1 — baseline 收紧 + 工具就位**

- 把 `e2e/a11y.spec.ts` 从 5 页扩到 P0 10 页,`SEVERITY_TO_FAIL` 加 `serious`
- 建 `e2e/support/form-helpers.ts` 封装"全空提交 / 单字段缺 / 类型不匹配"通用 actions
- 建 `e2e/support/error-injection.ts` 封装拦截写操作 + 注入 400/5xx/网络挂 三套
- 跑一次,把当前 baseline 暴出来的违规整理成 `qa-c-baseline.md`(零修复,仅记账)

**Day 2 — P0 表单校验 spec**(governance / files / observability/alert-routings)

- 每页一个 spec(`<page>-validation.spec.ts`),用 Day 1 的 form-helpers 跑子矩阵
- 同步给 `src/views/<page>.vue` 修发现的真问题(i18n key 缺失 / required 漏标)

**Day 3 — P0 错误态 spec**(同 P0 页 + system/* + approvals)

- 一个综合 spec `error-states.spec.ts`,用 route 拦截批量跑
- 失败的 page 改 `interceptors` 兜底 + 表单 catch

**Day 4 — 键盘 / a11y 深挖**

- P0 10 页人工跑一遍键盘流程,记到 `qa-c-keyboard-report.md`
- 改 `aria-label` 漏的纯图标按钮(grep 出来批改)
- Dialog focus-trap 缺失的补 `:trap` / `focus-trap-vue`

**Day 5 — 边界值 + 收尾**

- 写 `e2e-data/boundary.sh` 生成器,跑 P0 写操作的边界表
- 把 Day 1~4 真改的 bug 合并提 PR
- 输出 `fe-qa-c-tier-report.md`:每 P0 页一行,validation/error-state/a11y/keyboard 四个勾

---

## 失败记录格式(沿用 B 档风格)

所有问题汇总到 `docs/runbook/fe-qa-c-tier-report.md`,按维度分章节,每条:

```
### [validation / error-state / a11y / keyboard / boundary] <page> - <case>
- repro: <最小操作步骤 OR spec 文件:行号>
- expected: ...
- actual: ...
- 推测原因: ...
- 修复 PR / commit: <留空,补在事后>
```

---

## 数据策略(沿用 B 档)

- 所有 spec 在 `tx` 租户跑
- 写入数据 `e2e-` 前缀 + `[E2E TEST]` name
- 失败的 boundary 用例**不**回滚 BE 状态 — 留作 BE 排查依据,跑完 `cleanup-tx.sh` 一键清

---

## 风险清单

| 风险 | 缓解 |
|---|---|
| axe `serious` 收紧后大面积红 | Day 1 baseline 不动手修,仅记账,Day 4 集中改 |
| EP 默认组件 a11y 违规(EP 上游问题) | 单 rule disable,**不**批量豁免;在报告里独立小节列 EP 上游问题 |
| 移动端测试漏 | 本档明确不做,留下一档 |
| 拦截器修改影响生产 | `error-states.spec.ts` 只用 `page.route` 客户端拦截,不动 `interceptors.ts` 生产逻辑 |
| 5 天工时超期 | Day 5 可砍 boundary 自动化,降级为人工抽 3 个最重要 endpoint |

---

## 出口标准(Done = ?)

- [ ] `e2e/a11y.spec.ts` 覆盖 P0 10 页 + `serious` 不漏 + critical = 0
- [ ] P0 10 页每页一份 `<page>-validation.spec.ts`,跑表单子矩阵
- [ ] `e2e/error-states.spec.ts` 覆盖 P0 写操作的 400/5xx/网络挂三类
- [ ] `docs/runbook/qa-c-keyboard-report.md` 写齐 P0 10 页键盘流程的人工抽测结论
- [ ] `e2e-data/boundary.sh` 至少跑 P0 5 个 endpoint 的边界表
- [ ] `docs/runbook/fe-qa-c-tier-report.md` 输出最终红绿矩阵 + bug list 关联 PR

---

## 后续档(D 档预告,不在本次)

- 移动端 `/m/*` 全套
- 多浏览器矩阵(Chromium / Webkit / Firefox)
- i18n 切换稳定性(实时切 zh↔en 中操作)
- 长会话稳定性(8h+ 不刷新)
- 权限矩阵全跑(ADMIN / OPERATOR / READONLY × 全菜单)
