# 前端 Bug 审查与修复验证（2026-10-26）

## 结论和基线

本轮按 `frontend-quality-review` 的代码正确性模式，追踪前端状态、请求目标和实际副作用；规约检查仅作辅助验证，不将样式、命名或格式偏好计为 Bug。

- 工作树：配对开发目录 `wdi-current/batch-console`，分支 `fix/wdi-current`；HEAD 保持 `662d254e2f8b97f93021de548815470d2291c997`。
- 盘点分母：开始时可版本化 `src` 下 760 个 TS/TSX/Vue 文件，其中 198 个测试文件、562 个生产文件；修复后为 769 个，其中 206 个测试文件、563 个生产文件。排除依赖、构建产物和自动生成的忽略文件。
- 深入追踪通知规则、Webhook、密钥、维护状态、自助操作、标签搜索和配置包导入，并核对 API 适配器、OpenAPI、租户 Store 和调用方；本轮修改 20 个生产文件及 11 个测试文件。清单盘点和全量测试不等于逐行审完所有生产文件。
- 9 组确认问题完成本地修复。核心错误均有延迟请求、延迟校验或确认的回归证据；未将前端选项错误描述为后端授权绕过。
- 沿用已有改动和暂存边界，未创建分支或工作树，未暂存、提交、推送；未修改 main 或冻结分支。

后端本次治理的 9 项问题、真实依赖复现和命令保留在[后端修复验证](../../../file-batch-system/docs/verifications/backend-bug-remediation-2026-10-26.md)，原始发现保留在[后端审查](../../../file-batch-system/docs/review/backend-bug-review-2026-10-26.md)。两边证据不混算。

## 确认问题与修复

| ID | 优先级 | 触发条件与错误行为 | 修复及回归 |
|---|---|---|---|
| FE-BUG-01 | P2 | 管理操作更新维护状态后，旧轮询或旧响应头覆盖新版本，导致前端误解禁或误冻结；同版本的计划维护旧快照还会撤销刚生效的冻结 | Store 拒绝旧版本，同版本不撤销已生效的定时维护；保留新版本恢复和同版本到点生效；维护 HTTP 写保护测试通过 |
| FE-BUG-02 | P2 | 顶层轮询组件卸载后，未结束的成功或失败请求仍修改全局维护状态 | 两种返回路径都核对已停止标志；卸载后迟到成功/失败均不写 Store |
| FE-BUG-03 | P1 | A 租户表单校验或危险确认挂起时切到 B，后续读取当前 tenantId，把 A 的规则、Webhook、密钥或自助申请目标用于 B | 表单或操作捕获租户和作用域代次；校验、确认及 API 返回后复核；切租户清理表单和敏感详情。覆盖规则、Webhook、密钥轮换/撤销、配额申请、重跑和补偿 |
| FE-BUG-04 | P2 | 切租户或重复刷新后，旧成功/失败响应覆盖当前列表、错误态、加载态或配额候选；旧租户加载中还会阻止新配额请求 | 各独立数据源有独立序号，结果绑定租户与组件生命周期；切换同步清空旧数据。覆盖通知/配置日志、规则/Webhook/密钥、自助失败实例/审计/订阅/配额/用量及标签搜索 |
| FE-BUG-05 | P2 | 自助订阅页读取 ruleCode/eventType/severity，而适配器实际提供 ruleName/eventTypes/severityFilter，导致关键单元格为空 | 复用 API 返回类型，使用真实字段和既有规则名称文案；回归断言实际显示的名称、事件和级别 |
| FE-BUG-06 | P1 | 选择另一份 Excel 或重新上传时仍沿用旧上传令牌/预览；旧上传、预览或行修复回包还能恢复旧会话，确认后可能应用与所选文件不同的配置 | 文件变化及新上传使旧令牌、预览和草稿失效；上传/预览/行修复/下载/应用绑定文件会话，确认后复核两个令牌；阻止预览、行修复与应用交错；更换文件、确认中换文件和卸载回归通过 |
| FE-BUG-07 | P2 | 共享作业搜索中旧关键词覆盖新关键词；A 租户在途默认搜索占住 loading，切 B 后不加载且迟到显示 A 的作业 | 租户变化清空并失效旧搜索，允许新租户即时加载；同租户后发搜索优先，清空选项同时失效在途结果 |
| FE-BUG-08 | P2 | 管理员触发器列表可以包含多租户，原自助暂停表单直接将所有 workflowCode 作为当前租户动作选项 | 按选定租户筛选有 tenantId 的触发器，避免把其他租户 Workflow 编码用于当前租户；回归包含不同租户列表 |
| FE-BUG-09 | P2 | 自助暂停/恢复切租户后保留旧 workflowCode，下一次提交将旧选择用于新租户 | 切换时重置 Workflow 和动作；提交捕获目标及动作，迟到返回不提示或刷新新租户；回归验证必须重新选择 |

FE-BUG-03 是操作目标错误；后端仍是授权和租户隔离的最终边界。FE-BUG-01 的前端冻结也不代替后端维护过滤器。没有新增 API 字段或修改生成类型，`gen:api:check` 已确认与配对后端契约同步。

## 关键实现与测试

- [租户请求作用域](../../src/composables/useTenantRequestScope.ts)：后发请求、A→B→A、组件销毁及空租户均有独立回归；未改变全局 `useTenantReload` 的空租户契约。
- [共享列表三态](../../src/composables/useListLoadState.ts)：可选当前请求判定同时保护 error/loading，失效请求仍向调用方抛错，不吞掉真实请求失败。
- [通知规则回归](../../src/views/system/components/NotificationRulesTab.test.ts)、[Webhook 回归](../../src/views/system/components/NotificationWebhooksTab.test.ts)、[敏感操作回归](../../src/views/system/components/SensitiveTenantActions.test.ts)。
- [系统列表回归](../../src/views/system/components/SystemTenantReads.test.ts)、[触发器与标签回归](../../src/views/system/components/TriggerAndTagTenantRisks.test.ts)、[作业搜索回归](../../src/composables/useJobCodeSearch.test.ts)。
- [导入回归](../../src/views/config/TenantPackageImportWizard.test.ts)、[维护写保护](../../src/api/interceptors.maintenance.test.ts)、[轮询卸载回归](../../src/composables/useMaintenancePolling.test.ts)。

