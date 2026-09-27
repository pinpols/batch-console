# 前端全站页面与设计审查（2026-09-27）

> 结论：**本文记录的前端可修复问题已完成修复和失败点续跑，菜单入口、关键交互、无障碍基线与跨浏览器回归通过。**但调度全局暂停/恢复因当前后端状态无可执行动作而条件跳过，且本轮不包含真机手势和全部破坏性写操作；不将这些边界表述为已通过。

## 修复后复测（2026-09-27）

- Chromium 普通回归遵循“仅从失败处续跑”：首次执行到工作流设计器失败点，修复后通过设计器、分片目录及后续 smoke 尾段。该结论是“前缀 + 失败点 + 尾段”拼接覆盖，不是单次不中断的全绿命令。
- 跨浏览器标记集：Firefox `136/136`、WebKit `136/136`、Mobile Chrome `136/136`。移动续跑期间另修复了 `/monitor/instances` 旧入口未降级到 `/m/jobs` 的真实路由缺口。
- P0 axe：桌面 Chromium 11 页全部通过（10 页 + Queue 失败点续跑）；移动 11 页全部通过（首轮 + Approvals、API Key、File Template 失败点续跑）。深/浅色 UI 风格检查 2 项、i18n 切换检查 1 项通过。
- 稳定性：20 轮路由循环、50 次弹窗开关，记录到的 heap 增量 `0 MB`、console error `0`、page error `0`。
- 最终静态门禁：ESLint（无自动修复）、`vue-tsc --noEmit`、i18n 完整性、OpenAPI 漂移、生产构建通过；Vitest `104` 个文件、`675` 项通过。
- 未计入通过：调度“全局暂停”与“全局恢复”在当前运行状态下都没有可执行按钮，两项条件跳过；刷新和策略/队列/Worker/历史 Tab 交互 2 项通过。

### UI-01 至 UI-11 闭环状态

| ID | 状态 | 修复与当前证据 |
| --- | --- | --- |
| UI-01 | 已修复 | Mermaid 11 关闭全局 `htmlLabels`，使用可净化的原生 SVG 文字。构建产物实测桌面和移动 DAG 均为 `foreignObject=0`，节点名称/编码文字完整。 |
| UI-02 | 已修复 | 移动心跳请求携带 `tenantId`；真实实例请求 `heartbeat-details?tenantId=ta` 返回 200，对应 API 单测通过。 |
| UI-03 | 已修复 | 任一版本快照缺失时显示“暂时无法比较版本”和重试，不渲染统计。真实 404 场景实测差异摘要数为 0。 |
| UI-04 | 已修复 | 操作由 Worker 状态矩阵决定：`OFFLINE` 仅预热，`DECOMMISSIONED` 无动作。状态矩阵 4 项单测及真实卡片 DOM 实测通过。 |
| UI-05 | 已修复 | 租户选择器补可访问名称，通知点移除禁用 ARIA，公共色彩 token 收敛。本轮又对 9 个移动入口浅/深两主题扫描，`critical/serious=0`；桌面运营概览专项为 0。 |
| UI-06 | 已修复 | 构建产物运行态采样 `--el-border-radius-base=8px`、`--el-font-size-base=13px`，与设计 token 一致。 |
| UI-07 | 已修复 | 移动日志使用共享结构化摘要，HTML 实体解码；完整载荷收进可展开详情并可复制。真实 212 条数据无 `&quot;` 残留。 |
| UI-08 | 已修复 | 作业详情、审批和文件阶段均走 i18n/枚举映射；参数快照、结果摘要等移动标题同步中文化。 |
| UI-09 | 已修复 | 390 宽错误 Toast 使用可压缩网格，TraceId 省略显示，复制按钮不换行；实测宽 369/393，无横向溢出。 |
| UI-10 | 已修复 | 内部 GET 路径改为业务标题“节点运行记录”；批次日深链缺日历时显示可编辑选择器和“加载窗口”操作，构建产物 DOM 实测通过。 |
| UI-11 | 已修复 | viewport 已移除 `user-scalable=no`，构建产物为 `width=device-width, initial-scale=1.0, viewport-fit=cover`。真机手势仍属发布验收边界。 |

## 基线与方法

