# 设计 ↔ 实现 覆盖矩阵(穷尽式核查)

> 生成:2026-07-04。方法:Playwright 逐锚点(每锚点新 context)加载 `design/Batch Console 重设计-离线版.html`,遍历 28 个 hash 屏 + 侧栏 13 nav 项(含 2 个 nav-only 屏:流水线定义、租户实例)+ 抽屉三态锚点(#jobs/view|edit|create),逐屏点击 tab / 首行 / 行内操作 / 新增按钮,记录抽屉·弹窗·Toast。截图存 `/tmp/cov-*.png`(72 张)。实现端以 `src/router/index.ts` + `src/views/**` 粗查。design/ 目录未做任何修改。
>
> 状态标记:✅ 实现端存在对应功能;⚠️ 存在但形态/口径有差;❌ 实现端无。

## 表 A · 设计侧清单(屏 → 子态)

| # | 设计屏(锚点/入口) | 子态 | 设计内容要点 | 实现端对应 | 状态 |
|---|---|---|---|---|---|
| A01 | 控制面板 `#dashboard` | 页框架 | 副标题"当前租户运行概览、SLA 趋势与待处理事项";头部:时间范围▾ / 刷新 / 打印PDF | `/ops/summary` OpsSummary.vue(打印/PDF 词条已有) | ✅ |
| A02 | 控制面板 | tab 卡片指标 | 11 指标卡(待审批/未处理告警/严重告警/运行中/失败/SLA 违规/在线 Worker/Draining/离线/Outbox 积压/投递失败),各带"查看→"跳链 | OpsMetricGrid.vue | ✅ |
| A03 | 控制面板 | tab 趋势 | 近 7 日执行量 成功/失败堆叠图 | OpsTrendPanel.vue | ✅ |
| A04 | 控制面板 | tab 分布 | 按作业类型分布(今日实例),条目可点筛选 | OpsDistPanel.vue | ✅ |
| A05 | 控制面板 | tab 扩展面板 | 待处理卡 + 最近失败实例 + 运行状态(较昨日对比) | OpsExtraPanel.vue | ✅ |
| A06 | 审批中心 `#approvals` | tab 通用审批 | 列:审批单号/类型/目标/申请人/申请时间/状态/操作;类型筛选▾ | `/approvals` GeneralApprovalsTab.vue | ✅ |
| A07 | 审批中心 | tab 补跑审批 | 列:请求 ID/JOB CODE/业务日期/TRACE/创建时间/状态/操作 | CatchUpApprovalsTab.vue(`?tab=catch-up`) | ✅ |
| A08 | 审批中心 | 行内 通过 | 确认弹窗「通过审批 … 取消/确认通过」 | 有(带二次确认) | ✅ |
| A09 | 审批中心 | 行内 驳回 | 确认弹窗「驳回审批 … 取消/确认驳回」 | 有 | ✅ |
| A10 | 审批中心 | 行内 详情 | 右抽屉:审批单基本信息(单号/类型/目标对象…) | 有 | ✅ |
| A11 | 自助服务 `#selfservice` | 6 操作卡 | 手动触发作业 / 失败重跑 / 补跑历史批次 / 暂停恢复调度 / 导出运行数据 / 提交配置变更,各"发起→" | `/self-service` SelfServicePanel.vue:8 个 tab(重跑/触发暂停/配额/配额变更/补偿/通知订阅/我的审计/失败作业) | ⚠️ 形态卡片 vs tab;"导出运行数据""提交配置变更"无直接入口 |
| A12 | 自助服务 | 发起→抽屉 | 「自助服务 · 手动触发作业」抽屉:Job Code▾/业务日期/触发参数/备注/取消/提交 | 触发能力在作业定义行内"手动触发" | ⚠️ |
| A13 | 报表中心 `#reports` | tab 趋势分析 | 4 KPI(总执行/成功率/平均耗时/SLA 达标率,带环比)+ 近 7 日执行量图 hover 明细;头部 ↓导出 CSV | ReportExportHub.vue 无趋势 tab(趋势在控制面板) | ⚠️ |
| A14 | 报表中心 | tab 导出中心 | 3 生成卡(执行明细/SLA 达标/失败归因)+ 报表文件下载列表(类型/大小/生成时间/操作) | `/reports` ReportExportHub.vue(按域分卡导出,粒度更细) | ⚠️ 卡片集合口径不同 |
| A15 | 全部运行 `#runs` | 页框架 | 4 统计卡(运行中/今日成功/今日失败/排队);作业运行近 20 条 + 工作流运行近 20 条 双栏,各"全部→" | `/runs` RunsOverview.vue(含 workflow) | ✅ |
| A16 | 全部运行 | 行内 详情 | 右抽屉:作业运行基本信息 | impl 跳实例详情页 | ⚠️ 抽屉 vs 页 |
| A17 | 作业运行 `#instances` | 页框架 | 业务日期▾ / 刷新;已保存筛选(★ 3 条 + 保存当前筛选);状态统计卡 全部/运行中/成功/失败/已取消(可点筛);Worker Group▾;"实时监控 每 10 秒自动刷新 / 暂停";列:JOB CODE/业务日期/状态/触发/开始时间/耗时/TRACE/操作 | `/monitor/job-instances` JobInstanceList.vue(savedFilter/列设置/live 均有) | ✅ |
| A18 | 作业运行 | 行内 详情 | 右抽屉「作业运行」:基本信息(JOB CODE/业务日期/触发方式…)+ 步骤时间线 | `/monitor/job-instances/:id` 独立详情页 | ⚠️ 抽屉 vs 页 |
| A19 | 作业运行 | 行内 分区 | 右抽屉「作业运行 · 分区」:分区 0..N 各自状态/耗时 | `/monitor/job-instances/:id/partitions` PartitionView.vue | ⚠️ 抽屉 vs 页 |
| A20 | 作业定义 `#jobs` | 页框架 | 头部 向导新建 / Bundle 导入 / +新增作业;筛选 Job Code/名称/启用状态/Worker Group/Queue/调度类型;列:JOB CODE/名称/类型/WORKER GROUP/QUEUE/启用/操作 | `/jobs/definitions` JobDefinitionList.vue(bundle 66 处、触发 31 处) | ✅ |
| A21 | 作业定义 | 抽屉·查看 `#jobs/view` | 560px 抽屉:状态徽章+基本信息栅格(JOB CODE/名称/类型/WORKER GROUP/QUEUE/调度类型)+活动记录时间线;底部 关闭/导出/编辑 | JobDefinitionDetail.vue(独立页) | ⚠️ 抽屉 vs 页 |
| A22 | 作业定义 | 抽屉·编辑 `#jobs/edit` | 同字段转控件(文本/下拉▾);底部 取消/保存 | 编辑能力有 | ✅ |
| A23 | 作业定义 | 抽屉·新建 `#jobs/create` | 「新建 · 作业定义」空表单,取消/保存 | +新增/向导 `/jobs/definitions/new` | ✅ |
| A24 | 作业定义 | 行内 手动触发 | 触发确认(见 #states 确认弹窗) | 有 | ✅ |
| A25 | 作业定义 | 行内 ⋯ 菜单 | 查看详情 / 编辑 / 克隆 / 导出定义 / 删除 | 克隆/导出定义未见 | ⚠️ |
| A26 | 流水线定义(nav-only) | 列表 | +新增流水线 / ☰列;列:PIPELINE CODE/名称/阶段数/类型/状态/操作(编辑/⋯) | `/jobs/pipelines` PipelineDefinitionList.vue | ✅ |
| A27 | 工作流 `#workflow` | 模式·设计器 | 节点库 START/END/JOB/GATEWAY/FILE_STEP/APPROVAL;↶↷/自动布局/方向 TB/快速节点/模板/校验/导出▾/保存;节点属性面板(名称/绑定 Job Code/超时/重试/失败策略 中断·跳过·补偿) | `/workflow/designer` WorkflowDesigner.vue(palette/inspector/toolbar 全套) | ✅ |
| A28 | 工作流 | 模式·只读视图 | "只读 · 编辑请走 Excel 包导入";⇪Excel 导入 / 导出 PNG;静态 DAG | `/workflow/viewer/:id` WorkflowMermaidViewer.vue | ✅ |
| A29 | 配置批量导入 `#import` | 3 步向导 | 上传(9+2/11-Sheet 配置包,.xls/.xlsx,下载模板/导出当前配置包)→ 预览校验 → 应用 | `/config/tenant-package` TenantPackageImportWizard.vue | ✅ |
| A30 | 告警中心 `#alerts` | 分组 tab | 未处理 6 / 已确认 0 / 全部 6;空分组显"当前分组没有告警";严重程度▾ | `/observability/alerts` AlertList.vue 用状态下拉筛选,非 3 分组 tab | ⚠️ |
| A31 | 告警中心 | 行内 确认 | 打开告警详情抽屉(严重度/来源/触发时间…) | ack 有 | ✅ |
| A32 | 告警中心 | 行内 静默 24h | Toast「该告警已静默 24 小时」 | 静默有(词条 8 处) | ✅ |
| A33 | 告警中心 | 告警路由规则 | 头部按钮→抽屉:规则列表(条件式 severity=高 AND source~…→投递渠道)+ 新增规则 / 编辑 | `/observability/alert-routings` AlertRoutingPanel.vue(独立页) | ⚠️ 抽屉 vs 页 |
| A34 | Outbox 投递 `#outbox` | 看板 4 队列 | 待投递 / 投递中 / 重试中(↻ n/5)/ 投递失败(空态"无失败投递✓")+ 今日成功计数;头部"全部重试";行内 查看 / 重投 | `/observability/outbox` OutboxList.vue:tab+表格,行级重试有 | ⚠️ 无"全部重试",布局 tab vs 看板 |
| A35 | Worker 管理 `#workers` | tab Workers | 概览卡 在线 6/Draining 1/离线 2(可点筛);行:负载% 环 + group + 心跳 + 负载 n/16 + 详情/Drain(Draining 行为"恢复");Drain→Toast | `/workers/management` WorkerManagement.vue(drain 有) | ✅(负载分母口径差,见 C) |
| A36 | Worker 管理 | 行内 详情 | 右抽屉:WORKER/GROUP/负载… | 有 | ✅ |
| A37 | Worker 管理 | tab 执行通道 | 列:CHANNEL CODE/类型/启用/超时(秒)/更新时间/操作(编辑/⋯) | 同页通道管理(/workers/channels redirect) | ✅ |
| A38 | 文件列表 `#files` | 页框架 | 头部 上传文件/刷新/☰列;统计卡 今日到达/待处理/已归档/迟到(可点筛,Toast 反馈);筛选 文件名/渠道/状态;列:文件名/渠道/大小/状态/到达时间/操作 | `/files/list` FileList.vue(summary 卡有) | ⚠️ 无"上传文件";卡口径 已归档/迟到→已处理/失败(已拍板) |
| A39 | 文件列表 | 行内 下载 / 行点开 | 右抽屉:文件基本信息(文件名/渠道/大小…) | 有 | ✅ |
| A40 | 文件列表 | 行内 ⋯ 菜单 | 查看详情/编辑/克隆/导出定义/删除 | 部分 | ⚠️ |
| A41 | 文件模板 `#templates` | 列表+抽屉三态 | +新增模板/☰列;行内 编辑/⋯;抽屉 查看/编辑/新建(TEMPLATE CODE/名称/格式 CSV…) | `/files/templates` FileTemplateList.vue | ✅ |
| A42 | 文件渠道 `#channels` | 列表+抽屉三态 | +新增渠道;同模板母版 | `/files/channels`(同组件 channels tab) | ✅ |
| A43 | 批次日 `#batchdays` | 月历视图 | 回到今日/刷新;月历每日显 完成/计划(40/41、计划 42、今日高亮);右侧当日明细:完成进度 38/42·90% + 批次窗口(导入 00:00–02:30 已完成 / 处理 进行中 / 导出 计划) | `/scheduler/batch-days` BatchDayList.vue(calendar)+ `/scheduler/batch-days/:bizDate` BatchDayWindow.vue | ✅ |
| A44 | 批次日 | 重放该业务日期 | 按钮→Toast「已发起 … 批次重放」 | `/ops/batch-day-replay` BatchDayReplay.vue(独立页,带审批) | ✅ |
| A45 | 发布管理 `#releases` | 列表+详情 | +新增发布;版本卡(r-xxx,待发布/已发布/已回滚)+ 右侧详情:变更项数/发布人/变更清单(job/trigger/queue/param);操作 发布 / 导出清单 | `/config/releases` ConfigReleaseList.vue(回滚 12 处) | ✅ |
| A46 | 文件流水线可观测 `#pipelineobs` | 阶段漏斗+明细 | RECEIVE→PARSE→VALIDATE→LOAD→ARCHIVE 在途计数;运行列表(运行中/阻塞/成功/失败);右侧所选运行的阶段耗时表 + 重试 / 打开运行 | `/files/pipeline-obs` FilePipelineObservability.vue | ✅ |
| A47 | 权限自查(#users) | 角色卡+矩阵 | 4 角色卡(ADMIN/OPERATOR/VIEWER/AUDITOR,成员数/权限点/编辑权限›)+ +新增角色 + 权限矩阵(9 权限域 × 4 角色:✓/读/—) | `/system/users` UserRole.vue(矩阵有) | ⚠️ 无 新增角色/编辑权限(impl RBAC 固定角色) |
| A48 | 标签管理 `#tags` | 标签卡 | +新增标签;卡:名称/描述/引用数/编辑 | `/system/tags` TagManagement.vue | ✅ |
| A49 | 系统参数 `#params` | 分组参数表 | 分组 通用/安全/审计/界面;行:key/说明/值/编辑 | `/system/parameters` SystemParameterList.vue | ✅ |
| A50 | 通知管理 `#notifications` | 规则列表 | 搜索 + +新增规则;列:规则名称/触发事件/渠道(Webhook/Email/SMS)/接收人/状态/操作;⋯ 菜单:编辑规则/测试发送/克隆/删除 | `/system/notifications` NotificationManagement.vue(4 tab:渠道/规则/Webhook/投递日志;测试发送有) | ✅ |
| A51 | SDK 自定义任务类型 `#customtasktypes` | 只读列表+详情 | 列:任务类型/所属租户/来源/SDK 版本/近 7 天;右侧详情:参数 SCHEMA 表(参数/类型/必填)+ 治理动作"停用该类型" | `/ops/custom-task-types` CustomTaskTypeList.vue(只读) | ⚠️ 无"停用"治理动作 |
| A52 | SDK Worker 指纹 `#workerfingerprints` | 看板+详情 | 统计卡 指纹总数/在线/待审/已吊销;列表(信任状态 已信任/待审/已吊销);右侧详情:主机/IP/SDK 版本/运行环境/心跳/指纹 HASH/声明能力;"吊销指纹"→危险确认弹窗 | `/ops/worker-fingerprints` WorkerFingerprintBoard.vue(只读) | ⚠️ 无 吊销/信任审批动作 |
| A53 | 租户实例(nav-only) | 列表 | +新增租户/☰列;列:TENANT/名称/作业数/Worker/分片/状态/操作(配置/⋯) | `/system/tenants` TenantList.vue(含批量建/复制配置/初始化 dialog) | ✅ |
| A54 | 个人中心 `#me` | 资料+安全+偏好 | 编辑资料;安全:登录密码(修改)/双因子(开启)/活跃会话(查看);偏好:主题/语言/默认密度 | `/system/me` MyAccount.vue | ⚠️ 无 双因子/活跃会话/偏好区块 |
| A55 | AI 助手 `#aichat` | 对话 | 自然语言查询运行状态/排障建议(示例文案) | `/system/ai-chat` AiChat.vue | ✅ |
| A56 | 移动端预览 `#mobile` | 4-tab 值班视图 | iPhone 壳;概览/运行/告警/我的;首屏 待审批/未处理告警/失败任务/运行中 + 最近失败(重试);注:"实现对应 /m/* 移动路由(11 个视图)" | `/m/*` 11 视图(5 tab:告警/审批/概览/作业/Worker) | ✅(tab 组成口径差,impl 超出设计) |
| A57 | 组件总览 `#states` | tile·确认弹窗 | 普通操作(手动触发 取消/确认触发)、危险操作(吊销指纹 取消/确认吊销) | ElMessageBox 类确认 | ✅ |
| A58 | 组件总览 | tile·Toast | 底部居中 2.2s 自动消失;成功/静默/失败/复制 4 例 | ElMessage(默认顶部) | ⚠️ 位置/时长规范差 |
| A59 | 组件总览 | tile·空态 | 「暂无运行记录」+ 说明 + 清除筛选 / 手动触发 双按钮 | el-empty 类空态 | ⚠️ 双动作按钮母版 |
| A60 | 组件总览 | tile·加载骨架 | shimmer 扫光骨架 | el-skeleton | ✅ |
| A61 | 组件总览 | tile·分页器 | 共 1,284 条 · 每页 20 条▾ · 页码 ‹1 2 3…65› · 跳至 N 页 | el-pagination(impl 约定默认 15/页) | ⚠️ 默认页大小 20 vs 15 |
| A62 | 响应式与动效 `#spec` | 规格 | 断点 4 档(≥1280/1024–1279/768–1023/<768);侧栏 240↔64↔隐藏;抽屉 560px→92vw→100vw;motion tokens(bc-spin 700ms/bc-shimmer 1300ms/bc-pulse 1200ms/bc-screen-in 220ms) | 全局规范(供实现映射,含"已实现/规格建议"双标注) | ✅ 规范类 |
| A63 | 全局框架 | 侧栏+顶栏+⌘K | 侧栏 7 组手风琴、13 nav 项、默认收起图标轨(impl 拍板默认展开);顶栏 面包屑/租户切换/⌘K/通知/中英/文档/主题/移动预览/用户菜单;⌘K 面板含全部页面 + 低频 4 项(配额策略/队列配置/运行窗口/业务日历) | DefaultLayout + 命令面板;低频 4 项在 impl 是常规路由 `/governance/*` | ✅(展开态口径差已拍板) |

**表 A 合计:63 行**(23 屏 + 40 子态)。

## 表 B · 实现端路由 → 设计覆盖(桌面,忽略 /m/*)

标注:【完整稿】设计有该屏完整稿;【母版】设计无该屏但可套通用列表/抽屉母版(§4 通用列表页能力);【未涉及】设计完全没有对应形态。

| # | 路由 | 标题 | 设计覆盖 |
|---|---|---|---|
| B01 | /login | 登录 | 未涉及 |
| B02 | /ops/summary | 控制面板 | 完整稿 #dashboard |
| B03 | /approvals | 审批中心 | 完整稿 #approvals(双 tab) |
| B04 | /config/releases | 发布管理 | 完整稿 #releases |
| B05 | /config/tenant-package | 配置批量导入 | 完整稿 #import |
| B06 | /reports | 报表中心 | 完整稿 #reports(口径差,见 C) |
| B07 | /ops/custom-task-types | 自定义 taskType | 完整稿 #customtasktypes |
| B08 | /ops/worker-fingerprints | Worker fingerprint 看板 | 完整稿 #workerfingerprints |
| B09 | /ops/capacity-profile | 容量画像 | 母版 |
| B10 | /ops/asset-freshness | 资产新鲜度策略 | 母版 |
| B11 | /system/atomic-task-types | Atomic 节点配置中心 | 未涉及 |
| B12 | /files/list | 文件列表 | 完整稿 #files |
| B13 | /files/templates | 文件模板 | 完整稿 #templates |
| B14 | /files/channels | 文件渠道 | 完整稿 #channels |
| B15 | /files/arrival-groups | 到达组治理 | 母版(IA v3 点名"文件到达组",无屏) |
| B16 | /files/pipeline-obs | 流水线观测 | 完整稿 #pipelineobs |
| B17 | /jobs/definitions | 作业定义 | 完整稿 #jobs |
| B18 | /jobs/definitions/new | 新建作业向导 | 母版(设计仅"向导新建"入口按钮) |
| B19 | /jobs/definitions/:id | 作业详情 | 完整稿(#jobs/view 抽屉,形态=抽屉) |
| B20 | /workflow/definitions | 工作流定义 | 母版(设计仅设计器/只读双模式,无列表屏) |
| B21 | /jobs/pipelines | 流水线定义 | 完整稿(nav-only 屏) |
| B22 | /workflow/viewer/:id | Workflow DAG 视图 | 完整稿 #workflow 只读视图 |
| B23 | /workflow/designer/:id? | Workflow 设计器 | 完整稿 #workflow 设计器 |
| B24 | /workflow/designer/:id/diff/... | Workflow 版本对比 | 未涉及 |
| B25 | /runs | 全部运行 | 完整稿 #runs |
| B26 | /monitor/job-instances | 作业运行 | 完整稿 #instances |
| B27 | /monitor/job-instances/:id | 作业实例详情 | 完整稿(详情抽屉,形态=抽屉) |
| B28 | /monitor/job-instances/:id/partitions | 作业分片 | 完整稿(分区抽屉,形态=抽屉) |
| B29 | /monitor/job-steps | 作业步骤 | 母版(IA v3 点名,无屏) |
| B30 | /monitor/workflow-runs | 工作流运行 | 母版(#runs 右栏 + IA 点名,无独立屏) |
| B31 | /monitor/workflow-runs/:id | 工作流运行详情 | 母版 |
| B32 | /observability/alerts | 告警 | 完整稿 #alerts |
| B33 | /observability/alert-routings | 告警路由 | 完整稿(#alerts 内路由规则抽屉,形态=抽屉) |
| B34 | /observability/trace | Trace 诊断 | 母版(⌘K 面板含"Trace 检索",无屏) |
| B35 | /observability/lineage | 血缘证据 | 未涉及 |
| B36 | /observability/audits | 文件审计 | 母版(IA"审计日志"点名) |
| B37 | /observability/operation-audits | 操作审计 | 母版(IA 点名) |
| B38 | /observability/outbox | Outbox | 完整稿 #outbox |
| B39 | /workers/management | Worker | 完整稿 #workers(双 tab) |
| B40 | /workers/my-workers | 我的 Worker | 未涉及 |
| B41 | /scheduler/snapshot | 调度快照 | 母版(IA 点名) |
| B42 | /scheduler/batch-days | 批次日与窗口 | 完整稿 #batchdays |
| B43 | /scheduler/batch-days/:bizDate | 批次日窗口 | 完整稿(#batchdays 右侧明细,形态=同屏) |
| B44 | /governance/quota | 租户配额 | 母版(设计:仅 ⌘K 可达,无屏) |
| B45 | /governance/queues | 队列 | 母版(同上) |
| B46 | /governance/windows | 批次窗口 | 母版(同上) |
| B47 | /governance/calendars | 业务日历 | 母版(同上) |
| B48 | /system/tenants | 租户实例 | 完整稿(nav-only 屏) |
| B49 | /system/user-accounts | 登录账户 | 母版(IA 点名,无屏) |
| B50 | /system/users | 权限自查 | 完整稿(#users) |
| B51 | /system/me | 我的账户 | 完整稿 #me(功能差见 C) |
| B52 | /system/ai-chat | AI 助手 | 完整稿 #aichat |
| B53 | /system/api-keys | API Key | 母版(IA 点名,无屏) |
| B54 | /system/triggers | 触发器 | 母版(IA 点名,无屏) |
| B55 | /system/parameters | 系统参数 | 完整稿 #params |
| B56 | /system/tags | 标签管理 | 完整稿 #tags |
| B57 | /system/event-catalog | 事件目录 | 母版(IA 点名,无屏) |
| B58 | /config/management | 变更与同步 | 母版(IA 点名,无屏) |
| B59 | /ops/diagnostic | 运维诊断 | 母版(IA"运行诊断"点名) |
| B60 | /ops/shard-catalog | 分片目录 | 未涉及 |
| B61 | /ops/tenant-placements | 租户分片 | 未涉及 |
| B62 | /ops/batch-day-replay | 批次日重放 | 母版(设计仅 #batchdays 内"重放该业务日期"按钮+Toast,无审批流屏) |
| B63 | /system/notifications | 通知与投递 | 完整稿 #notifications(impl 4 tab 超出设计单列表) |
| B64 | /observability/queries | 综合查询 | 未涉及(执行日志/重试/死信/渠道回执 4 tab) |
| B65 | /self-service | 自助服务 | 完整稿 #selfservice(形态差见 C) |
| B66 | /maintenance | 系统维护中 | 未涉及 |
| B67 | /setup/initial-tenant | 首次部署 · 创建租户 | 未涉及 |
| B68 | /:pathMatch(.*) | NotFound | 未涉及(设计有空态母版可套) |

另有 15 条纯 redirect(/files、/alerts、/logs、/workers、/monitor/instances、/scheduler/catch-up-approvals、/config/change-logs、/config/sync、/system/webhooks、/system/cluster-diagnostic、/ops/toolbox、/workers/list、/workers/channels、/self-service/tenant、/self-service/jobs),不计入覆盖。

**表 B 合计:68 行**。分布:完整稿 33 · 母版可套 24 · 未涉及 11。

## 表 C · 差异与风险

| # | 类别 | 差异点 | 风险/建议 |
|---|---|---|---|
| C01 | 设计有→实现无 | 文件列表「上传文件」头部按钮 | 后端文件为渠道到达模型,无上传 API;若要做需 BE 先行,否则设计稿该按钮不还原 |
| C02 | 设计有→实现无 | Outbox「全部重试」批量按钮 + 看板式 4 队列(待投递/投递中/重试中/投递失败)布局 | impl 为 tab+表格、行级重试;批量重试需 BE 端点;布局改造工作量大,建议只对齐视觉不改信息结构或先补批量重试 |
| C03 | 设计有→实现无 | 告警中心「未处理/已确认/全部」三分组 tab(设计核心交互:确认后自动归档) | impl 为状态下拉筛选;分组 tab 是纯 FE 改造,可低成本对齐 |
| C04 | 设计有→实现无 | 权限自查「+新增角色 / 编辑权限›」 | impl RBAC 为固定 4 角色只读矩阵(by-design);设计的自定义角色是架构级功能,勿当 FE 缺口 |
| C05 | 设计有→实现无 | 治理动作:自定义 taskType「停用该类型」、Worker 指纹「吊销指纹/待审信任流」 | 两页 impl 均为只读(路由 meta 也注明只读);写动作需 BE 支持,设计稿超前于后端契约 |
| C06 | 设计有→实现无 | 个人中心 双因子认证 / 活跃会话 / 偏好(主题·语言·密度)区块 | 双因子/会话管理 BE 无端点(auth.mfa.required 只是设计示意参数);偏好区块可 FE 本地实现 |
| C07 | 设计有→实现无 | 报表中心「趋势分析」tab(4 KPI+7 日图);自助服务「导出运行数据」「提交配置变更」卡 | 趋势内容与控制面板重复,建议维持 impl 现状并向设计对齐说明;自助 2 卡对应能力散在报表中心/发布管理 |
| C08 | 形态差 | 设计所有 详情/编辑/新建 = 右侧 560px 抽屉三态;impl 作业详情/实例详情/分区/告警路由为独立路由页 | 深链/可分享 URL 是 impl 既有优势;若改抽屉需保 URL 方案(query 驱动),属大改造,建议按屏逐个评估 |
| C09 | 形态差 | 行内 ⋯ 菜单统一含 克隆/导出定义/删除(作业/模板/渠道/文件) | impl 各列表 ⋯ 菜单项不齐(克隆/导出定义多数缺);逐列表补齐需对应 BE 端点核对 |
| C10 | 口径差(已拍板) | 文件统计卡:设计 已归档/迟到 → impl 已处理(LOADED)/失败(FAILED) | 无后端字段,形态照设计、字段用真实口径,勿反向"还原"设计 |
| C11 | 口径差(已拍板) | Worker 负载:设计 6/16 进度条(有容量分母)→ impl 显示真实 currentLoad 数字 | BE 无分母字段,不编造进度条 |
| C12 | 口径差 | 组件规范:Toast 底部居中 2.2s vs ElMessage 默认;分页设计每页 20 vs 仓库约定 15;侧栏设计默认收起 vs impl 拍板默认展开 | 分页 15 是 CLAUDE.md 红线,维持 15;Toast 位置可全局配置一次性对齐 |
| C13 | 实现有→设计无 | 11 个"未涉及"页(综合查询/血缘证据/Atomic 中心/分片目录/租户分片/我的 Worker/Workflow diff/维护页/首次部署/登录/404)+ 24 个"母版可套"页 | 按 docs/redesign/design-source-notes.md 既定策略:用母版语言自行套,不再请设计补稿;登录页/404 无母版,风格需自行延展 |
| C14 | 实现超出设计 | 移动端:设计 4 tab 预览示意 → impl 5 tab + 11 视图;通知管理:设计单规则列表 → impl 渠道/规则/Webhook/投递日志 4 tab;自助服务:设计 6 卡 → impl 8 tab | 以 impl 信息架构为准,仅取设计视觉语言,防止照稿删功能 |
| C15 | 设计交互细节 | 作业运行「已保存筛选」星标条 + 状态统计卡点击筛选 + 实时监控暂停开关;批次日月历双数字(完成/计划) | impl 已有 savedFilter/live 基础,重点核像素与交互细节而非功能新增 |

**表 C 合计:15 行**。