## 命令与结果

命令在上述前端工作树执行。首次有效失败与修复结果分别保留，不以原有通过替代本轮复验。

| 命令或阶段 | 实际结果 | 证据边界 |
|---|---|---|
| 修改前 `npm run test:unit` | 198 文件 / 1,134 用例通过 | 原有用例未覆盖本次异步竞争 |
| 新增问题回归首次运行 | 维护/规则 7 个有效失败，Webhook 3 个，敏感操作 4 个，导入 2 个，作业搜索 2 个，触发器/标签 3 个；列表组另有有效失败 | 延迟 Promise 定向复现；列表组首次还存在缺 QueryClient 和表单桩方法的夹具错误，已纠正，夹具错误不计 Bug |
| `npm run test:unit`（修复后） | 206 文件 / 1,176 用例通过，0 失败、0 跳过 | 本地单元/组件回归；不是共享后端 E2E |
| `npm run build` | 通过，含 Vue/TS 应用与测试类型检查、i18n 语法和生产打包 | 首次构建发现两处新增测试夹具类型错误，修正后完整重跑通过；没有放宽 tsconfig |
| `npm run lint:check` | 通过 | 只读静态辅助检查，不作为 Bug 数量或业务正确性证明 |
| `npm run gen:api:check` | 通过 | 与配对后端 OpenAPI 同步；无 API 契约变更 |
| Playwright CLI 浏览器隔离验证 | 两组场景通过 | Chromium，1440×1000，中文、深色主题、管理员夹具；通知租户切换/旧响应、实际文件选择器的旧上传/文件更换；所有 `/api/` 请求在浏览器拦截 |
| 前端 `npm run check:docs`、`npm run check:changelog` | 通过 | 当前文档 75 个；Changelog 检查仍提示一份既有 CSV 的 CRLF 转换警告，未改该文件 |
| 后端 `python3 scripts/ci/check-docs-structure.py`、`python3 scripts/ci/check-code-doc-references.py` | 通过 | 后端本轮只追加文档互链 |
| 本轮三份审查/修复记录的相对链接核对 | 43 个文件链接均存在 | 包含前后端跨仓跳转；补足当前文档门禁排除日期报告的扫描边界 |

当前本机原始日志以 `/private/tmp/wdi-fe-` 为前缀：`first-red`、`reads-red`、`webhooks-red`、`sensitive-red`、`import-red`、`job-search-red`、`trigger-tag-red`、`unit-final`、`build-final`（夹具类型失败）、`build-final2`（通过）、`lint-final`、`api-drift`/`api-final`、`type-fixtures-final`（类型修正后两文件 14 例通过）、`browser-regression-final`、`browser-workbook-final`。这些是本地原始证据路径，跨机器不保证存在；上表和源码回归保留可复核的方法和结果。

## 浏览器证据

1. 通知页人为挂起 A 的规则刷新，打开新建规则弹窗后从实际租户选择器切到 B：弹窗关闭，B 列表加载；放回 A 响应后仍只有 B 的规则，加载遮罩正常结束。浏览器返回 `drawerClosedOnTenantSwitch=true`、`lateTenantAResponseIgnored=true`、`loadingCleared=true`。见[通知切租户截图](assets/2026-10-26-frontend-bugs/notification-tenant-switch.png)。
2. 配置包页通过实际文件输入选择 A.xlsx 并挂起上传，改选 B.xlsx 后放回 A 响应：停在上传阶段且不产生旧预览；B 上传/预览后返回上一步改选 C.xlsx，下一步禁用。最终请求为 2 次上传、1 次预览，浏览器返回 `oldUploadDidNotPreview=true`、`newFileRequiresUpload=true`。见[新文件会话重置截图](assets/2026-10-26-frontend-bugs/workbook-session-reset.png)。

上传内容仅为 .xlsx 文件元数据夹具，由模拟端点接收，没有真实 Excel 解析或数据库应用。首次浏览器尝试有夹具范围和响应形状问题（Vite 模块误拦截、TenantPage.items、响应 envelope 字段、上传查询参数）；修正夹具后重跑通过，夹具故障没有记为业务 Bug。一次等待错误上传匹配的会话已终止，只清理本轮自建进程。

## 验收边界

- 本轮为代码 Bug 与运行风险审查，不是新一轮规约改写。先前工程门禁通过只作为辅助背景，没有把它计为“Bug 全部消除”。
- 浏览器数据采用夹具，不能证明真实权限、数据库写入、最终通知或服务降级已经端到端验收；未启动默认 Playwright 全局造数/清理，也未执行维护真实环境的全局开关。
- 后端已有真实 PostgreSQL/SQLite/Kafka 验证见其原记录；前端这轮没有重新计算后端测试数，也未重新执行后端整套测试。
- 未证明全页面、全角色、移动端和所有失败交错均已穷尽；本地通过不等于 CI、部署或生产通过。

## 全工程逐文件续审状态

用户进一步明确要求前后端均完成逐文件 Bug 审查。范围、验收、基线和下一步见[双仓任务状态卡](../../../file-batch-system/docs/plans/todo-master.md)，前端具体范围见[逐文件清单](2026-10-26-frontend-bug-file-coverage.csv)。初始登记 1,205 个代码/测试/脚本/配置文件，所有文件先记待审，不能将本报告前轮 9 组修复或全量单测视作全量语义审查完成。新增问题和证据按后续批次追加；当前状态为进行中。

## 全工程续审：第二批