- 前端：`main@41a484d` 加审查时工作区现状；后端：本机 `localhost:18080` 健康，使用 ADMIN 和租户 `ta` 的现有测试数据。审查期间另有未提交代码变动，因此复测须以具体提交为准。
- 桌面：55 个入口（54 个菜单路径 + `/system/me`）在 Chromium 1440×900 浅色逐页截图和 DOM 检查；同 55 个入口在 1024×768 检查路由与页面级横向溢出；现有 `ui-style-consistency.spec.ts` 深色 55 页、浅色代表页 8 页，2 条测试通过。
- 移动：11 个入口在 390×844、412×915 检查路径、页面级溢出及首屏；375 宽完成截图但自动统计被本地开发服务中断，不计入通过数。`/m/workflow/1` 使用真实工作流 ID 复测；早期 `/m/workflow/5` 的 404 是无效样本 ID，不记为页面缺陷。
- 上下文页：新建作业、作业详情、DAG 查看/编辑/版本对比、实例详情/分片、工作流运行详情、批次日详情、登录、维护等共 13 条 URL。`/workers/my-workers` 和 `/setup/initial-tenant` 在 ADMIN 条件下被守卫重定向，未作为实际页面视觉验收。
- 稳定态 axe：浅色桌面 55 页、浅色移动 11 页，规则为 WCAG 2 A/AA、2.1 AA。每页待网络空闲和短暂稳定后扫描。数量是**违规 DOM 节点出现次数**，包含公共布局及列表重复项，不等于独立缺陷数。
- 对照依据：`design/` 的只读设计稿、`src/styles/tokens-handoff.css`、现有 `docs/redesign/coverage-matrix.md`。本轮没有做设计稿逐像素差异测量，**不能声称达到 95% 还原度**。

逐路由原始 JSON 仅作为本地审查过程产物，其中包含临时截图路径和大量重复 DOM 采样，不纳入版本库。可长期查阅的关键截图已保留在 `screenshots/`，不含认证信息。

## 原始审查覆盖结论（修复前）

| 维度 | 已证实 | 不能据此推导 |
| --- | --- | --- |
| 路由与基础布局 | 55/55 桌面入口在 1440 和 1024 正确落页且页面级无横向溢出；11/11 移动入口在 390 和 412 同样成立 | 嵌套表格不滚动、所有弹窗/抽屉适配、所有角色有权进入 |
| 字体与层级 | 桌面 54 个普通页页标题采样均为 18px IBM Plex Sans；设计器不使用普通页标题；正文采样为 13px | 任意长文本、缩放、动态数据都不重叠 |
| 交互与业务 | 真实数据打开了指定详情，捕获一条确定的 400 请求；现有回归测试覆盖部分导航和交互 | 所有创建/审批/删除、空/错/加载态、键盘路径已验收 |
| 无障碍 | 桌面 55/55、移动 11/11 稳定态扫描均有违规项 | axe 通过修复后即可替代人工键盘或屏幕阅读器验证 |

### P1：修复前问题记录

| ID | 确认问题与证据 | 定位与修复方向 |
| --- | --- | --- |
| UI-01 | **工作流只读图不可读。**`/workflow/viewer/1`、`/monitor/workflow-runs/16` 和 `/m/workflow/1` 的作业节点呈无文字黑块；等待 4.5 秒后仍如此。独立样例证明 Mermaid 原始 SVG 含 3 个 `foreignObject`、21 处 `style` 和 `Hello`，净化后分别为 0、0、0，黑块不是数据本身。[桌面截图](screenshots/dag-viewer-black-nodes.png)、[移动截图](screenshots/dag-mobile-black-nodes.png) | `src/utils/mermaid.ts` 开启 `htmlLabels`；`src/utils/trustedMermaidSvg.ts` 通过 `purifyHtml` 写入；`src/utils/safeHtml.ts` 删除样式且默认过滤 `foreignObject`。在保持 XSS 边界的前提下改为安全的 SVG 文本标签渲染或专用净化配置，并补真实 Mermaid 文字/颜色回归。 |
| UI-02 | **移动作业详情触发确定的 HTTP 400。**`/m/jobs/1063984` 请求 `GET /api/console/tasks/1064071/heartbeat-details`，后端返回 `INVALID_ARGUMENT: 租户参数缺失`，出现错误 Toast；主详情虽可见，心跳区失败。[截图](screenshots/mobile-job-heartbeat-error.png) | `src/views-mobile/MJobInstanceDetail.vue:363` 调用 `getTaskHeartbeatDetails(id)` 未传 `tenant.tenantId`；同一 API 的桌面组件传入租户。修复调用与对应单测，再用真实后端验证该区块及错误反馈。 |
| UI-03 | **版本对比在缺失历史快照时产生误导性结果。**`/workflow/designer/1/diff/1/8` 的旧版本请求缺失后显示“全部新增”计数，用户可能把“无法比较”误读为实际变更。[截图](screenshots/workflow-diff-fallback.png) | `src/views/workflow/designer/diff/WorkflowDesignerDiff.vue:75-102` 将失败降级为“当前 vs 空”。失败时应显示不可比较/重试，不生成增删改统计；仅两侧快照均存在时显示差异。 |
| UI-04 | **Worker 无效动作未按状态收敛。**管理页 OFFLINE 卡仍展示“Drain”“强制下线”等动作，易引发无意义请求和误判。[截图](screenshots/worker-offline-actions.png) | `src/views/worker/WorkerManagement.vue:129-143` 四个按钮无状态条件。按后端状态机与权限决定可见/禁用及原因，补状态矩阵测试。 |
| UI-05 | **无障碍基础缺陷跨全站。**桌面 55 页均触发 `label`（共 162 次，critical）、`aria-prohibited-attr`（61 次，serious）和 `color-contrast`（754 次，serious）；移动 11 页均触发 `color-contrast`（1893 次，serious），其中日志长列表重复项占比较高。公共租户选择器内层输入缺可访问名称，通知红点的无角色 `span` 使用了 `aria-label`；侧栏辅助文字及移动次级文字/状态标签对比度偏低。 | `src/components/common/TenantSelect.vue`、`src/layout/components/LayoutHeader.vue:37-51`、`src/layout/components/NotificationCenter.vue:20-27`、`src/layout-mobile/styles/mobile-common.css`。先修公共组件与 token，再复跑 axe；对深色主题及动态弹窗另补扫描。节点次数不可当成 55 个独立修复项。 |

