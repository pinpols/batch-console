# Changelog

## [0.1.8](https://github.com/pinpols/batch-console/compare/v0.1.7...v0.1.8) (2026-06-02)


### Refactors

* **fe:** R3-7 手写 wrapper 退役 PoC(2 个)— Round-1 TOP-10 启动 ([#43](https://github.com/pinpols/batch-console/issues/43)) ([8ed6ff4](https://github.com/pinpols/batch-console/commit/8ed6ff450639934e2291b91f48adeec544537974))

## [0.1.7](https://github.com/pinpols/batch-console/compare/v0.1.6...v0.1.7) (2026-06-02)


### Features

* **ops:** Lane F worker fingerprint board (SDK Phase 5 / SDK-P5-3) ([#41](https://github.com/pinpols/batch-console/issues/41)) ([4d1c53b](https://github.com/pinpols/batch-console/commit/4d1c53b87cd5f4f05fd0267a637e798db06e912c))
* **security:** Lane G SensitiveFieldAlert 凭据警示组件 + 接入 atomic/custom task type 视图 ([#40](https://github.com/pinpols/batch-console/issues/40)) ([e45913f](https://github.com/pinpols/batch-console/commit/e45913fc99a35e87b77e50cc3f59d2e2b3581a6e))

## [0.1.6](https://github.com/pinpols/batch-console/compare/v0.1.5...v0.1.6) (2026-06-02)


### Refactors

* **heartbeat:** 用 useAutoRefresh 替换裸 setInterval + e2e smoke 收录两新路由 ([#38](https://github.com/pinpols/batch-console/issues/38)) ([0d366e5](https://github.com/pinpols/batch-console/commit/0d366e5b62006d9cc829543488f3ad12ef5dc3c7))

## [0.1.5](https://github.com/pinpols/batch-console/compare/v0.1.4...v0.1.5) (2026-05-30)


### Bug Fixes

* **ci:** frontend deploy HOST_PORT 8080 → 19080 ([#16](https://github.com/pinpols/batch-console/issues/16)) ([4836710](https://github.com/pinpols/batch-console/commit/4836710242096ec5a237edf591a88ace392b4d7d))
* **deps:** update dependency element-plus to ^2.14.1 ([#31](https://github.com/pinpols/batch-console/issues/31)) ([b5c81a0](https://github.com/pinpols/batch-console/commit/b5c81a00b7fb313e11c772cf450aa51b510caaaa))
* **deps:** update vue ecosystem ([#32](https://github.com/pinpols/batch-console/issues/32)) ([1d76b62](https://github.com/pinpols/batch-console/commit/1d76b6237c33ff9a909394c24225953ef92b40b3))
* **layout:** 移除首次登录强制选租户弹窗 FirstTenantPicker ([#17](https://github.com/pinpols/batch-console/issues/17)) ([0d029c0](https://github.com/pinpols/batch-console/commit/0d029c05ec6c1cbb91a6ea443f30c59649068c07))
* **security:** 租户/菜单/operator 权限硬化(去 default-tenant + 后端菜单 allowlist + mobile OPERATOR) ([#25](https://github.com/pinpols/batch-console/issues/25)) ([82b2510](https://github.com/pinpols/batch-console/commit/82b25100d805b7859cb7bd6b529483fdfe4c8bd4))
* **ui:** tenant-package 导入向导大屏自适应(撑满高度 + 上传步骤垂直居中 + 放宽限宽) ([#21](https://github.com/pinpols/batch-console/issues/21)) ([d9ab142](https://github.com/pinpols/batch-console/commit/d9ab14251f293c1bfb8533fecb03d6581db65d12))

## [0.1.4](https://github.com/pinpols/batch-console/compare/v0.1.3...v0.1.4) (2026-05-24)


### Bug Fixes

* **deps:** update element plus ([#13](https://github.com/pinpols/batch-console/issues/13)) ([38485a9](https://github.com/pinpols/batch-console/commit/38485a948ab95e1e8abaeb024cdde674784e555e))

## [0.1.3](https://github.com/pinpols/batch-console/compare/v0.1.2...v0.1.3) (2026-05-22)


### Docs

* **skill:** add branch-hygiene skill ([#8](https://github.com/pinpols/batch-console/issues/8)) ([9cb3cf3](https://github.com/pinpols/batch-console/commit/9cb3cf3a32dc71fa784dc6b457424745ae9605f3))

## [0.1.2](https://github.com/pinpols/batch-console/compare/v0.1.1...v0.1.2) (2026-05-22)


### Docs

* **ci:** add 2026-05-23 timing baseline + skip mechanism ([9877f35](https://github.com/pinpols/batch-console/commit/9877f354a14e2f29226ffe8a76f02168d79d53d3))
* **runbook:** dev-workflow 加权限模型 / 谁能提代码 段 ([599f7b4](https://github.com/pinpols/batch-console/commit/599f7b4accc8d92c81956a4756f5efbae0ff0d93))

## [0.1.1](https://github.com/pinpols/batch-console/compare/v0.1.0...v0.1.1) (2026-05-22)


### Features

* **a11y+docs:** axe e2e 基线 + DocsDrawer 上下文帮助 SDK ([591bcd6](https://github.com/pinpols/batch-console/commit/591bcd6a7132cfe359acb4f33735594ebd11b34e))
* **api,view:** JobDefinitionList 切到服务端分页 + 留迁移模板 ([1709728](https://github.com/pinpols/batch-console/commit/17097289c9493f66eff771c6026d122820731573))
* **api:** json-bigint 兜底 Long 超 2^53 精度丢失 ([4088fe4](https://github.com/pinpols/batch-console/commit/4088fe480c6e99832a596a81358de1b578a3f1f4))
* **audit:** 桌面端 /observability/operation-audits 查询页 ([ff0808a](https://github.com/pinpols/batch-console/commit/ff0808a3bed730c6a8aacd108ce2914759e80fd7))
* **auth:** axios withCredentials=true 配合后端 HttpOnly cookie token (D7 Stage A) ([0b87730](https://github.com/pinpols/batch-console/commit/0b8773024e99ceef0876f3915e82c0457962966f))
* **auth:** D7 Stage B — 前端完全移除 localStorage token ([6405b5a](https://github.com/pinpols/batch-console/commit/6405b5adca46b0446407ad66f67f933edc638fdb))
* batch-console 前端全量重构 ([dc0a335](https://github.com/pinpols/batch-console/commit/dc0a335091296b2189331b980c6fef824c060bed))
* **config-sync:** 双栏对照重构(源 → 目标),修复"3 卡片视觉权重相等但语义不平等" ([da68071](https://github.com/pinpols/batch-console/commit/da680713110e804c25156bc7b21e46552e52a953))
* **config:** add daily maintenance forms ([eba0c1c](https://github.com/pinpols/batch-console/commit/eba0c1cfad8d9435abb3634141bdd61824f04168))
* **console:** UI/UX 批量迭代 —— 错误 toast / 路由韧性 / 多业务页增强 ([4c65230](https://github.com/pinpols/batch-console/commit/4c652304094e5882556d60f74e5790b25ca0fbb5))
* **cron:** 引 cronstrue + BE Quartz 预览,替换自实现解析 ([b1b0308](https://github.com/pinpols/batch-console/commit/b1b03081a1b154552ea6b0b6c329048289d7d674))
* **definitions:** JobDefinition + WorkflowDefinition 详情抽屉加 Runs tab ([4ece3ef](https://github.com/pinpols/batch-console/commit/4ece3ef0819ff2fcb398d5499522a814dda5e03d))
* **deploy:** docker + nginx 部署 + 内嵌文档 /docs auth_request 一键拉起 ([9a10964](https://github.com/pinpols/batch-console/commit/9a109643846704c483c4a028613d965a18eeb9b4))
* enhance notification management and self-service panels ([2fb8c75](https://github.com/pinpols/batch-console/commit/2fb8c7577f5782f6135258e0c0224eefb85135ea))
* enhance notification management and self-service panels ([9938410](https://github.com/pinpols/batch-console/commit/99384104f40e42f064fe12fe133f0715a549384b))
* **feedback:** 列表 toast 美化 + 7 处写操作补成功反馈 ([417d192](https://github.com/pinpols/batch-console/commit/417d19246dd09b17f2b4f21cfdc6ea884d210556))
* **fe:** useAsyncAction 通用按钮防抖 composable + 8 业务页接入 ([687c5b8](https://github.com/pinpols/batch-console/commit/687c5b83d8344c9b9bfe19868afcec63603206ba))
* **fe:** 拦截器 409 幂等重放静默,联动 L2 key 复用避免 toast 噪声 ([b6f92d5](https://github.com/pinpols/batch-console/commit/b6f92d5371132062fdf6daf34bc57e72d31d7ad2))
* **forms:** 4 个通用录入辅助组件 + 强密码 / 租户 ID / 资源 Code / TraceID 标准化 ([46819ca](https://github.com/pinpols/batch-console/commit/46819ca8077ab711f485b7abb7cfa0c65b1031f7))
* **forms:** 接入辅助组件到 4 处关键 form(TenantForm/JobConfig/FileTemplate/FileChannel) ([a393f55](https://github.com/pinpols/batch-console/commit/a393f5509a8fc2753865c8e080a71dcc12501712))
* **form:** 表单校验推广 +4 页(自助服务 3 + 批量新增租户) ([11394c7](https://github.com/pinpols/batch-console/commit/11394c70b364a7b7a667c049ddd9321dffd02b9a))
* **i18n:** A15 — QuotaPanel + BatchDayList + BatchDayWindow + PipelineDefinitionList ([4be9ef7](https://github.com/pinpols/batch-console/commit/4be9ef7cb82642b2cb11f3770b6f809d78d82a8a))
* **i18n:** A16 — 共享组件 ProTable / RowActions / DateRangePresetPicker ([2bbac1d](https://github.com/pinpols/batch-console/commit/2bbac1d539950f75c4983089c41bdd397263ecb8))
* **i18n:** A17 — TagSearchTab ([1d9fc02](https://github.com/pinpols/batch-console/commit/1d9fc0266b780fb1b8aec63b4fa697302d29fc6f))
* **i18n:** A18 — 租户 4 个 Dialog (Form/Batch/Init/Copy) ([90fafff](https://github.com/pinpols/batch-console/commit/90fafff071f2884295cc7701adeea0f21c997bf3))
* **i18n:** A19 — Notification 三 tab (Channels/Rules/Webhooks) ([4c32210](https://github.com/pinpols/batch-console/commit/4c322109d8bc6265d1119c05b88b7b0ae70cf0b1))
* **i18n:** A20 — Config 三 tab (Sync/Secrets/ChangeLogs) ([47513c8](https://github.com/pinpols/batch-console/commit/47513c8512c7d3d8b63bb8a9c2a636e26e2defec))
* **i18n:** A21 — TagResource + SelfService 4 tabs + ConfigSyncLogs ([b743f7c](https://github.com/pinpols/batch-console/commit/b743f7cc879e14ffe6e28fee40c0a242e36242eb))
* **i18n:** A22 — Ops 全套 (Diagnostic/MetricGrid/Trend/Dist/Extra/Summary) ([2fe9a46](https://github.com/pinpols/batch-console/commit/2fe9a46369a8afda57ded6bb355a1b649746fcff))
* **i18n:** A23 — UserRole + AiChat ([9f17833](https://github.com/pinpols/batch-console/commit/9f17833bd4c1c6970fd8614b7e528dc17d485d7a))
* **i18n:** A24 — FilePipelineObservability + ReportExportHub ([c607dcf](https://github.com/pinpols/batch-console/commit/c607dcfe311307409287f787628b4561eba22117))
* **i18n:** A25 — ExecutionLog + VirtualProTable + LayoutHeader 漏网文案 ([e70c058](https://github.com/pinpols/batch-console/commit/e70c0588a22bee50e7c6a7f96e5e2b442c1f488b))
* **i18n:** A26 — Workflow Inspector 3 forms (Node/Edge/Workflow) ([2929cdc](https://github.com/pinpols/batch-console/commit/2929cdce9f7c087fa506ce7836308a34d91f0231))
* **i18n:** A27 — ExcelMaintenanceWizard ([874946b](https://github.com/pinpols/batch-console/commit/874946b8c457e8561c47f45f3d21e61818cf28e7))
* **i18n:** A28 — TenantPackageImportWizard ([25dcf74](https://github.com/pinpols/batch-console/commit/25dcf74aa6f39a90f06c1e222ca88de87a1b975b))
* **i18n:** A29 — WorkflowDesigner ([a9c7e35](https://github.com/pinpols/batch-console/commit/a9c7e35565690a77badd5c63077f888d02074136))
* **i18n:** A30 — PageHeader 返回 tooltip + NotificationDeliveryLogsTab ([2b7571d](https://github.com/pinpols/batch-console/commit/2b7571dc831418059d416dd930a971a2db1065ed))
* **i18n:** A31 — MPullRefresh 下拉刷新文案 ([098b982](https://github.com/pinpols/batch-console/commit/098b982b804ce47f1d1e0750ed6ab290b190d650))
* **i18n:** Batch A1 — FileList + TenantList 双语化 ([1cfda17](https://github.com/pinpols/batch-console/commit/1cfda17d8643a09dcc770b5b130da2047c090f22))
* **i18n:** Batch A10 — FileTemplateList + ArrivalGroupList ([4e1c50d](https://github.com/pinpols/batch-console/commit/4e1c50d1ccbc4c0429b816255f624015682709db))
* **i18n:** Batch A11 — Monitor 5 页(WorkflowRunList/Detail/JobInstanceDetail/JobStepInstanceList/PartitionView) ([7c63cc6](https://github.com/pinpols/batch-console/commit/7c63cc66e023e102c98ed0b3dae74062f8fcf1b4))
* **i18n:** Batch A12 — Observability 7 文件(EventCatalog/OutboxList/QueryTabs + 4 子 tab) ([64d0d41](https://github.com/pinpols/batch-console/commit/64d0d41debb184c64c7ff366898c433fc54cc805))
* **i18n:** Batch A13 — Login + NotFound + QueueConfig ([fa29fe1](https://github.com/pinpols/batch-console/commit/fa29fe1ca97d8acc627defec65d47f9a2dcffc12))
* **i18n:** Batch A14 — WorkflowDefinitionList ([c79d190](https://github.com/pinpols/batch-console/commit/c79d19048adcce562adbcfa93c03469d9c7b76f5))
* **i18n:** Batch A2 — JobInstanceList 双语化(运维高频页) ([02809f2](https://github.com/pinpols/batch-console/commit/02809f24798712f97d12ec43885be61bc54a45d2))
* **i18n:** Batch A3 — SchedulerSnapshot 双语化 ([456de16](https://github.com/pinpols/batch-console/commit/456de16a4435602fb069afee65f7fa1ee1cea6b0))
* **i18n:** Batch A4 — Approvals(通用审批 + Catch-up 审批)双语化 ([710be0e](https://github.com/pinpols/batch-console/commit/710be0ebb8cd8f203c5045658433be2d29697823))
* **i18n:** Batch A5 — AlertList + JobDefinitionList 双语化 ([1707ed2](https://github.com/pinpols/batch-console/commit/1707ed2580e6271aeea1f387136a180aaed21176))
* **i18n:** Batch A6 — ConfigReleaseList 双语化 ([7128474](https://github.com/pinpols/batch-console/commit/7128474a25ac8577889a1a0f1afabae333cf5b73))
* **i18n:** Batch A7 — WorkerManagement 双语化 ([93e5ede](https://github.com/pinpols/batch-console/commit/93e5ede0b33ec7da23e9e6bc65e263db4d4775df))
* **i18n:** Batch A8 — TriggerList + ApiKeyList + UserAccountList(系统管理三件套) ([0332ae2](https://github.com/pinpols/batch-console/commit/0332ae2a372c5cabbfebce49e7f5311c61c59d06))
* **i18n:** Batch A9 — SystemParameterList + TagManagement + AuditList ([3743626](https://github.com/pinpols/batch-console/commit/3743626631ef80222426f00d041849fd3bde5028))
* **i18n:** Batch B — 补全 30 个 enum 组中英文案 ([fc2d040](https://github.com/pinpols/batch-console/commit/fc2d040db1bcba860b77c9334b7dac381198f2e7))
* **i18n:** Batch C — 移动端 5 个旧页 + AppBar 全部 i18n 化 ([cbff849](https://github.com/pinpols/batch-console/commit/cbff8499b70d9922ea6a1dabfc82774703f60ac2))
* **i18n:** Batch D — 表单校验 framework 接 i18n,callsite 增量迁移 ([a20cb63](https://github.com/pinpols/batch-console/commit/a20cb631f3eb21e4b819e9925e438360e30e2747))
* **i18n:** 接入 vue-i18n 9 + 中英双语骨架 ([05d8375](https://github.com/pinpols/batch-console/commit/05d8375af50202b4bb0b9b77e8515e7d8dc63895))
* **i18n:** 阶段 2A 框架级 chrome 中英化(Header/Sidebar/MobileTabBar/CommandPalette) ([1792033](https://github.com/pinpols/batch-console/commit/17920331323546f08b5c63af626c30425c9813bc))
* **i18n:** 阶段 2B 47 个页面 title/description 中英双语 + 路径反查 key ([a2edf99](https://github.com/pinpols/batch-console/commit/a2edf997605fda957bc4b2128198718497d21ee8))
* **idempotency:** 写请求自动注入 Idempotency-Key + Web Push 跟进 BE 优化 ([870e90c](https://github.com/pinpols/batch-console/commit/870e90c8e6082e5d8efd53312b84ca45a6d1d066))
* **job:** JobDefinition 列表加 ExecutionMode 列 + 轻量编辑抽屉 ([e939cb6](https://github.com/pinpols/batch-console/commit/e939cb6efb610e544aead066d81a63a2a06bf1b4))
* **job:** 向导式 Job 定义创建/详情 + Bundle 导入对话框 ([c71e850](https://github.com/pinpols/batch-console/commit/c71e8508022cb67979bb27f694acc6c8092d7048))
* **list:** 10 个裸 el-table 真列表页接入 DataState 三态容器 ([22bd191](https://github.com/pinpols/batch-console/commit/22bd191e30cbd162ecd95f0cdaa6bde86d99a2c5))
* **list:** useListFilterFeedback 加 runRefresh —— 现有 18 个使用方接入 ([ca45268](https://github.com/pinpols/batch-console/commit/ca45268efec33cc655d6a17a4dd0c819bcd103ff))
* **maintenance:** admin-bypass header + affectedServices chip + 热更新 API client ([2c3a349](https://github.com/pinpols/batch-console/commit/2c3a349e6d9979bad2518502c6850799d32b0d22))
* **maintenance:** 维护模式 banner / 降级页 / 503 拦截 + breakpoints token ([fe2165d](https://github.com/pinpols/batch-console/commit/fe2165dfc04325e62e04b6838badc843774ac209))
* **meta-select:** 全站 30 处 enum 下拉统一中英双显风格 ([ad92eff](https://github.com/pinpols/batch-console/commit/ad92efff6b2a73a67e385ae12dcf8cc14a956759))
* **mobile:** Liquid Glass lite + 全局 click 埋点委托 + 移动端体验打磨 ([fdae8f7](https://github.com/pinpols/batch-console/commit/fdae8f784992d77dc5f076e03622cb474b1d4726))
* **mobile:** re-enable MCatchUp approve/reject buttons via unified approvals ([69b5377](https://github.com/pinpols/batch-console/commit/69b537722bd56f73da67f94f350226ff584b9341))
* **mobile:** tab 徽章 + Job 详情 + 下拉刷新 + 骨架屏 + PWA ([2305737](https://github.com/pinpols/batch-console/commit/230573745066740eb875047a1c1f3989bdb16119))
* **mobile:** 新增 /m/* 移动端独立路由（5 页） ([0aac893](https://github.com/pinpols/batch-console/commit/0aac8937527409df6b12de60ba264c629b9d5e3a))
* **mobile:** 移动端 ⌘K palette + 搜索按钮 ([03b62b4](https://github.com/pinpols/batch-console/commit/03b62b43dfcfa1579de7e2e89dc43f10e59b9c7b))
* **mobile:** 移动端补全 文件列表 + 租户列表 + 通用无限滚动 hook ([50ac5e6](https://github.com/pinpols/batch-console/commit/50ac5e6074728a9a3bee3dfc6f0402591dc17e67))
* **mobile:** 触底分页 + ID 一键复制 + 默认收起搜索 ([75194dc](https://github.com/pinpols/batch-console/commit/75194dc8cf2f76471e85d35032ee4a7f0e384bc8))
* **mobile:** 账号面板加租户切换/主题切换 + 关键页自动刷新 ([fa5d2df](https://github.com/pinpols/batch-console/commit/fa5d2df55995a1a455592a6170034aa23dccb26d))
* **mobile:** 重构 Tab Bar + 新增 Workers/Outbox/Logs + Step 钻取 + 批量 ack/retry ([d43fc06](https://github.com/pinpols/batch-console/commit/d43fc06817f7cb121850dc355d408aa4921e3106))
* **monitor:** add traceId search to job-instance and workflow-run lists ([6ed04a7](https://github.com/pinpols/batch-console/commit/6ed04a7b78af761f2f868f8df895959ad0defd5d))
* **monitor:** JobInstance 详情页改为 Dagster 风 tabs(概览/步骤/最近运行) ([732cb79](https://github.com/pinpols/batch-console/commit/732cb79d362a5323eb39f761b2375e86e8fc09b3))
* **nav:** IA 重排到 6 组 + 新增 /runs 跨实体聚合页 ([b5aa1a9](https://github.com/pinpols/batch-console/commit/b5aa1a9dc545abc2da89e69700ab5cfc31d0bf6a))
* **ops:** 3 个 ADR FE 落地 — dry-run / 跨日 DAG / 批次日重放 ([6448942](https://github.com/pinpols/batch-console/commit/6448942e21779c7541f119e828102eab5b9ecb0b))
* **page:** ADR-031 Phase 2 — JobInstance cursor pilot ([7d32d7c](https://github.com/pinpols/batch-console/commit/7d32d7c632af5bd820f593726dec0cc828a98130))
* **page:** ADR-031 Phase 4 — MJobInstances 移动端切 cursor ([58944d4](https://github.com/pinpols/batch-console/commit/58944d49c0f978a0dfaab2be699c7e567fbb8b81))
* **page:** FE 双轨分页公共件(ADR-031 Phase 1) ([8cc87e9](https://github.com/pinpols/batch-console/commit/8cc87e9bc3573e5ad0cfe508058011ab86e62139))
* **palette:** ⌘K 加实体匹配 — jobCode / workflowCode 服务端搜 ([05ff0dd](https://github.com/pinpols/batch-console/commit/05ff0dd55a46099dc16d084bc26f0c2d4ef5ad61))
* **pipeline:** PipelineDefinition 详情抽屉加 Runs tab — 完成 P2 对称性 ([1238345](https://github.com/pinpols/batch-console/commit/1238345f9c00d1c7cdbf922b7058447e8bf122b3))
* **pwa+infra:** PWA cache + 虚拟滚动 util + 补单测 ([4ba90b3](https://github.com/pinpols/batch-console/commit/4ba90b3125b4f833918513da1336bee52e0dc448))
* **pwa:** 新版本就绪提示 + 离线就绪 toast + 网络消息 i18n ([b5040eb](https://github.com/pinpols/batch-console/commit/b5040eb613913bcd2d10c4ed69a5d638f47b52cb))
* **qa-d:** D 档 sprint —— 移动端 CRUD/多浏览器/i18n soak/上传全链路 + 系统页大面积重构 ([e54bebe](https://github.com/pinpols/batch-console/commit/e54bebebc19b7d654d7a19e9299347d95f33aef7))
* **rbac:** ADR-032 4 角色重设计 FE 落地 ([953234e](https://github.com/pinpols/batch-console/commit/953234e45be97f795659724f9379ff952b8be9f1))
* **robustness:** 6 项审查中 P0/P1/P2 集中落地 ([bcc8916](https://github.com/pinpols/batch-console/commit/bcc8916eb106a05f81955637c36ea43d316f340e))
* **runs+docs:** /runs 加 status filter chips + IA doc 同步到 v5 ([07b2d58](https://github.com/pinpols/batch-console/commit/07b2d58b2277c7bbe1bff7268118ce7537de701a))
* **security:** P0+P1+P3 FE stub - 自助改密码页 + 强制改 guard + 过期 banner ([21ef2ff](https://github.com/pinpols/batch-console/commit/21ef2ff515b803b52b00dadbebcc1dea211eb872))
* **security:** 前端独立 DOMPurify 兜底 + 禁用原生 v-html ([9e07715](https://github.com/pinpols/batch-console/commit/9e077158af50439fd15c17689562f56cd1008cb3))
* **security:** 方案 A - 密码随机生成 + 一键复制 (3 处表单) ([79d3f35](https://github.com/pinpols/batch-console/commit/79d3f35c2ad368011e1e341953a7c614895d13bf))
* **security:** 登录请求体 RSA+AES 混合加密 (FE 端) ([1d06a1d](https://github.com/pinpols/batch-console/commit/1d06a1db2dcb1355a3bedcfa3beaffd9b9510f89))
* show excel import change summary ([eb429f0](https://github.com/pinpols/batch-console/commit/eb429f057aa56b6b8f50546ec0cd48a2dc4e3848))
* **skill:** fe-test-writer — Vitest 单测脚手架 skill ([c664a6a](https://github.com/pinpols/batch-console/commit/c664a6a009a60210a5a7c1d832a87bfa33598331))
* **tabs:** 总数封顶 12 + MRU 冒泡,inline 可见从 10 调到 6 ([ae2cc83](https://github.com/pinpols/batch-console/commit/ae2cc83d1b31a288a0bb3153ebfb29050b9e6c5a))
* **telemetry:** add VITE_TELEMETRY_ENABLED switch, default off ([cc90063](https://github.com/pinpols/batch-console/commit/cc900633b440f8517c0ea7d24424eff6238157d8))
* **tenant:** 复制源/初始化源下拉过滤系统租户(system/default/default-tenant) ([aec37d2](https://github.com/pinpols/batch-console/commit/aec37d2dc481074e880e76cabccf79d08c9c11db))
* **trace:** /logs?traceId 全站迁移 + Trace 诊断扩到 8 域 + 文案改用户视角 ([56a679b](https://github.com/pinpols/batch-console/commit/56a679bcd0b514e5e93390da4a3b1ceaf03bdb9c))
* **ui:** 当前租户 chip 常驻顶栏，醒目展示 ([f131876](https://github.com/pinpols/batch-console/commit/f1318760b935eaa50d248d3ba373f98fad0f6972))
* **upload:** JSON 输入默认 {} + 租户包导入整区拖拽 ([fa4247d](https://github.com/pinpols/batch-console/commit/fa4247d0b74c1772a3098a3a2fdf3c67d867ab52))
* **users:** add createUser API wrapper for POST /api/console/users ([9e51e15](https://github.com/pinpols/batch-console/commit/9e51e15ca3ae164e55ddaffe4e8fa18f77b4dc47))
* **ux:** ApprovalList target 跳实体 + Workers ?workerCode 深链 ([cdc4fcc](https://github.com/pinpols/batch-console/commit/cdc4fcc2166999d93a53023e03fa77d8310230f4))
* **ux:** confirmDanger 归一(10 高风险点)+ EmptyState 上 4 个核心列表 ([d2e4da2](https://github.com/pinpols/batch-console/commit/d2e4da2b1db66878408de191a78e4d8594d17cd7))
* **ux:** FileList traceId 列与详情 drawer 改 router-link ([c8b270f](https://github.com/pinpols/batch-console/commit/c8b270f1fe2a72f4d1ec3272809f795db775c51b))
* **ux:** JobInstanceDetail rerun 加下一步引导 ([ceaf4a6](https://github.com/pinpols/batch-console/commit/ceaf4a6a3dd4ed498d6950e87d35372d7b4b64c5))
* **ux:** Ops 卡片语义色 + 全局返回按钮 + 跳转参数补齐 ([aee0851](https://github.com/pinpols/batch-console/commit/aee085122fb541aa32f82dd8d0b2c18763303faf))
* **ux:** P0 三件套 — enum 文案翻译 + API Key 明文 modal + 销毁确认 composable ([f8d2938](https://github.com/pinpols/batch-console/commit/f8d29383cad38bd9fd43943f89f3d48db37d5291))
* **ux:** P1 三件套 — 默认筛选+快捷 chip / pageSize 持久化 / 行操作折叠 ([8f7b2b7](https://github.com/pinpols/batch-console/commit/8f7b2b726143aaa72649b13aa8270d6f41fa6fa9))
* **ux:** P2 五件套 — 引导式空状态/创建后引导/双按钮/错误三件套/初始化引导 ([2795e65](https://github.com/pinpols/batch-console/commit/2795e6519f5aa4dcf641695c272511bb6a5cb2b9))
* **ux:** 空状态引导式 CTA — Pipeline / Notification 3 tabs ([26a9f6b](https://github.com/pinpols/batch-console/commit/26a9f6b5779bc15aecdab5641643f5bb65113116))
* **ux:** 系统化优化 9 项 — Trace 诊断聚合 + 空态分层 + 引导收敛 ([bc7af49](https://github.com/pinpols/batch-console/commit/bc7af49b714fe1fa09a90b773415f04ff2cf294d))
* **ux:** 表单错误滚动 + Danger 确认归一 + 详情页快捷键 ([3561b41](https://github.com/pinpols/batch-console/commit/3561b41d10a07dddfd4ab6df03dc24b926e2c62d))
* **ux:** 详情页跨链 + Mobile Alerts 查日志 ([b083022](https://github.com/pinpols/batch-console/commit/b083022bb6973ed2f36a8641b4cc0a6574176d5e))
* **ux:** 跨页联动 + 智能返回 + KPI 卡片可点 ([2f8f6e7](https://github.com/pinpols/batch-console/commit/2f8f6e709ff0b4fcb0fb3232c0c70b8a1426e301))
* **wizard:** 上一步/下一步改成圆形箭头按钮 + tooltip 悬浮文字 ([fb328d1](https://github.com/pinpols/batch-console/commit/fb328d1684e9cdb9bae681bcf73a1bf46b339aad))
* **workflow-designer:** DSL editor hotkey 完善 + inspector readonly 形态 ([9babb27](https://github.com/pinpols/batch-console/commit/9babb275129062d6ed930282c91c121b2cfecced))
* **workflow-designer:** 完成 P0 路线图 4 项 ([5b8ab98](https://github.com/pinpols/batch-console/commit/5b8ab98a5eba82397881d56775cacc3ff4b890ed))
* **workflow-designer:** 完成 P1 路线图 5 项 ([6f35fdd](https://github.com/pinpols/batch-console/commit/6f35fdd2b89b11688207fa4e31eb4d1c77f7722f))
* **workflow-designer:** 完成 P2 路线图剩余 3 项 ([719f4d9](https://github.com/pinpols/batch-console/commit/719f4d927547734a59dfbb49c371d9e8ef245c0a))
* **workflow-designer:** 接入 X6 History + Selection 插件 ([f88ff29](https://github.com/pinpols/batch-console/commit/f88ff2939f636538952f7284fe8117dc6a407f16))
* **workflow:** add wait sensor designer support ([5435535](https://github.com/pinpols/batch-console/commit/54355354dcc19a894f51bc14d3eec8947a0669d6))
* **workflow:** designer toolbar 精简 11 → 4 主 + "更多" ([abde175](https://github.com/pinpols/batch-console/commit/abde1758b232ca2396ec91374a056310cdd43abb))
* **workflow:** P3 designer 四件套 — pill 配色/校验分组/cheatsheet/提交前校验 ([222f0b9](https://github.com/pinpols/batch-console/commit/222f0b95a5064f841a5732ee53c65f8d28c02fc3))
* **workflow:** RunDetail 顶部 inline mini-DAG + DAG 预览 Tab 跳大图 ([35c66f5](https://github.com/pinpols/batch-console/commit/35c66f5c73b53a2f7ea952a147cec67c3e2486f6))
* **workflow:** viewer 接 ?runId 状态叠加 + run detail 加"看 DAG"按钮 ([6ee5c41](https://github.com/pinpols/batch-console/commit/6ee5c41a1562337b1609a71d9f0636c6ba18573c))
* **workflow:** viewer 节点 click 跳转 + 运行中 8s 自动刷新 ([d5a99d2](https://github.com/pinpols/batch-console/commit/d5a99d2f6eb51f5ba3d161e27ca63fa7282b8ec7))
* **workflow:** X6 designer → mermaid viewer 单向迁移 ([3a0e150](https://github.com/pinpols/batch-console/commit/3a0e150718ceada51c4a387d925fb0219e8adca4))
* 侧边栏菜单改由后端 /auth/me 下发，租户切换刷新 ([fa0cc6e](https://github.com/pinpols/batch-console/commit/fa0cc6ecdada45527f8b9cc582376fb862c81358))
* 维护模式 UI + 桌面响应式 token + 大屏内容上限 ([64db57d](https://github.com/pinpols/batch-console/commit/64db57d4ff8efb1aff5773bc5594b6d1432671b3))


### Bug Fixes

* 2 个 audit 发现的前端 bug ([35e9596](https://github.com/pinpols/batch-console/commit/35e95966d161ac19ef36cdbf2ff84b1063e1b83e))
* **api:** 3 处 FE↔BE 字段错位修复(初次审计漏掉) ([7f6d2fd](https://github.com/pinpols/batch-console/commit/7f6d2fd9119278b16d0bbb5d69c2b403625c491d))
* **api:** blob 请求也要走 Authorization / X-Tenant-Id 注入 —— 修报表导出 401 ([72f0049](https://github.com/pinpols/batch-console/commit/72f00497d540615f7313aea2b07ad270a1adde27))
* **api:** 又 3 处写操作 body shape 隐藏 bug ([d41bc8f](https://github.com/pinpols/batch-console/commit/d41bc8f629fcf5842f79756f86956f28ec0df9ce))
* **audit:** 摘要列 HTML 实体解码 ([a6b4cdb](https://github.com/pinpols/batch-console/commit/a6b4cdb28dcc7a6a16ffc3a5e3239a88fc887616))
* **auth:** 切租户角色权限 4 个隐患全修 ([ce68f21](https://github.com/pinpols/batch-console/commit/ce68f21dab786bbe245a355ec206cb78fdba58b4))
* **ci:** Dockerfile apk upgrade 治 CVE-2026-31789 + Lighthouse 只测 /login ([5b43dce](https://github.com/pinpols/batch-console/commit/5b43dce06c1a48870bbc73c33b4ccc101f204a80))
* **config-package:** pass tenant id for excel actions ([4a89f97](https://github.com/pinpols/batch-console/commit/4a89f979cbf2a82c90f98dd247effa238494d6e8))
* **config-release:** 写操作补 operatorId,修复 400 "不能为空" ([4e84115](https://github.com/pinpols/batch-console/commit/4e84115acf211eeb46e186fda14808134c896344))
* **config-sync:** export/preview/import 全部对齐 BE Request DTO —— 修 HTTP 400 ([5c12c75](https://github.com/pinpols/batch-console/commit/5c12c7563185ba116734b304f76f29bf52e50bdc))
* **config:** preserve maintenance form data ([0c5d43d](https://github.com/pinpols/batch-console/commit/0c5d43dc418de6da78f0eb1175661c9d2305e337))
* **config:** restrict file picker to .xls/.xlsx to prevent 400 on wrong type ([edd984d](https://github.com/pinpols/batch-console/commit/edd984d09fc2cfd6b008b12ed7232811559277af))
* **dev:** make dev 前台启动前也清理占用端口的进程 ([282d519](https://github.com/pinpols/batch-console/commit/282d5199f9ca79277e4251af78f22872bd654606))
* **dev:** make dev 直接接管后台实例而非拒绝启动 ([bdc8e3e](https://github.com/pinpols/batch-console/commit/bdc8e3ef0cd6282b91c1dc2edebbf4b1606f2620))
* **docs:** /docs 无尾斜杠 404 修复(vitepress dev + nginx prod 双补) ([7dc9faa](https://github.com/pinpols/batch-console/commit/7dc9faae12488dc14fca2b9da610abf7c56e0881))
* **docs:** ADR nav 跳目录入口与其它 nav 一致(之前误判跳第一篇) ([511be14](https://github.com/pinpols/batch-console/commit/511be14bf54d7e03ac03368dfd2980f9d1c281b0))
* **docs:** ADR 页 sidebar"总览"误指 /architecture/ ([8e6bed5](https://github.com/pinpols/batch-console/commit/8e6bed59393b954d9cc36459b135dcb13f36b067))
* **docs:** docs 全 404 真修 — preview 模式 + nav 对齐 build 真实 URL ([96cbe83](https://github.com/pinpols/batch-console/commit/96cbe834b35bd1f6a688a452bff58ece06e6ce1e))
* **docs:** 文档站 191 死链全 0 — markdown rewrite + archive fallback + 静态资源拷贝 ([4a93802](https://github.com/pinpols/batch-console/commit/4a93802e70a01eba105907992a1f81ffff1e7f00))
* **dropdown:** 5 处下拉本应走后端 enum,却用了"从当前页 rows unique"派生 ([6523a5d](https://github.com/pinpols/batch-console/commit/6523a5d5bcd20cd459a04104a1caabc2d4ed4b5b))
* **e2e:** global-setup 适配 D7 HttpOnly cookie 鉴权 ([66fc433](https://github.com/pinpols/batch-console/commit/66fc43328d5021d1e86704599cc3d1f7fade13c8))
* **eslint:** autoImport globals 加 hardcoded fallback,治 CI lint fail ([cf64ff1](https://github.com/pinpols/batch-console/commit/cf64ff1363fc77459606f0e7d8eb0b6aae11e323))
* **eslint:** ignore 路径同步 docs-site → tools/docs-bridge ([309954b](https://github.com/pinpols/batch-console/commit/309954b135d6d160c91d65e69941ff2818ca717c))
* **event-catalog:** show event type codes ([033fd8f](https://github.com/pinpols/batch-console/commit/033fd8f8b78e834e9cd57fba76afe0f02289585f))
* **excel:** clarify template export center wording ([75c8548](https://github.com/pinpols/batch-console/commit/75c8548564e2f9540ec1741520a70bee9090c46e))
* **fe:** BE 日志驱动的 FE 缺陷收敛 —— 枚举/角色/校验/数字溢出/错误文案/查询栏宽度 ([dd3d894](https://github.com/pinpols/batch-console/commit/dd3d8940c5deff754388df5981a41caffaf4d1f5))
* **fe:** MetaSelect 支持 enum-key only 自取后端字典 ([5e22ca0](https://github.com/pinpols/batch-console/commit/5e22ca0b161d19d4b7d25affe2af053e1231ec04))
* **fe:** UX 反模式审计 - 3 处"保存后才告知"改前置校验 ([1f4c57a](https://github.com/pinpols/batch-console/commit/1f4c57a21abd17b27feddab4286a92ed1c22063d))
* **fe:** 二轮收敛 —— FileTemplate 5 枚举字段下拉 + UserAccount 角色多选 ([9a16849](https://github.com/pinpols/batch-console/commit/9a16849585aa8124d609c53c5c1bde0c8545730c))
* **header:** 去掉用户区 ... 收缩 + 修重复显示 + 修点击退出闪烁 ([95cf4f3](https://github.com/pinpols/batch-console/commit/95cf4f3c03b3c7e985dc750bc6455f10f73908e8))
* **i18n:** CronExprInput 硬编码中文改 t() (自审违约) ([4f7f218](https://github.com/pinpols/batch-console/commit/4f7f218a2b409a0a6d5c05854b16c58ff85df3aa))
* **i18n:** Element Plus 默认英文 locale 导致 MessageBox/Pagination 等中文测试失败 ([f9699ed](https://github.com/pinpols/batch-console/commit/f9699eda9975aaaeb93f8de86c7bbc2064c9c149))
* **i18n:** 切换语言无效 — useI18n() 改用 global scope ([992813b](https://github.com/pinpols/batch-console/commit/992813b871b12eff55bbc02d9107080e14429ce4))
* **i18n:** 语言切换 dropdown 打不开 — el-tooltip 嵌套在 trigger slot 内拦截 click ([120b1ad](https://github.com/pinpols/batch-console/commit/120b1adbec8e9c41da14c76a859046f82fb60144))
* **input:** 关键 code 字段补全校验 + calendar/window/channel 改下拉 ([2bfa0df](https://github.com/pinpols/batch-console/commit/2bfa0df361797e4deb93d4335e7249bc96026c9a))
* **interceptors:** 业务接口 401 不再清 token 跳登录 ([697c7e9](https://github.com/pinpols/batch-console/commit/697c7e991d679a55afd514612e8c88fb906f650e))
* iOS Safari 无痕模式 / 禁 Cookie 时 localStorage 抛错导致白屏 ([f97cfbe](https://github.com/pinpols/batch-console/commit/f97cfbeab20f58455942d94250828dfa382ad2d1))
* **job:** 新建定义默认禁用 + 修 OperationAuditList 死引用 ([62efe54](https://github.com/pinpols/batch-console/commit/62efe545010af06641f90184d4bc4e6d631c80cc))
* **layout:** tab active 失配空 pill + 返回按钮挪到右边并加前进 ([ff6bb20](https://github.com/pinpols/batch-console/commit/ff6bb20c3f4ccb5707cd1830eeafafdff1fb249e))
* **list:** 全列表 FE↔BE 字段对齐 — 1 真 DRIFT + 20 GAP 全修 ([3d16a9c](https://github.com/pinpols/batch-console/commit/3d16a9c2030bfaf0fa2d890f64fc28835143b9b7))
* **list:** 补 16 处缺失的 loadError ref + 拉通 useListLoadState 三态容器 ([9c1c66d](https://github.com/pinpols/batch-console/commit/9c1c66d6fb6bc3c875e87950bad201ec15969bf2))
* **logger:** telemetry 上报裁剪字段 + 4xx 丢批不卡死 ([0d9cc5f](https://github.com/pinpols/batch-console/commit/0d9cc5f7e37444c937dd2f3469331d9da3f886f8))
* **login:** 登录页预清失效 HttpOnly cookie + HMR 隧道开关化 ([b89d225](https://github.com/pinpols/batch-console/commit/b89d225b181638ac6fd7207105b2200f0552dc32))
* **meta:** 全站下拉空了 —— /meta/* 6 个函数双重解包修复 ([5076036](https://github.com/pinpols/batch-console/commit/5076036527dbde1f6b648600861bc105c5b9d534))
* **mobile:** keep-alive 缓存返回页 + 修手势返回闪烁 ([e7b2279](https://github.com/pinpols/batch-console/commit/e7b22796f3fe11cfe4931087bba4d2104c0825b1))
* **mobile:** 浅色模式 / 路由闪烁 / SLA 违约跳转反馈 ([cfa58c6](https://github.com/pinpols/batch-console/commit/cfa58c6f6f2a7a20db3077c6b64f4dad3b9f97cc))
* **nav:** IA v2 i18n 同步 — group 标题映射跟上 7 组改名 ([f66e669](https://github.com/pinpols/batch-console/commit/f66e6697ad212b5d8f85e77ee617c629a00eb6b4))
* **nginx:** /docs/ 直接命中 index.html,不再 302 → /docs/README ([4348043](https://github.com/pinpols/batch-console/commit/434804367de8903ab912011270e50f0c5fabbd04))
* **observability:** query execution logs by trace id ([12754d4](https://github.com/pinpols/batch-console/commit/12754d4de57a7efd277bfe85698c91549199bb3d))
* **ops:** OpsSummary 卡片跳转与计数语义对齐 ([a483d01](https://github.com/pinpols/batch-console/commit/a483d014f32c8b11ed086d1f529f87722ae1dcb3))
* **ops:** OpsSummary 扩展面板撤"执行进度"调用 —— 接口必需 jobCode/bizDate ([a84b9de](https://github.com/pinpols/batch-console/commit/a84b9defd2cc9cad4058c31bd538e61e8e8b683a))
* **ops:** SLA 达标率 gauge 空白 + 刷新按钮统一为 default 样式 ([370aec7](https://github.com/pinpols/batch-console/commit/370aec71e2b0f69844321ed0c046aa88f4ad63ed))
* **P1+P2:** ESLint ignore + 文件列表服务端分页 + Wizard 重载/实体引用 + Bundle Import + XSS ([49502d6](https://github.com/pinpols/batch-console/commit/49502d6059e96a4ceac9b5d752c138b8f4432ba1))
* **pipeline:** impl 下拉按 pipelineType + stage 双层收窄,治串味 ([450073c](https://github.com/pinpols/batch-console/commit/450073c1ffb809eb2596cf71d48a3b7d3cf71d6b))
* **pipeline:** impl 改 readonly chip,只在多 impl 注册时露 ✏ override ([fecd679](https://github.com/pinpols/batch-console/commit/fecd6794f5da137cc3beede9bf88d60199eb667d))
* **pipeline:** 步骤编辑器加 label + stage 下拉 + 自动 stepCode,治混乱 ([65ac678](https://github.com/pinpols/batch-console/commit/65ac678044ee64145df48221d5c98614218d56b2))
* **rbac+a11y:** 业务 401 不踢登录 + select focus ring 单层化 + WorkflowRun traceId 可点 ([8cffd5b](https://github.com/pinpols/batch-console/commit/8cffd5b7356efbfd32d740768479a4eb962991f3))
* **row-action:** row-action 改用 row.tenantId 避免租户切换 race 404 ([8928122](https://github.com/pinpols/batch-console/commit/89281224240ca88bb5e6c2d6789f54f3c2d6d6b5))
* **sse:** KeepAlive 感知,deactivate 时关 SSE 释放浏览器连接配额 ([2ade0c4](https://github.com/pinpols/batch-console/commit/2ade0c4781cb2622402bbc4eb7c963611676d309))
* **table:** ListPageQueryBar 加 #prepend slot —— 修复通知模块"新增"按钮不渲染 ([4a7ec1b](https://github.com/pinpols/batch-console/commit/4a7ec1bc2cedd8b3d73738731565d84c6c51b3a4))
* **tenant:** 把 default 从 RESERVED 移除 — 它本就是内置模板,加"推荐"标签 ([7fb916f](https://github.com/pinpols/batch-console/commit/7fb916f967cb10615910461a7dbfe4f209dd9bf0))
* **tenant:** 新增/批量新增对话框 UX 优化 ([9ba5549](https://github.com/pinpols/batch-console/commit/9ba5549e60a01c63338993d0378abd24c0ac4ea6))
* **trace:** 最近 traceId 全链路打通 —— shallowRef + redirect 透传 + Tab 消费 query ([a513b4f](https://github.com/pinpols/batch-console/commit/a513b4f75e46b28af0dbee804642792e09d44033))
* **ui:** CommandPalette 搜索框下空白条 + 滚动条粗丑 ([e6c29f9](https://github.com/pinpols/batch-console/commit/e6c29f938cc8cca48733cc1c4fb7e7955de660ec))
* **ui:** 修复下拉菜单点击闪烁 & 登录页清除按钮样式 ([d0d6466](https://github.com/pinpols/batch-console/commit/d0d64661963bf0b820f3c6936b7bc4e413f9a431))
* **ui:** 修复下拉菜单点击闪烁 & 登录页清除按钮样式 ([3fd8e0e](https://github.com/pinpols/batch-console/commit/3fd8e0e3f8f86e46c6f41a92ce5307e8703423e6))
* **ui:** 去掉列表页 header 与 ListPageQueryBar 之间的"刷新"重复 ([b14d7ab](https://github.com/pinpols/batch-console/commit/b14d7abdfbd9faf90e6228061aee25ca96a73550))
* **ui:** 顶栏退出按钮加二次确认 + 视觉分隔，降低悬浮误触 ([3eb1706](https://github.com/pinpols/batch-console/commit/3eb1706ca58213fbff6f258a27313eb2fe4cf64a))
* **vite:** watch ignore docs-site/dist,避免 dev-all 时 vite 被 OOM 干掉 ([67a2ed9](https://github.com/pinpols/batch-console/commit/67a2ed9d6d8edb4f72865b7266ffafe4e4b9352e))
* **workflow:** B7 beforeunload 兜底 + KeepAlive 下的 onDeactivated/onActivated 处理 ([d86a59e](https://github.com/pinpols/batch-console/commit/d86a59e697b57443c913f339a0ac368920aef09c))
* **workflow:** designer 新建模式真正可用 ([e938145](https://github.com/pinpols/batch-console/commit/e938145d48d15890f2794040a5c312dd85105ea3))
* **workflow:** SVGMatrix non-finite + RAF 泄漏 + 容器零尺寸守卫 ([392c2c5](https://github.com/pinpols/batch-console/commit/392c2c50374901844b2428e49f91d13dc12ba457))
* **workflow:** WorkflowDefinitionList 5 处 UX 修复 ([53e0034](https://github.com/pinpols/batch-console/commit/53e0034579d02058ed5fc572d40545667b1a98db))
* **workflow:** 修作业编排 4 类正确性 bug（切租户草稿 / list race / 动态导入 / 快捷键穿透） ([ad4e5d6](https://github.com/pinpols/batch-console/commit/ad4e5d6a1f9eb07ad8aeeb0f01649f22bfa9b7f5))
* 系统管理员切租户后被 fetchMe 覆盖回账号归属租户 ([f7bec1e](https://github.com/pinpols/batch-console/commit/f7bec1e3e6b8e77fead1d5dcbfaafc19a0e4ad64))


### Performance

* **vite:** dev 冷启动 29% 提速 + pre-bundle 大依赖 ([d7d9d2a](https://github.com/pinpols/batch-console/commit/d7d9d2a465304bd7822c2d5c34795ab063c164a8))
* **workflow:** O3 + O4 + O5 —— 双档版本号 / minimap 懒初始化 / 草稿去重 ([1c53d97](https://github.com/pinpols/batch-console/commit/1c53d97105e90aea9a04ef9e29e6511e9f0f108d))


### Refactors

* **api:** drop client-side filter fallback, use server-side filters ([6f899a1](https://github.com/pinpols/batch-console/commit/6f899a1565c849eb33e4ae90ee6777089cea19da))
* **approvals:** 审批中心合并 Catch-up,Tab 化 + ?tab= 深链 ([df9c737](https://github.com/pinpols/batch-console/commit/df9c737346100870082589e2960b654eb7a7f930))
* **common:** 抽出 JsonPreview + DetailDrawer 替换 19 处散落 ([45eae15](https://github.com/pinpols/batch-console/commit/45eae15101bcfcb8e15a205205e5bb30e68acf1c))
* **config:** 抽 useImportWizard composable —— 两个向导共用三步状态 ([2d367bd](https://github.com/pinpols/batch-console/commit/2d367bdd9963e9864c222f17c84e9d2d681e0c37))
* **e2e:** seed xlsx 统一引用后端权威源，消除前端副本漂移 ([760c47d](https://github.com/pinpols/batch-console/commit/760c47d997dcbc9210d0ed1ebdfc066b7e2ebd80))
* **excel:** keep standalone page export only ([0bf521b](https://github.com/pinpols/batch-console/commit/0bf521b73d57fba3d25bd67a11f71f62a5113cf9))
* **excel:** remove single-domain config excel center ([6962e5f](https://github.com/pinpols/batch-console/commit/6962e5ffc4e171cb7aef22fe49157874565e585b))
* **governance:** QueueConfig 569 → 467 行,抽 GovernanceFilterBar + confirmAndToggle ([3986e67](https://github.com/pinpols/batch-console/commit/3986e679d23d030fe8075383c8a9ade789f2b10c))
* **i18n:** 语言切换改为单按钮 toggle(去掉下拉) ([2501db0](https://github.com/pinpols/batch-console/commit/2501db0484a3939caae45423f5a9a4d6e0efb295))
* **ia:** 创建按钮统一到 PageHeader 右上 + Files/Governance 路由拆分 ([c045243](https://github.com/pinpols/batch-console/commit/c0452430d088930dc03b86101000a0befd72fbba))
* **layout,nav:** UserRole 降级到 Header dropdown,主菜单撤"当前登录态" ([ec81a17](https://github.com/pinpols/batch-console/commit/ec81a174fa8890b145530aca9db4aa661d845ec7))
* **nav:** IA v2 — 7 组方案,拆解"基础设施"杂烩 ([bf57fce](https://github.com/pinpols/batch-console/commit/bf57fce495acb7da6206dd031390b3007f9d005a))
* **nav:** IA v3 — "系统" 拆为"调度 + 系统" (8 组方案) ([61fa44d](https://github.com/pinpols/batch-console/commit/61fa44d798611cf331d5294874055471e4f909e9))
* **nav:** IA v4 — 心智纯化 (audits/queries 归位 + 文件名简化) ([84b29e6](https://github.com/pinpols/batch-console/commit/84b29e6ebd51cd828acabb21344c23ecb543efb8))
* **nav:** IA v5 + 文案修复 ([73d194b](https://github.com/pinpols/batch-console/commit/73d194b324135f5e78ce368dd8ee5bf6b60c2b5a))
* **nav:** 全菜单 icon 优化 — 解决 14 处重复/弱语义 ([9ed4565](https://github.com/pinpols/batch-console/commit/9ed45659a2ef61b470b8ce68f4728044ad75cfe5))
* **nav:** 租户/账户菜单项区分 — 文案 + icon 双更新 ([b74cdf0](https://github.com/pinpols/batch-console/commit/b74cdf0d418650a6b76375fb1fb927852e8bcb65))
* **observability:** 拆分 ObservabilityQueryTabs(848 行) + 修路由正则 bug ([19fc3ab](https://github.com/pinpols/batch-console/commit/19fc3ab6361dfd9a9e49dbaf9aea4844d32daecf))
* **page-header:** 描述文案统一改一句话简介 + 样式美化 ([ef8d3eb](https://github.com/pinpols/batch-console/commit/ef8d3eba2a07b042c66635e46a0a7ebac28b812c))
* **pagination:** 全局默认页大小 15 + page-size 选项 [15,30,50,100] ([6625c3b](https://github.com/pinpols/batch-console/commit/6625c3b17f0e3b068b9d4952c6485d3563c2fe3f))
* **pipeline:** 步骤编辑器只露 stage + 描述,其它字段自动 + 折叠 ([5cf86f3](https://github.com/pinpols/batch-console/commit/5cf86f35eb8ba4c743bc7074ab91c51d861956cb))
* **scheduler:** SchedulerSnapshot 648 → 552 行,抽 SnapshotKpiTab ([e15359b](https://github.com/pinpols/batch-console/commit/e15359b4c99b9b9bdc0473570e5e02c7b053d2f6))
* **system:** TenantList 845 → 375 行,5 个对话框抽独立子组件 ([da1108b](https://github.com/pinpols/batch-console/commit/da1108b843eca061e2302adae8f358cd70696c2a))
* **system:** 拆分 ConfigManagement(558 行) —— 4 个 tab 独立子组件 ([9ff6357](https://github.com/pinpols/batch-console/commit/9ff63579dd93f157ada0de496f33f71271c9c769))
* **system:** 拆分 NotificationManagement(919 行) —— 4 个 tab 独立子组件 ([40fd303](https://github.com/pinpols/batch-console/commit/40fd303d2a88ec6d5dd0df9ca334b4feeaeeccd7))
* **system:** 拆分 SelfServicePanel(504 行) —— 4 个 tab 独立子组件 ([4a25e9a](https://github.com/pinpols/batch-console/commit/4a25e9aa02fd3bb73a0e5f81210e615059de3cfa))
* **system:** 拆分 TagManagement(532 行) —— 两个 tab 独立子组件 ([6e81d92](https://github.com/pinpols/batch-console/commit/6e81d92feb68bbc3c6c233c4f0baaa835c1f2c98))
* **tags:** /system/tags 视觉收敛 — 侧导→水平 tabs + tagKey 改 autocomplete ([4601152](https://github.com/pinpols/batch-console/commit/4601152366545c4b29b397cfaab09ed8ce5771c6))
* **types:** RetriesTab/DeadLettersTab 用真 BE 类型替换 Record&lt;unknown&gt; ([10454cd](https://github.com/pinpols/batch-console/commit/10454cd5d413f4552b937aaf9dbc72c8e019af56))
* **ui:** 收拢类型逃生 —— 单测对齐 apiKey、放宽 ProTable data、下掉 37 处 any 强转 ([07cab6f](https://github.com/pinpols/batch-console/commit/07cab6fca4144f5e949ebb1584e2fbca13bfb774))
* **views:** 27 个未接入页全部统一走 useListFilterFeedback ([35729c2](https://github.com/pinpols/batch-console/commit/35729c2781b6a169280a4288e213880f34e5348d))
* **views:** 5 对 Legacy wrapper 物理合并 —— 删 7 行间接层 ([e343afb](https://github.com/pinpols/batch-console/commit/e343afbf207381065b820ff1efb78dac221f65db))
* **views:** EventCatalog 移到 observability/ —— 物理位置对齐导航 ([3b9dd8e](https://github.com/pinpols/batch-console/commit/3b9dd8e33663e77dd2a186a5b8506aa52059cec2))
* **views:** 全站 PageHeader / dialog / 提示文案对齐新菜单命名 ([02d46e9](https://github.com/pinpols/batch-console/commit/02d46e92b401e112ee72e124fb15aeab54264214))
* **views:** 删除无意义 passthrough computed —— tableRows = computed(() =&gt; rows.value) ([8e22aa3](https://github.com/pinpols/batch-console/commit/8e22aa3a689e12e2d98bea9ca88c1994e83fc024))
* **workflow:** B6 去父级 let _X 占位,graph 模块自持 bindInspectorCallbacks ([1632572](https://github.com/pinpols/batch-console/commit/163257298941f5012a6bb0014acb129e587a47df))
* **workflow:** CSS 外提 —— WorkflowDesigner.vue 2664 → 983 行 ([6cec9a7](https://github.com/pinpols/batch-console/commit/6cec9a72c6da52e40a9a55d5746c1b7a53e6f0e9))
* **workflow:** Inspector 右面板按选中类型拆 3 个子组件 ([a1ae375](https://github.com/pinpols/batch-console/commit/a1ae375f2b8bd7594ff30c4f64198962d4708052))
* 抽 useTenantReload composable 并迁移 43 视图，修首页切租户不刷新 ([e34eb9d](https://github.com/pinpols/batch-console/commit/e34eb9d3755b0d58e7e247c1efb31cb3129c6749))
* 日志/状态标签抽离、telemetry 移除、补齐单测 ([c0ae80d](https://github.com/pinpols/batch-console/commit/c0ae80d62aa8f0c165bfd923129540fc4a46bffb))


### Docs

* add CHANGELOG for full refactor ([104fbf9](https://github.com/pinpols/batch-console/commit/104fbf9b05e41e14b420a46cea627e09e0f38d78))
* **AGENTS:** 测试范围约定——移动端 /m/* 不写自动化测试 ([778e659](https://github.com/pinpols/batch-console/commit/778e6595e18a3f590aa3f4501430d4c8476fc6b4))
* **ci:** 加 docs/runbook/ci.md + CLAUDE.md §CI 指针(195 行完整文档) ([e559b8b](https://github.com/pinpols/batch-console/commit/e559b8b01ca68e546bf658fddfd1585fa76b90fb))
* **claude:** FE 测试约定 + 3 个 describe 命名对齐 (xxxApi 风格) ([6fa13d4](https://github.com/pinpols/batch-console/commit/6fa13d47b78d887949ad7c68346fd14e9f50f7d7))
* **claude:** 新增 FE CLAUDE.md(107 行) + AGENTS.md 改指针 ([91b16c8](https://github.com/pinpols/batch-console/commit/91b16c8e9858f037457d7782e08549ab95c239e3))
* **claude:** 新建 FE docs/changelog.md 跟踪 CLAUDE.md 条款变化 ([b6211f5](https://github.com/pinpols/batch-console/commit/b6211f5fe3aa5435f44ec7feb579476872d54c66))
* **design:** 同步 V3 设计书 IA / 色彩 / 实施变更补充 ([44898a6](https://github.com/pinpols/batch-console/commit/44898a64ff0b3c513c9f44c1fa9a320bebd1db9a))
* **docs-site:** 加 README 说明本地开发 + 部署流程 ([629826a](https://github.com/pinpols/batch-console/commit/629826ad0e6e0b675c5731b678f49dd6ee373a68))
* **plan:** 联调测试再扩 C+ 档 (生产健壮性) + Pro 档 (混沌+集成真打) ([1902ba5](https://github.com/pinpols/batch-console/commit/1902ba511958032917ba272a899145e668aeb4a5))
* **plan:** 联调测试方案扩到 B+ 档 —— RBAC 矩阵 / 业务剧本 / 多租户 / SSE / 设计器烟测 ([8ac5f6f](https://github.com/pinpols/batch-console/commit/8ac5f6f5334203cce720cdcc8a41dfe62e392ac2))
* **qa-c:** 补 C 档执行级细节 — P0 字段表 + 代码模板 + 已修 baseline ([471a9b8](https://github.com/pinpols/batch-console/commit/471a9b8feabb162a943d6449164e5c07f0537b6f))
* **qa-d:** phase6 业务流程闭环 报告 ([801749a](https://github.com/pinpols/batch-console/commit/801749adf7473e6e6e794fc393419955fc8decb5))
* **report:** B+/C+ 档执行总结 — 99.4% 非失败率 / 0 个 console-api 5xx ([751ed09](https://github.com/pinpols/batch-console/commit/751ed09f9c898fcdf7e01a8ee4737861cdf6542f))
* **reports:** 加 ExecutionMode 前端落地待办(P0-1.5 后端打通后) ([a9b5d1d](https://github.com/pinpols/batch-console/commit/a9b5d1df4205d71e2766fe38e7494ab0ee4e1138))
* **reports:** 跟进 2026-05-15..18 评审 + qa-d phase2/3/4/5 报告 ([3d39f4b](https://github.com/pinpols/batch-console/commit/3d39f4b4e80a56420d1426e1062f133b6e25377c))
* **report:** 终验 100% PASS - 719/749 / 0 fail / status=passed ([c45408a](https://github.com/pinpols/batch-console/commit/c45408a618a869acd3685f779c8c2e4eb5cc50ff))
* **report:** 补全 13 业务流双风格 spec 成绩 + 全量跑 timeout 复盘 ([3c45b46](https://github.com/pinpols/batch-console/commit/3c45b46e3ea7d06716673e657f65bc555dda191c))
* **report:** 补全 B+/C+ 联调报告 — 二次跑成绩 / 上线评估 / 业务按钮逐项核 ([df7b561](https://github.com/pinpols/batch-console/commit/df7b5612fa88c3304b72175130cfe96c63c15bb4))
* **runbook:** C 档 QA 完整覆盖测试方案 (3-5 天) ([445cb8f](https://github.com/pinpols/batch-console/commit/445cb8f263c5117c84f769713055ba88a156c946))
* **runbook:** 加 rollback runbook(Docker 单服务部署形态) ([6ceb5f7](https://github.com/pinpols/batch-console/commit/6ceb5f7683e90f54cfde04dc494319bc4135f5ab))
* **site:** 新增 fe-docs-site VitePress 子站 + docs-site 配置微调 ([407b0ec](https://github.com/pinpols/batch-console/commit/407b0ec486bc89ed489e50f02d9e3de5e81a4e6d))
* **skill:** fe-test-writer 加 §工作流 + §决策树(从参考材料变可执行手册) ([977ffee](https://github.com/pinpols/batch-console/commit/977ffee6e626bc32add0416eed00d702422e79d7))
* **skill:** fe-test-writer 澄清 Vitest vs Playwright 关系 ([f158e8c](https://github.com/pinpols/batch-console/commit/f158e8cc8a46e60a40e355803ed638d62845f7ba))
* **ui:** 2026-05-13 IA 审计与 Run-centric 详情页改造记录 ([46d76ae](https://github.com/pinpols/batch-console/commit/46d76aec06d4a0a122dc12c70cf1e39c96f5a1f2))
* 归类整理 + 索引 + CHANGELOG 追加本轮迭代 ([73cd70c](https://github.com/pinpols/batch-console/commit/73cd70c53846c8b3b2d3345f9bf9d8a08f4cffe4))
* 补 E2E 测试报告 2026-04-19 ([aa49316](https://github.com/pinpols/batch-console/commit/aa49316cc021344c1853881abd170d85f27b9042))

## 2026-04-19 — E2E 稳定化 + 移动端 + 真 bug 猎杀

### 端到端测试稳定化

- E2E 通过率 82.3% → ~95%（320 → ~370 过 / 67 → ~19 挂）
- 详细过程见 [docs/reports/2026-04-19-e2e测试报告.md](docs/reports/2026-04-19-e2e测试报告.md)

### 后端真 bug 修复（对应 `file-batch-system` 仓）

- `DefaultConsoleTriggerProxyService` 转发 orchestrator 缺 `X-Internal-Secret` → 401
- `ConsoleTenantConfigPackageExcelController.upload` 全局角色缺 `tenantId` 参数 → `tenant is required` 400
- tenant-package apply 阶段 pipeline/step MyBatis 参数键 camelCase 但 XML 绑 snake_case → `null` 撞 NOT NULL → 500
- `ConsoleDashboardQueryService` 用 `Map.of(null)` 构造聚合行 → NPE × 121
- `DefaultConsolePipelineDefinitionApplicationService.toInstant` 只枚举 .SSSSSS/.SSS 两种 fractional seconds pattern → 5 位小数秒解析失败

### 前端真 bug 修复

- `ListPageQueryBar` 缺 `#prepend` 命名 slot → `NotificationManagement.vue` 三个"新增渠道/规则/Webhook"主按钮**生产环境完全不渲染**（🔴 生产级阻塞）
- 业务接口 401 被 interceptor 当 session 失效清 token 跳登录 → 改为分级（`/auth/me` 才登出，业务 401 只弹 toast）
- `auth.fetchMe()` 同步 `tenant.setTenantId(profile.tenantId)` 把系统管理员刚切过去的租户又覆盖回源租户 → 移除
- iOS Safari 无痕模式 / 禁 Cookie 时 `localStorage.setItem` 抛 SecurityError → `index.html` shim 探测不可用时装上内存版，30+ 处调用点零改动
- 列表页 header 与 ListPageQueryBar 之间的"刷新"按钮重复（strict-mode 违规）→ 4 页去重
- 顶栏"退出"按钮放在悬浮面板末端易误触 → `el-popconfirm` 二次确认 + 视觉分隔
- Header 租户 chip 常驻顶栏（原来藏在悬浮面板里，admin 切租户体验差）
- logger telemetry 上报 `name` 超 200 会让整批 400 → `buildPayload` 裁剪 + 4xx 丢批不卡死

### 前端架构重构

- 侧边栏菜单由前端 `navigationGroups` 维护产品文案、图标和排序，后端 `/auth/me` 下发菜单只作为可见性来源（`ConsoleMenuRegistry` 按 authorities 过滤）；切租户后自动 `fetchMe()` 刷新 authorities + menus
- 抽 `useTenantReload(loadFn)` composable 统一 `onMounted + watch(tenant.tenantId)` 模式，迁移 43 个视图
- Element Plus 全局 `zh-cn` locale（main.ts `app.use` + App.vue `ElConfigProvider`），MessageBox 按钮从 "OK/Cancel" 统一到中文
- 前端独立 DOMPurify 兜底 + ESLint `vue/no-v-html: error` 禁用原生 `v-html`，新增 `v-safe-html` 指令
- Vite 性能调优：`server.warmup` + `optimizeDeps.include` 大依赖预打包 → dev 冷启动 1.36s → 0.97s
- `make dev` 前台启动接管后台实例 + 清端口，与 `dev-bg` 行为对齐

### 移动端独立路由 `/m/*`

- 新增 `MobileLayout` + `MobileAppBar` + `MobileTabBar`，共享 stores/api/composables
- 首批移动端覆盖：`MOpsSummary` / `MApprovals` / `MAlerts` / `MJobInstances` / `MCatchUp` + `MJobInstanceDetail`；后续扩展了文件、Worker、Outbox、执行日志等应急入口
- PWA manifest + apple-touch-icon / favicon，"添加到主屏幕"即独立 app 启动
- 下拉刷新（`MPullRefresh`）+ 骨架屏（`MSkeleton`）+ tab bar 徽章（`mobileBadges` pinia store）
- 自动刷新（`useAutoRefresh`，visibility-aware），概览 30s / 告警 20s 轮询
- UA + viewport 检测自动 `/` → `/m/ops/summary` 跳转，`?desktop=1` 强制桌面版
- 账号面板支持切租户 / 切主题 / 退出

### 工具链与 E2E 支撑

- Playwright globalSetup 接通 config，每次 e2e 前刷 token + 重新 seed ta/tb/tc
- seedTenant 上传 URL 加 `?tenantId=`；幂等键改为 tenant + 内容哈希稳定值
- e2e seed xlsx 统一引用后端权威源 `../../file-batch-system/docs/test-data/...`，前端副本删除
- actionTimeout 5s → 10s、navigationTimeout 10s → 15s、globalTimeout 3min → 30min、单测 timeout 15s → 25s
- 新增 `AGENTS.md` 跨仓联调相对路径索引 + 前端通用规则（useTenantReload / DOMPurify / 移动端不写 e2e）

### 文档整理

- `docs/` 按长期权威 / 阶段性报告（带日期前缀）/ 归档三层重组
- `docs/README.md` 作为文档索引
- 阶段性报告统一加 `YYYY-MM-DD-` 前缀入 `docs/reports/`

---

## 2026-04-18 — 前端全量重构

### 角色与权限

- 三角色菜单权限矩阵（ADMIN / CONFIG_ADMIN / AUDITOR），基于 `minRole` 控制菜单和路由可见性
- 系统角色均可切换租户（`canSwitchTenant`），租户用户只读显示
- 系统菜单组 `minRole` 从 ADMIN 降为 OPERATOR，租户管理和通知投递对 CONFIG_ADMIN 可见
- 路由守卫与导航菜单 `minRole` 对齐

### 租户切换

- Header 租户切换器：系统角色显示 TenantSelect 下拉，租户用户显示只读 pill
- `tenant.setTenantId()` 同步写 localStorage，避免 API interceptor 读到旧值
- 移除 6 个列表页搜索栏中的 TenantSelect（FileList、JobInstanceList、JobDefinitionList、WorkflowDefinitionList、AlertRecord、UserAccountList），租户 ID 统一从全局切换器注入

### UI 统一

- 所有 pill-tabs 补上 `v-hover-tab-activate="true"`（11 个页面）
- 移除内部元素误用的 `app-surface` 类（OpsSummary、OpsTrendPanel、OpsDistPanel、AiChat）
- 30+ 处硬编码像素值替换为 design tokens（ExcelMaintenanceWizard、JobInstanceDetail、ConfigReleaseList 等）
- `console-table` 全局加圆角 `border-radius: var(--radius-content)`
- pill-tabs 内容区自动 `padding-top`，`form-section` 自动应用 `form-panel` 视觉样式
- Dialog 内表单统一美化：label 加粗、间距紧凑、最后一项无底部 margin
- `label-width` 统一为 `100px`（9 个文件）
- 空状态文案统一为"暂无数据"（QueueConfig、UserAccountList、TenantList）
- TagManagement 英文 label 改中文（标签键/标签值）
- WorkerManagement 搜索 label "编码"改"关键字"
- JobInstanceList date picker 补 `width: 260px`
- tab 内表单统一包裹 `form-panel`（SelfServiceJobs、ConfigSyncPanel）

### 表格标准化

- 9 个页面从原生 `el-table` 迁移到 `ProTable + ListPageQueryBar`，统一搜索/分页/骨架屏：
  - SystemParameterList、ApiKeyList、TriggerList
  - EventCatalog（2 tab）、NotificationManagement（4 tab）、TagManagement（3 tab）
- UserRole 表格 tokens 对齐

### API 对齐（OpenAPI spec v6）

**错误调用修复（17 项）：**

- `auth.ts`：login 去掉多余 `tenantId`
- `job.ts`：clone 从 query params 改为 request body
- `file.ts`：archive `fileIds[]` → `fileId`(int)；presign-download `expiresInSeconds` → `reason`；redispatch 去掉 `channelCode`；download 补 `approvalId`；archive/delete/redispatch 返回类型 `string` → `ConsoleFileOperationResponse`
- `ops.ts`：kafka-lag `tenantId` → `groupId`；outbox/republish `{eventIds}` → 裸 `int64[]`；outbox/cleanup 补 `retainDays`
- `system.ts`：file-channels/templates PATCH body 加回 `tenantId`
- `scheduler.ts`：pause/resume 去掉 body；snapshot history 补 `limit`
- `dashboard.ts`：execution-progress 补 `jobCode`/`bizDate`；tenant-usage 补 `days`
- `governance.ts`：4 个 toggle 改回 `POST /{id}/toggle` + query params（与 spec 一致），body 加 `tenantId`

**缺失端点补齐（21 项）：**

- `auth.token`、`job.rerun`、`job.updateDefinition`
- `config.createConfigRelease`、`config.getReleaseApproval`
- `governance.createQueue/BatchWindow/Calendar/QuotaPolicy`、`governance.importCalendarHolidays`、`governance.deleteCalendarHoliday`
- `system.createFileChannel/Template`、`system.updateFileChannel/Template`
- `excelDomains.quickImportAlertRoutings`
- `system.queryPipelineDefinitions` 补 filter params

**类型生成：**

- `npm run gen:api` 重新生成 `api.generated.ts`
- `console-api.ts` 导出共享 Excel 类型：`ExcelApplyRequest`、`ExcelApplyResponse`、`ExcelUploadResponse`、`ExcelQuickImportResponse`、`ExcelRowIssue`
- Excel 向导加入 `previewWorkbookUrl` 展示

**清理：**

- 删除幽灵端点 `createReleaseApproval`（spec 无此 POST）

### Bug 修复

- `useHeaderLogic.ts`：`canSwitchTenant` computed 与 import 同名导致无限递归，import 重命名为 `checkCanSwitchTenant`
- `DefaultLayout.vue`：FAB z-index 从 2500 降为 1999，避免遮挡 dialog
- `Login.vue`：`validate()` 结果显式检查，`catch(() => false)` + `if (!valid) return`
- `JobInstanceList.vue`：日期变更不重置页码，补 `query.page = 1` + `loadData()`
- `useHeaderLogic.ts`：`copyTenant` 用 `??` 代替 `||`，避免空串歧义
- `tenantAccess.ts`：AUDITOR 加入 `canSwitchTenant` 允许列表

### E2E 测试

- 删除冲突的旧 `playwright.config.cjs`（含 globalSetup 连后端）
- 配置从 `.ts` 改为 `.cjs`，跳过 TS 编译，解决 Playwright 启动卡死
- 加超时机制：15s/测试、5s/断言、10s/导航、3 分钟全局兜底
- 加 `e2e/tsconfig.json` 隔离编译
- `enterDemoApp` 加 token 过期早期检测
- 40 个测试文件、389 个用例（需后端运行才能全绿）

### 单元测试

- 15 个测试文件、167 个用例全部通过
- `tenantAccess.test.ts` 更新：AUDITOR 改为允许切换租户