本批继续核对共享异步状态、移动分页和 Workflow 设计器。新增六组确认问题已本地修复，保留前轮九组证据；全量审查仍在进行，不把全量单测当逐文件审查完成。

| ID | 级别 | 确认的错误与修复 |
|---|---|---|
| FE-BUG-10 | P2 | 移动无限列表加载中 reset 失效旧请求但不释放 loading，后续刷新永久跳过；reset 同步释放旧忙碌状态，新第一页立即加载，迟到结果忽略 |
| FE-BUG-11 | P2 | 同一作业候选消费者先 A 后 B 的响应乱序覆盖，clear 后旧响应重新填充本地选项；共享网络去重与消费者请求代次分离，保留两消费者同租户合并请求 |
| FE-BUG-12 | P2 | 共享导航徽章用单一 busy 阻止切租户加载，旧租户计数迟到显示；同步切租户清空计数、解除旧忙碌标志，回包绑定租户和代次 |
| FE-BUG-13 | P2 | 旧编辑锁申请/续租/释放完成可覆盖新画布锁，卸载后仍写共享状态；锁操作绑定独立会话，旧回包失效，释放先解除本地上下文，销毁清理定时器 |
| FE-BUG-14 | P2 | 旧详情/租户回包覆盖当前设计器、新建继承旧名称，普通 KeepAlive 缓存多个实例共用同一画布；设计器保持单活动实例、离页销毁，详情绑定代次及租户，完整重置元数据；离页和切换定义保护未保存内容 |
| FE-BUG-15 | P2 | 保存请求期间继续编辑，旧回包把新编辑误标已保存；新建成功重载还会覆盖新编辑；按实际提交快照更新基线，新建路由升级保留草稿并取得真实锁，撤销回已提交版本可恢复干净状态 |

主要回归：[无限列表](../../src/composables/useInfiniteList.test.ts)、[作业候选](../../src/composables/useJobCodeOptions.test.ts)、[导航徽章](../../src/stores/mobileBadges.test.ts)、[锁会话](../../src/composables/useLockManager.test.ts)、[设计器](../../src/views/workflow/designer/WorkflowDesigner.test.ts)和[画布 Store](../../src/views/workflow/designer/store/useDesignerStore.test.ts)。均验证实际结果和必要调用边界；迟到响应、取消离页、明确放弃、原正常分页/锁续期及撤销行为分别覆盖。

```sh
npx vitest run src/views/workflow/designer/WorkflowDesigner.test.ts src/views/workflow/designer/store/useDesignerStore.test.ts src/composables/useLockManager.test.ts
npm run test:unit
npm run build
```

- 首红：分页/候选共 4 个、徽章 2 个、锁 4 个、详情 4 个、保存期间编辑 2 个有效失败。新增离页保护测试首次因没有路由守卫而失败，此为保护覆盖，不能再单算一个独立 Bug。
- 最新全量单元/组件回归 **209 文件、1,198 用例通过，0 失败/跳过**；构建通过，包含应用/测试类型、i18n 语法、Vite/PWA。新增确认框夹具的 Element Plus 交叉返回类型曾使构建失败，修正夹具后完整重跑，未放宽检查。
- 本机日志以 `/private/tmp/wdi-bug-continuation-`、`/private/tmp/wdi-bug-designer-` 为前缀。`front-suite2.log` 为最新全量，`front-build3.log` 为类型夹具修正后的构建；首红及定向结果保留对应文件，不累加同一用例的重复执行次数。
- 浏览器与文档检查在本节后续补记实际结果；没有真实后端写入或全角色/移动端验收。

未接入生产的 `usePagination`、`useRouteFilters` 和 `useProgressEta` 可疑分支不计本轮运行 Bug；不能只据模式检索计缺陷。锁申请在服务端已受理但本地会话失效时仍可能占用到 TTL；无会话 token 时不盲目发旧 DELETE，后端版本/锁是最终保护，暂不宣称卸载请求必达。

## 全工程续审：Outbox 运维目标与结果

| ID | 级别 | 触发、结果与修复 |
|---|---|---|
| FE-BUG-16 | P1 | Outbox 危险确认或批量排队期间切租户，回调动态读取新 tenantId，旧事件用于新租户；旧列表也会覆盖新结果。操作捕获租户/操作者/代次，确认后及每次排队发送前复核权限和维护状态；读请求独立失效，切租户清理列表/详情/选择，旧批次不提示或清除新上下文 |
| FE-BUG-17 | P2 | 页面错误排除 GIVE_UP、允许 NEW 等不可重置状态，且 HTTP 成功即累计重投成功，忽略服务端实际 resetCount。资格改为 FAILED/GIVE_UP，响应类型对应现有 DTO，单项 resetCount 非 1 计失败，不把零重置当实际重投 |

[Outbox 组件回归](../../src/views/observability/OutboxList.test.ts)覆盖确认中切租户、四项在途后剩余排队停止、旧列表晚到、GIVE_UP 成功/零重置、权限撤销、维护冻结、FAILED 并发零重置和 NEW 拒绝；与原[批量能力回归](../../src/composables/useBulkSelection.test.ts)共 **14 项通过**。前五个问题回归均先在旧实现失败。