### P2：修复前问题记录

| ID | 确认问题与证据 | 定位与建议 |
| --- | --- | --- |
| UI-06 | **控件规格与设计 token 不一致。**`--radius-control: 8px`、`--el-font-size-base: 13px`，但运行态根变量采样为 `--el-border-radius-base: 4px`、`--el-font-size-base: 14px`；37 个有页头按钮的页面中，30 个采样圆角为 4px、6 个为 11px、1 个为 3px；45 个有输入框的页面中 35 个为 4px、10 个为 8px。卡片普遍 12px，框架层基本一致。 | `src/styles/tokens-handoff.css`、`src/styles/element-override.css` 与 Element Plus 注入顺序/作用域需核对，在构建产物上复测。不要只按源码变量名认定最终样式。 |
| UI-07 | **移动执行日志摘要展示 HTML 实体和整段 JSON。**一条记录可占据大半屏，关键信息难扫读。[截图](screenshots/mobile-log-encoded-summary.png) | `src/views-mobile/MExecutionLog.vue:47-50` 直接插值 `detailSummary`，而桌面 `src/views/observability/AuditList.vue` 已有解码逻辑。抽共享纯文本摘要格式器，完整内容留详情并可复制；不要用未净化 HTML。 |
| UI-08 | **移动作业详情、审批、文件页存在未国际化原始字段。**当前截图可见 `Step`、`retry/start/finish`、`queue`、`traceId`，文件阶段也直接显示 `SUCCESS/FAILED`。 | `src/views-mobile/MJobInstanceDetail.vue:37-50,108-110`、`src/views-mobile/MApprovals.vue:65-80`、`src/views/file-center/FilePipelineObservability.vue:90`。业务术语映射到 i18n，协议名仅在确需复制时作为次级信息。 |
| UI-09 | **移动错误 Toast 的 TraceId 复制按钮在 390 宽折成竖排，并压住底部导航。**错误源于 UI-02，但提示组件本身也不适配窄屏。[截图](screenshots/mobile-job-heartbeat-error.png) | `src/utils/errorToast.ts:54-76`、`src/styles/app.css:795-840`。为长 ID 设置可压缩/换行布局与底部安全区，保持复制按钮可触达。 |
| UI-10 | **辅助信息仍混入内部实现文本。**工作流运行详情标题直接写 `GET /api/console/queries/workflow-node-runs`，原始状态/时间缺少产品化展示；批次日详情若直接打开无 `calendarCode`，只能看到参数缺失。 | `src/locales/zh-CN.ts:2858`、`src/views/monitor/WorkflowRunDetail.vue`、`/scheduler/batch-days/:bizDate`。标题改业务语义；详情深链应能恢复所需上下文或提供显式选择器。 |
| UI-11 | **页面禁止手势放大。**所有扫描页均触发 `meta-viewport`（桌面 55 次、移动 11 次）；这不影响普通布局，却阻碍低视力用户放大查看。 | `index.html:17-18` 的 `user-scalable=no`。移除后测试 iOS/Android 缩放和安全区。 |

源码可维护性指标：`src/views` 与 `src/views-mobile` 的 Vue 文件中，检出 `94` 处数字 `border-radius`、`327` 处数字 `font-size`、`125` 处 hex 色值。它们是集中复核范围，**不等于 546 处错误**；图表、状态色和特殊视图可能需要例外。新样式优先复用 token，并用视觉回归锁定公共控件。

## 后续发布验收边界

UI-01 至 UI-11 的代码修复已闭环。发布前仍需按“页面 × 角色 × 正常/空/错/加载 × 弹窗/抽屉 × 视口”的操作清单补真机手势、屏幕阅读器和破坏性写流程；这些未执行项不影响本轮问题修复状态，但不应被表述为已通过。
