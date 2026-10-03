# 前端工程成熟度路线图

本文用于把大厂前端 / Node 工程经验落到 `batch-console` 的长期治理入口。它不是阶段性审计报告,也不替代现有 CI、发布和测试文档;它只回答三个问题:

- 后台控制台前端要成熟到什么程度才适合持续上线。
- 哪些能力必须自动化拦截,哪些必须真实环境验收。
- 后续优化应该按什么优先级推进。

## 成熟度目标

| 维度 | 当前口径 | 目标口径 |
|---|---|---|
| API 契约 | 后端 OpenAPI + 前端生成类型 + `gen:api:check` | 后端字段、权限、错误码、前端映射和测试 fixture 同步变更 |
| UI 体系 | 已有设计 token、通用表格和部分统一空态 | 列表页、筛选栏、空态、危险操作、详情抽屉和 TraceId 展示全部组件化 |
| 权限体验 | 四角色菜单 / 路由 / 按钮持续收敛 | 菜单、按钮、空态、降级页、接口错误提示全部由同一权限模型驱动 |
| 真实验收 | staging-gate 承担 Playwright 真环境验收 | 角色 x 核心流程 x 租户切换 x 降级场景形成固定矩阵 |
| 运行时一致性 | Node 24、Docker、Nginx、版本接口已治理 | 本地、CI、容器、staging 对 Node/npm/浏览器/环境变量无隐式差异 |
| 文档与证据 | README、runbook、user-guide 分层 | 每个上线阻断项都有文档入口、命令入口和当前证据边界 |

## P0: 上线准入必须稳定

1. **前后端契约链不可漂移**
   - 后端 OpenAPI 是 API 权威源。
   - `src/types/api.generated.ts` 只允许生成,不允许手改。
   - 修改 `src/api/**`、权限载荷、错误码或枚举映射时,同步更新单测、mock、fixture 和用户可见文案。

2. **四角色权限闭环**
   - 正式角色只保留 `ROLE_ADMIN`、`ROLE_AUDITOR`、`ROLE_TENANT_ADMIN`、`ROLE_TENANT_USER`。
   - 菜单、页面、按钮、空态、降级页和接口 403 提示必须描述同一套能力边界。
   - 前端只做可用性和提示,最终授权以后端为准。

3. **关键流程真环境可验收**
   - 登录、租户切换、作业定义、Workflow / Pipeline、作业运行、审批、配置导入、Outbox、告警、文件到达和账号治理必须能在 staging 复跑。
   - Playwright 本地模拟接口不能声明为真实业务验收。
   - 真实验收结果写入 runbook 或阶段报告,不能只保留终端输出。

4. **发布入口不可含糊**
   - PR 快门禁、Full Gate、staging-gate 和 build-image 各自职责清楚。
   - `latest` 只作开发便利,环境晋级必须使用 `sha-*` 或 digest。
   - `/version.json` 的 gitSha 必须能和发布镜像对齐。

## P1: 运维型 UI 一致性

1. **数据密集页面统一结构**
   - 状态段、筛选栏、右侧操作、实时监控条、列表主体和分页使用固定层级。
   - 输入框和搜索框不得挤占主体列表高度;默认折叠高级筛选。
   - 行内操作统一小号 outline 或低强调文字按钮,危险操作显式二次确认。

2. **空态与异常态统一**
   - 空态使用统一组件,包含主文案、辅助说明和可选动作。
   - 403 / 404 / 移动端不支持 / 下游降级 / 维护中使用固定降级页,不得静默跳首页。
   - 错误提示展示 TraceId 时,应便于复制和定位,避免把技术细节塞满主流程。

3. **复杂页面工具台化**
   - 配置导入、配置同步、设计器、文件观测等复杂页要有固定底栏、步骤状态和差异预览。
   - JSON / Excel / 文件选择等高风险输入必须有校验、预览和撤销边界。
   - 页面级说明只放必要上下文,不写“使用说明式”大段文字。

4. **视觉 token 收敛**
   - 颜色、圆角、间距、阴影和字体只走 design token。
   - 浅色 / 暗色主题均需检查主要状态色、禁用态、边框和 hover 过渡。
   - 运维后台优先安静、密集、可扫描,避免营销化大卡片和单一色系。

## P2: 工程维护成本下降

1. **页面复杂度治理**
   - 超大 Vue 文件优先拆 composable、局部组件和配置表,不做无收益抽象。
   - 页面改动同时关注 i18n 行数、固定 px、裸颜色、表格片段数量和弹层数量。

2. **验收证据结构化**
   - UI 审查、真实联测、e2e 失败复跑、视觉回归都要记录验证范围和未覆盖项。
   - 不把“代表页面通过”描述成“全页面验收通过”。

3. **本地一键复现**
   - 保持 `verify:local`、`preflight:changed` 和真实联测脚本的职责分层。
   - 换机器时 Node/npm、Playwright 浏览器、后端 OpenAPI 来源和环境变量应能按文档恢复。

## 不做边界

- 前端不实现后端权限绕过、调度决策、执行状态裁决或数据修复。
- 前端不把 Playwright route mock 当作真实后端验收。
- 前端不为兼容旧角色或旧认证方式保留隐藏分支。
- 前端不单独维护后端 OpenAPI 的副本。

## 入口

- CI 与发布: [`../runbook/ci.md`](../runbook/ci.md)、[`../runbook/release-promotion.md`](../runbook/release-promotion.md)
- 上线准入: [`../runbook/go-live-readiness-checklist.md`](../runbook/go-live-readiness-checklist.md)
- 测试体系: [`../testing/README.md`](../testing/README.md)
- 设计 token: [`./design-tokens.md`](./design-tokens.md)
- 权限与角色: [`../user-guide/roles-and-access.md`](../user-guide/roles-and-access.md)