后端同步收紧两写端点的真实方法权限，见[后端验证](../../../file-batch-system/docs/verifications/backend-bug-remediation-2026-10-26.md#全工程续审outbox-写权限)；前端按钮隐藏不作为授权边界。管理员和租户管理员可重投，审计员保持只读。

最新全量与文档检查在最终核对段记录，不重复累加同一用例。OpenAPI 当前通用响应没有新增字段；本地响应类型按现有 `ConsoleOutboxRepublishResponse` 对照，未改变线上 JSON 形状。

## 续审浏览器复验

Chromium，1440×1000，中文管理员夹具，全部 `/api/` 由浏览器拦截，不连接真实后端。验证实际应用 Router 的 1→2→1→新建切换，旧定义锁 DELETE 均出现，新建名称/编码清空；对未保存画布取消离页保持内容，明确放弃后可离页。最终结果 `passed=true`，见[浏览器截图](assets/2026-10-26-frontend-bugs/designer-new-clean.png)。

首次续验夹具动态导入产生第二个 Router，表现为 URL 与活动组件路由不同；改用应用实际实例后通过。随后弹窗关闭动画导致按钮重复匹配、Vite 懒加载优化触发页面刷新，分别修正定位和等待稳定后完整重跑；这些工具/夹具失败不计产品 Bug。通过日志 `/private/tmp/wdi-bug-designer-browser6.log`。保存期间编辑的快照/撤销行为由组件回归验证，本轮未做真实后端写入或目标部署浏览器验收。

## 续审最终核对

新增 Outbox 修复后重新执行 `npm run test:unit`：**210 文件、1,207 用例通过，0 失败/跳过**；`npm run build` 通过，日志为 `/private/tmp/wdi-bug-continuation-front-suite3.log` 和 `front-build4.log`。这些结果替代前文同轮较早的 1,198 快照，不将重复执行相加。

设计器未提交 description/调度字段的候选已沿后端 fullUpdate 排除：说明取已存实体，省略调度字段保留原配置；未据缺省请求字段误报 Bug。最终截图等待路由过渡、新画布空态与加载遮罩结束后保存；不采用确认框关闭中的过渡帧。

全工程逐文件审查仍在进行，当前分母及已审/部分审查状态以[覆盖清单](2026-10-26-frontend-bug-file-coverage.csv)和[任务状态卡](../../../file-batch-system/docs/plans/todo-master.md)为准。

## 续审静态检查与工作区核对

- 前端 `npm run lint:check`、`npm run gen:api:check`、`npm run check:docs`、`npm run check:changelog` 通过；Java 本轮文件 `spotless:check`、显式类型/配置代理检查通过。后端文档结构、路径引用、日期命名和 Changelog 同步通过。
- 全局 `python3 scripts/ci/check-test-conventions.py --check-baseline docs/governance/test-conventions-baseline.txt` **失败**：同期新增、非本轮修改的 `RelatedFileReferenceValidatorTest.java` 有 3 个测试方法不符合命名约定；初始工作区快照中没有该文件。本轮没有改写该文件或放宽基线。直接使用同一守卫的 `scan_file` 核对本轮修改的 3 份测试，缺口为 0。此项为工程约定失败，不计业务 Bug，也不写为整体门禁通过。
- 已登记审查文件的 SHA-256 与当前源码一致；双仓 HEAD 和暂存差异均与本轮开始一致。本次源码、测试和文档继续留在原专用工作树，未提交、未发布。
- 自建浏览器会话关闭，核对命令和工作目录后仅停止本任务 15174 端口的 Vite；真实 PostgreSQL 仅使用测试隔离容器，不清理其他任务资源。

## 全工程续审：实例、告警和 Workflow 运行入口

| ID | 级别 | 已确认错误与修复 |
|---|---|---|
| FE-BUG-18 | P2 | 作业实例列表、状态计数、作业提示的旧租户回包覆盖当前结果，清空租户仍保留旧数据；各数据源独立代次，查询捕获租户，切换同步清空旧列表/计数/候选 |
| FE-BUG-19 | P2 | 批量重试/取消只在确认后比较 tenant 字符串，A→B→A 旧确认仍有效，排队项在切换后继续发送，旧结果在新租户弹出；确认和逐项发送核对代次、租户、操作者及写权限，旧批次不改当前选择和结果窗 |
| FE-BUG-20 | P2 | 部分失败与演练成功/失败终态遗漏，被作为可取消项；补全与 JobInstanceStatus 一致的终态，详情复用同一分类；不扩大业务重试政策 |
| FE-BUG-21 | P2 | 实例详情的取消、终止、失败分区重试在确认后读取新租户，切实例也能继续操作旧目标；操作捕获实例/租户/操作者并复核，迟到诊断/步骤/最近运行及旧加载完成不影响新目标 |
| FE-BUG-22 | P1 | 告警筛选对象保留初始 tenantId，切 B 后仍请求 A，旧列表和计数也会回写；切换同步更新查询租户并清空数据，列表和计数分开按代次处理 |
| FE-BUG-23 | P2 | 告警确认/静默/关闭的原因输入期间切租户，随后将旧告警 ID 与新租户/主体组合；两次确认后、发送前及返回后复核同一上下文和当前状态 |
| FE-BUG-24 | P2 | Workflow 深链筛选在 onMounted 才赋值，初次请求已经按全部 Workflow 发出；编码到定义 ID 的异步解析完成后也不重拉。初始化先解析 URL，非空编码等定义就绪，定义请求按租户复用，迟到结果失效 |

[实例列表回归](../../src/views/monitor/JobInstanceList.test.ts)与[终态分类](../../src/views/monitor/jobInstanceBulk.test.ts) **21 项通过**；[详情/告警/Workflow 上下文回归](../../src/views/monitor/MonitorContextRisks.test.ts) **13 项通过**。首红分别为 7 个和 9 个有效失败。新增计数/候选测试最初缺工具栏/选择器插槽，补齐夹具后通过；该夹具问题不计产品 Bug。

最新统一执行 `npm run test:unit`：**212 文件、1,232 用例通过，0 失败/跳过**。`npm run build` 通过，包含应用/测试类型、i18n、Vite/PWA；这些结果替代前文同轮较早的 1,207/1,217 快照，不将重复执行相加。日志分别为 `/private/tmp/wdi-bug-completion-front-unit-final.log` 和 `front-build-final.log`。

前述全局 3 个后端测试命名缺口已在本段后续处理，相关 3 项测试与全局命名守卫通过，不再作为当前阻断。证据均留在原双仓工作树，未提交或部署。当前新增页面的交错验证为组件/API 夹具层，没有宣称真实登录会话、数据库动作或全角色浏览器联验完成。


## 本段统一检查及共享工作树变化

- 前端最新全量 1,232 项、生产构建、lint、API 漂移、当前文档和 Changelog 检查通过；后端本次文件 Spotless、Java 可读性、测试命名、文档结构/引用/日期/Changelog 检查通过。未改基线、白名单或跳过有效错误。
- 双仓 HEAD 仍为本段开始版本；本任务没有执行暂存、提交或发布，但发现暂存区存在同期变化，保留该状态，不能再将“暂存差异与开始一致”当作当前结论。
- Worker 消费协调器在最初验证后发生同期日志脱敏变化；已复读新源码并重跑 78 项全部通过，更新其内容摘要。此轮重复执行不增加用例总数。前端已登记审查文件无内容漂移。
- 日期记录和覆盖清单分别保留已确认问题关闭、源文件覆盖与外部环境未验状态，整体逐文件目标仍未完成。


## 全工程续审：审批、分区及依赖等待操作

| ID | 级别 | 已确认错误与修复 |
|---|---|---|
| FE-BUG-25 | P1 | 普通审批/拒绝与批量确认后动态读取新 tenantId，A→B→A 也沿用旧确认；旧查询覆盖当前审批和选择。操作绑定租户、主体和代次，确认后复核当前待办与写权限；查询独立失效，切换立即清除列表、选择和详情。后台最终权限与审批资格仍由服务端裁决 |
| FE-BUG-26 | P2 | 分区确认后离开实例仍提交旧分区，旧查询覆盖新实例；查询与动作绑定实例及租户，路由/租户变化同步失效。只读角色按钮禁用；当前查询失败显示可见错误，异步分页和路由加载不产生未处理拒绝 |
| FE-BUG-27 | P2 | 日历依赖等待输入原因期间切租户或 A→B→A 后仍发送原租户 RELEASE/SKIP；确认后再次核对代次、操作者、维护/权限及当前等待状态。已发出请求不撤回，旧回包不提示或清理新租户忙碌状态 |

[操作上下文回归](../../src/views/approvals/ActionContextRisks.test.ts) **19 项通过**，包含单条审批/拒绝、批量两类确认、旧列表乱序、分区离页、依赖等待 ABA、权限失效、维护冻结、正常审批/批量/分区/等待操作及可见查询错误。原实现 13 项中 10 项有效首红，`/private/tmp/wdi-bug-completion-approval-red.log`；最终定向结果 `approval-green3.log`（同前缀）。一次追加测试因 BulkActionBar 夹具缺少名称而失败，补齐夹具后通过，不计产品 Bug。`npm run typecheck` 通过（`approval-types.log`，同前缀）。

运行层级为真实 Vue 组件、组合式生命周期和 API 替身；没有执行真实审批/取消或生产依赖等待修改。运行指引同步[运行与审批](../user-guide/runs-and-approvals.md#审批分区与等待的确认上下文)。本节是上段统一验证之后的新改动，最终全量结果另记，不能引用较早 1,232 项快照代替当前源码。

## 全工程续审：共享确认、Workflow 详情与运维

| ID | 级别 | 已确认错误及修复 |
|---|---|---|
| FE-BUG-28 | P2 | 共享 `confirmDanger` 在租户、主体、权限、登录或维护状态变化后仍 resolve，使其他未做局部围栏的调用方继续旧确认。统一入口同步观察这些上下文，变化后沿用原取消拒绝，finally 解除观察；权限集合重新排序不误取消，正常确认与用户取消保持原契约 |
| FE-BUG-29 | P2 | Workflow 详情只比较当前 tenant/run 字面值，A→B→A 或运行往返仍通过旧确认；旧节点查询可覆盖新运行，迟到重放预览还会弹出旧目标确认。运行主读、节点读和操作独立代次；路由/租户同步失效并清空，预览/确认/提交返回分别复核，忙碌状态不清理其他会话 |
| FE-BUG-30 | P2 | Worker 排空/强制下线/接管确认后读取新 tenantId，预热/旧操作返回刷新新租户缓存；渠道查询晚到覆盖当前列表。动作捕获租户、主体与当前 Worker 状态，确认和结果分别复核；渠道独立作用域，切换清空列表/详情，后台错误由表格呈现 |
| FE-BUG-31 | P2 | 调度快照/历史的旧请求覆盖当前租户，清空租户仍显示旧快照。整轮请求捕获租户和代次，切换同步清空，旧整轮结果不改当前状态和成功提示；全局调度暂停/恢复仍保持其既有全局目标 |

最后一组定向回归命令：

```sh
npm run test:unit -- src/views/worker/OperationalContextRisks.test.ts src/views/approvals/ActionContextRisks.test.ts src/composables/useDangerConfirm.test.ts
```

**46 项通过**，分别为 12 项 Worker/快照、26 项审批/分区/等待/Workflow、8 项共享确认。包含前节 19 项，不累加重复执行。共享确认的 6 项、Workflow 的 6 项、运维最终有效的 6 项均先在旧实现失败。运维首轮快照测试遗漏标签插槽，补齐后复跑确认真实租户文本的失败；以 `ops-context-red2.log` 为有效快照首红，不将夹具失败算产品缺陷。

日志均在 `/private/tmp/wdi-bug-completion-` 前缀下：`danger-red.log` / `danger-green.log`、`workflow-context-red.log` / `workflow-context-green.log`、`ops-context-red2.log` / `ops-context-green3.log`。这些为组件/API 替身及共享 Promise 边界验证，没有执行真实 Worker 排空/退役、Workflow 重放、审批或全局调度停启。

统一危险确认只兜住共享的租户/主体/维护变化，不能替代各页面实例/节点/预览的业务校验；已经提交的请求仍由服务端权限、版本和幂等裁决。当前全量回归与构建快照在后续最终核对段更新。


## 全工程续审：认证资料的会话边界

**FE-BUG-32 / P2**：`fetchMe` 只按返回时 tenantId 判断，退出/重新登录后同租户旧响应还能恢复旧账号、菜单/权限及 `profileLoaded`；A→B→A 的旧请求 finally 也会清空新请求复用记录，产生第四次请求并允许旧资料覆盖。

增加请求代次：登录/退出开始和完成时使旧资料失效；租户变化同步失效，实际资料刷新保留原异步时序，等待租户存储更新完成。只有当前请求能落地或解除复用，Store 销毁时失效；后台刷新失败有记录并承接拒绝，后续仍可重试。不改变 Cookie、后端角色校验或登录 API。

真实 Pinia Store 的三个反例先失败后通过：退出后资料恢复、重新登录新身份被覆盖、租户往返的额外请求。第一次夹具未为意外第四次调用提供响应而多出未处理拒绝，补充有效响应后仍有三个相同断言失败，采用 `/private/tmp/wdi-bug-completion-auth-red2.log` 为有效首红。认证/租户/权限指令/共享确认 **43 项通过**：

```sh
npm run test:unit -- src/stores/auth.test.ts src/stores/tenant.test.ts src/directives/permission.test.ts src/composables/useDangerConfirm.test.ts
```

通过日志 `/private/tmp/wdi-bug-completion-auth-green2.log`。包含现有并发复用、租户角色、密码提醒与正常资料加载，不重复累加前文共享确认的 8 项。验证层级为 Store 和 API 替身，未宣称真实 Cookie/多账号浏览器会话验收。用户说明同步[快速入门](../user-guide/getting-started.md#退出登录)。


## 本段最终验证快照

- 前端 `npm run test:unit`：**217 文件、1,289 用例通过，0 失败/跳过**；`npm run build` 通过（应用/测试类型、i18n、Vite/PWA）。最终日志 `/private/tmp/wdi-bug-completion-front-unit-final7.log`、`front-build-final7.log`。较早 1,283/1,287 快照被此结果替代，不累加重复执行。
- 认证测试夹具曾缺少登录适配器返回类型的必填 token，导致构建类型失败；补齐与邻近 fixture 一致的测试值后，全量回归和构建重新通过，没有放宽检查或修改登录业务以迁就测试。
- `npm run lint:check`、当前文档、Changelog 通过（`front-*-final6.log`）；API 漂移在同期生成类型未完成格式化时失败，保留首红，待生成结束后 `npm run gen:api:check` 通过（`front-api-final7.log`）。本任务没有覆盖或提交同期生成文件。首次核对时无随后变化；之后共享工作树的 dashboard、SLA 展示及 OpsSummary 共 5 份来源又有同期变动，后续补验单独记录，不再将较早快照视为这些新来源的证据。
- 后端最新 `./mvnw -ntp -DskipTests test`：**17 模块生产与测试源码编译通过**（`reactor-compile-final3.log`）；此命令跳过测试执行。Worker 78、遥测 13、Workflow/调度 101 与前段事务/权限结果保留各自命令和范围，不误写成全 reactor 测试通过。
- 双仓 HEAD 仍为本段既有版本；本任务未创建分支/工作树，未暂存、提交或发布。共享工作树有同期暂存、源码、契约及生成文件变化，均保留；新增入口纳入待审，不用先前通过快照覆盖新来源。
- 本段最后未再次启动真实浏览器、生产服务、Kafka 故障注入或部署验收。组件/API 替身、Store、真实 PostgreSQL 与编译证据分别标注；本报告列出的已确认项本地修复关闭，不代表全工程逐文件审查关闭。


### 同期 SLA 来源的后续验证

共享工作树后续改变了 dashboard/SLA 展示/运维汇总来源。保留这些改动后重新执行全量前端回归：**218 文件、1,290 项通过，0 失败/跳过**，生产构建通过。日志 `/private/tmp/wdi-bug-completion-front-unit-final9.log`、`front-build-final9.log`；这是晚于 1,289 快照的实际结果，不按新增文件数推算用例数。相关来源仍按审查范围保留待审，测试通过不将其语义审查销项。


### 共享构建产物的并发失效

全模块编译后同期调整了 `ConsoleSlaReportResponse`，补验 Console 时测试编译一度报告 AI、审批、RBAC 等大量现有包缺失（`/private/tmp/wdi-bug-completion-console-compile-final4.log`）。源码、package 和 import 均存在，失败后同一输出目录又恢复 1,791 个 class，包含原报错的 AI 配置与 Mapper；本任务没有在此间改这些源码或生成这些 class。记录为共享构建产物并发更新，不按报错改写正常业务引用。恢复后重跑结果另记，旧全模块通过不覆盖此首红。


恢复后执行 `./mvnw -ntp -pl batch-console-api -am -DskipTests test` **通过**，7 个受影响及依赖模块生产/测试源码编译成功、跳过测试（`/private/tmp/wdi-bug-completion-console-compile-final5.log`，21:14:28）。未改写报错引用，保留并发产物缺失首红。最后一次前端来源 mtime 复核没有晚于 `front-unit-final9.log` 的代码变化；已审/部分审查文件 SHA-256 与覆盖清单一致。全工程未审项继续见 TODO Master，不在此销项。


## 全工程续审：配置发布与补跑审批

**FE-BUG-33 / P2，配置发布上下文失效。** `ConfigReleaseList.vue` 原列表/详情/依赖回包可恢复旧租户内容；创建表单等待异步校验后才读取 tenantId，可能将 A 的草稿提交到 B；回滚第二次原因输入及提交审批没有复核租户、主体、写权限和维护状态。回滚使用行内旧 tenantId 时也可能在当前 B 页面继续修改 A 的对象，属于操作目标错误，未将其称为后端越权。

复用已有租户请求作用域，读取按各自面板/请求代次落地；切租户立即清空列表、详情、依赖、对比选择与创建草稿。写入捕获原租户与字段，校验、确认及原因输入之后再次核对；关闭重开表单、切主体、撤权或维护变化使旧操作失效，提交忙碌覆盖异步校验以拒绝重复创建。正常创建、回滚、审批仍保留原字段与版本约束；后端仍作最终授权、状态及版本裁决。

**FE-BUG-34 / P2，补跑审批旧读取覆盖。** `CatchUpApprovalsTab.vue` 的旧租户/旧页回包可覆盖新列表，旧失败可清空新列表并设置错误，切租户仍保留已打开的旧详情。列表绑定最新请求及租户，成功、错误与 loading 均校验代次；租户切换立即重置列表、页码和详情，当前请求失败与重试契约保留。

首红日志：`/private/tmp/wdi-config-release-red.log`（9 失败、2 通过）、`/private/tmp/wdi-catchup-approval-red.log`（4 失败、1 通过）。新增扩展用例首次因测试抽屉选择器未找到组件失败，修正为实际渲染根节点后再运行，没有修改业务断言或缩减覆盖。最终定向命令与结果：

```sh
npx vitest run src/views/config/ConfigReleaseList.test.ts \
  src/views/approvals/components/CatchUpApprovalsTab.test.ts \
  src/views/scheduler/batchDayCommandRecovery.test.ts \
  src/views/scheduler/batchDayGovernance.test.ts
```

**4 文件 / 28 项通过，0 失败或跳过**，日志 `/private/tmp/wdi-config-catchup-green3.log`。配置页初步类型检查与定向 ESLint 通过；本段最终类型、门禁和构建结果在后续验证段补记，未将已有全量测试快照用于新增来源。测试使用组件/API 替身，没有宣称真实跨账号浏览器或生产配置发布验收。批量日命令恢复和可用动作两个纯逻辑模块已逐行核对身份范围、原幂等键保留、期限、损坏存储及真实日期边界，没有新增确认 Bug。


## 全工程续审：配置同步输入快照与同步审计

**FE-BUG-35 / P2，已修复并定向验证。** 同步确认前解析 JSON、读取目标，但确认后重新读取环境；用户在确认期间改变环境、目标或 JSON 仍会发送原命令，结果与当前表单不一致。预览仅在编辑时清除已展示结果，迟到回包仍能恢复旧差异；导出仅比 tenantId 字符串，无法识别 A→B→A 或空租户，旧结果仍可下载、复制。导出和预览共用结果面板时，较早请求迟到还会覆盖较新操作的结果。

写入使用确认前完整输入快照和输入代次，输入、租户、主体、写权限或维护变化使旧确认失效。导出、预览、租户候选分别绑定请求作用域；空租户、组件销毁与上下文切换失效旧响应，导出输入变化同时移除旧复制入口；最新用户动作决定结果面板。确认阶段已进入忙碌状态以阻止重复确认，正常导入、业务失败统计和手动 JSON 预览保持原契约。首红为 `wdi-config-sync-red.log`（8 失败、1 通过）；补充结果交错首红 `wdi-config-sync-race-red.log`（2 失败、13 通过）。

**FE-BUG-36 / P2，已修复并定向验证。** 同步审计的租户代次只在 `useTenantReload` 默认异步回调中更新，空租户被该通用入口跳过，A→B→A 也可能被合并。旧列表或核对结果因而仍能恢复旧记录并提示成功。改为同步失效列表序号和租户代次、清空记录与忙碌/错误状态，保留原读取与核对流程；空租户不发请求。首红 `wdi-config-sync-log-red.log`（3 失败、9 通过），修复后与同步、发布、补跑组件合跑 **4 文件 / 48 项通过**，日志 `wdi-config-sync-all-green2.log`。

这两项只关闭已复现的输入/页面上下文问题。配置导入响应丢失后的原请求身份、审计回执查找与新命令放行仍需专项补审：服务端未知结果会保留 RUNNING，不能以失败 toast 或读取不到记录判定未执行。当前通用客户端仅短时复用自动幂等键，尚未验证页面重试、刷新后的完整收敛；此项保留待办，不将本段通过写成配置导入全链路审结。


### 新增配置来源的统一验证快照

`npm run test:unit`：**221 文件、1,329 项通过，0 失败/跳过**；`npm run build`（包含应用与脚本类型检查）、`npm run lint:check`、`npm run check:docs`（75 份当前文档）、`npm run check:changelog` 全部通过。日志统一前缀 `/private/tmp/wdi-bug-audit-front-`，见 `unit-current.log`、`build-current.log`、`lint-current.log`、`docs-current.log`、`changelog-current.log`。较早构建的新增测试选择器类型错误已保留首红，具名组件选择器修复后通过；没有关闭类型检查或弱化业务断言。

逐文件范围当前 **1,222**：85 已审、24 部分审查、1,113 待审。配置同步组件保留部分审查，未将未知提交结果的恢复路径视为已验。两仓 HEAD 与工作分支保持原值，变更留在原 wdi-current 工作树，未提交、发布或更新真实服务。


## 全工程续审：配置同步未知结果的原命令恢复

**FE-BUG-37 / P2，已修复并分层验证。** 配置同步发生响应丢失或服务端提交后审计异常时，原页面只显示“应用失败”，随后可以再次发起导入，刷新页面也不保留原身份。通用客户端的短时自动键复用不能覆盖业务恢复；换键会形成另一笔目标处理和审计，丢失原回执关联。默认 SKIP_EXISTING 不等于按原操作核对，未将此问题夸大为默认覆盖已有配置。

修复范围：

- 发送前在本标签页保留原键、操作者/租户作用域、创建时间及输入 SHA-256 摘要；按部署路径和 API 地址隔离，配置正文不写浏览器存储。损坏或不可用存储、非法键或无法可靠计算摘要时阻止导入。
- 存在未知命令时阻止新导入；恢复原环境、目标租户和等价 JSON 后可在23小时内沿原键重试，输入变化不能借原键发送另一份配置。超过期限保留身份供核对，不再自动重试。
- 新增管理员原请求查询 API；未找到或 RUNNING 均保留未知。RUNNING 只按日志 ID 核对持久目标收据，不能重新执行配置。已确认终态后清除对应记录和旧输入；旧回包不能删除另一条命令，切租户后不把核对结果写到新页面。
- 初次请求被明确参数/权限等4xx拒绝可更正后重提；对未知原请求的重试，即使被403或409拒绝也不据此判定原请求未执行。维护期间允许读取已确认结果，写核对仍受现有冻结守卫约束。

首红 `/private/tmp/wdi-sync-unknown-red.log`：2 项失败、15 项原回归通过，覆盖重复点击和重挂载后再次提交。新增恢复、存储、环境隔离、客户端头和页面正反例合跑 **4 文件 / 52 项通过**（`/private/tmp/wdi-sync-unknown-green5.log`）。真实 WebCrypto 用于输入摘要；首次测试直接引入 Node 类型导致应用类型检查失败，改为 Vitest 运行时加载 Crypto 接口，保留浏览器类型范围，没有关闭或修改类型检查。

后端真实 PostgreSQL/认证 HTTP 验证原请求查找、RUNNING→终态、原键重提不执行目标、错误租户未找到及非管理员403。组件/API替身与真实服务证据分别保留，未将其称为真实浏览器丢包端到端演练。新增查询、生成类型、API 客户端及中英文提示已同步，OpenAPI 432 路由和生成类型漂移检查通过。

前文 FE-BUG-35/36 后保留的“原命令身份及回执核对待审”由本段补齐；旧段保留当时的范围事实。配置同步页面的输入、结果和原命令恢复现已核对，底层各类配置应用仍按后端逐文件清单继续审查。


## 全工程续审：旧租户初始化目标与完成反馈

**FE-BUG-38 / P2，已修复。** `batchInitTenantConfig` 先放入面板的目标、模式和 dry-run，再展开手写 Spec JSON；不选择类型过滤时，正文可把面板的选定租户替换为另一个租户、把试运行改成正式执行或改变覆盖模式。现最后装配操作参数，正文只提供配置字段，保留类型过滤和后端对未知字段的拒绝；不修改传入正文对象。此处是管理员操作目标/意图错位，不将其称为后端权限绕过。

**FE-BUG-39 / P2，已修复。** 初始化 HTTP 成功但租户失败或条目失败时，页面总是显示“初始化完成”并关闭。现复用批量结果判断，失败、条目部分失败及无结果均保留面板并提示核对；完整成功才完成并关闭，试运行保持预览语义。服务端响应类型在 API 客户端显式绑定既有生成契约。

首红 `/private/tmp/wdi-tenant-init-ui-red.log`：8项中5失败、3通过；API的显式类型过滤正例及正常成功/试运行反例保留。修复后 API、组件、批量结果工具 **3文件/12项通过**（`/private/tmp/wdi-tenant-init-ui-final.log`）。类型检查、受影响文件ESLint、i18n和生产构建通过，日志分别为 `/private/tmp/wdi-tenant-init-typecheck.log`、`/private/tmp/wdi-tenant-init-lint.log`、`/private/tmp/wdi-tenant-init-i18n.log`、`/private/tmp/wdi-tenant-init-build.log`。

本批全量 **225文件/1,362项通过**（`/private/tmp/wdi-tenant-init-all-unit-final.log`）。首次全量运行的配置同步确认等待缺陷已修正：真实 WebCrypto 摘要是异步的，第二次点击要等待本次确认次数增加，不能被第一次调用提前满足；原业务断言没有删除。首红1失败/1,361通过及定向27项通过分别保留在 `/private/tmp/wdi-tenant-init-all-unit.log`、`/private/tmp/wdi-config-sync-wait-green.log`。

旧初始化/复制入口的持久原命令恢复、页面关闭及异步作用域等其他行为尚未逐项完成，保持部分审查；本段不沿用配置同步页面的持久收据保证，也不宣称全工程完成或真实浏览器联验通过。


## 2026-10-27 续审：初始化面板异步作用域

**FE-BUG-40 / P2，已修复，验证分层见下。** 初始化在等待异步校验期间尚未占用 saving，重复点击会排出多次请求；关闭、换目标、编辑、账号/权限/维护状态变化或卸载后，原校验完成仍继续写入。已发送请求的迟到结果又可能关闭新打开的另一目标面板。首次以已打开状态挂载时目标未初始化，打开期间换目标也保留旧展示。

修复按面板打开/目标、输入、操作者和写权限同步递增代次，卸载时失效；校验开始前占用本次操作，发送前与写入返回后复核同一代次。首次打开及目标变更立即按目标初始化草稿。正常成功、部分失败和试运行的既有断言保留；不把关闭面板称为取消服务端业务。

首红 `/private/tmp/wdi-tenant-init-scope-red.log`：15项中10失败、5原回归通过。修复后初始化组件、API和结果工具 **3文件/22项通过**（`/private/tmp/wdi-tenant-init-scope-green.log`）。持久原命令/收据恢复仍不在旧初始化入口中，这一限制保留为待审能力；组件继续标记部分审查，不能借页面定向修复销项全部配置写链路。

2026-10-27 本批全量前端 **225文件/1,372项通过、无失败或跳过**（`npm run test:unit`，`/private/tmp/wdi-tenant-init-scope-all-unit.log`），类型和受影响组件/测试 ESLint 通过（`/private/tmp/wdi-tenant-init-scope-typecheck.log`、`/private/tmp/wdi-tenant-init-scope-lint.log`）。这些是本地组件/逻辑/API替身层证据，真实浏览器跨账号与网络未知结果联验未运行。

初始化作用域修复后的生产构建也已通过（`npm run build`，`/private/tmp/wdi-tenant-init-scope-build.log`），文档及Changelog检查通过。当前清单摘要复核未发现已审/部分审查来源漂移；全工程仍为94已审、27部分、1,133待审，不能从全量测试通过推导全量人工审核完成。
