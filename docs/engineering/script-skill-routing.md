# 前端脚本与 Skill 路由

本文是仓库自有脚本、执行入口和相关文档的维护导航。命令及参数以 `package.json`、脚本源码和 Workflow 为准；这里记录选择依据、环境前提与副作用边界。逐文件覆盖证据见[2026-10-25 全量复核](../reports/2026-10-25-document-governance-and-skill-routing.md)。

Skill界面元数据由各自`agents/openai.yaml`维护；它不是执行脚本，也不产生提交／部署授权。运行进度各真实入口的条件化方法集中在[测试Skill参考](../../.agents/skills/frontend-testing-ci/references/runtime-progress-acceptance.md)，命令／环境事实继续由`package.json`和对应fixture说明维护，不复制另一套来源。

## 按任务选择

| 来源或任务                                                                | 主责 Skill                                          | 配合资料与执行边界                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文档分类、命名、索引、归档、统一站点内容                                  | `frontend-docs-release-governance`                  | `check-docs.mjs`、`docs-{prepare,build,serve,lib}`；站点构建包含配对后端资料，失败需归因到实际来源。                                                                                                                                                                                      |
| 架构、可读性、注释、i18n、编码、环境变量、维护性、UI 复杂度和治理基线检查 | `frontend-engineering-governance`                   | `check-*`、`verify-governance.sh`；i18n/可访问性语义再组合 `frontend-i18n-accessibility`，不以关键词检查代替人工判断。                                                                                                                                                                    |
| Vitest、Playwright、门禁封装、结果收集、预检与真实验收                    | `frontend-testing-ci`                               | `test-*`、`run-playwright.mjs`、`report-playwright-release.mjs`、`scripts/ci/`、`scripts/tests/`、`scripts/local/fe-*`、`e2e/*.cjs` 与 `e2e/fixtures/**/sql/`；当前支撑 SQL 含读取、造数、精确清理和故障注入，不能排除或当作退役 SQL。先核对 mock/真实后端、角色、租户和 setup/teardown。 |
| OpenAPI 获取、API 生成、接口漂移                                          | `frontend-api-contract`                             | `gen-api-types.sh`、`check-api-drift.sh`、`ci/resolve-backend-openapi.sh`；后端规范为权威，不手改生成类型，来源不可达不是通过。                                                                                                                                                           |
| 开发服务、进程、健康检查、容器、发布制品与 PWA                            | `frontend-deploy-runtime`                           | `dev-server.sh`、`dev-stack.sh`、`kill-fe.sh`、`local/health-check.sh`、`prepare-platform-release.mjs`、`gen-pwa-icons.mjs`；端口只说明监听位置，启停前核实进程/容器归属；制品准备不证明部署成功。                                                                                        |
| 依赖安装钩子、版本、SBOM 和许可证                                         | `frontend-engineering-governance`                   | `prepare.mjs`、`check-version-alignment.sh`、`generate-frontend-compliance.mjs`、`check-compliance-drift.mjs`；生成结果与检查分开，不能手改生成物掩盖漂移。                                                                                                                               |
| Git 本地钩子与 PR 操作                                                    | `git-pr-workflow`                                   | `.husky/pre-commit`、`.husky/pre-push`；本地检查和分支保护不隐含创建 PR、推送或合并的授权。                                                                                                                                                                                               |
| Workflow、Dockerfile、Makefile、包命令、VitePress 配置/主题               | `frontend-engineering-governance`                   | 它们是执行声明或支持配置；按涉及的测试、部署和文档领域组合 Skill，不按普通脚本重复计数。                                                                                                                                                                                                  |
| 当前导入数据、异常 Excel、文件样例和数据完整性检查                        | `frontend-import-template-governance`               | `e2e-data/` 与 `verify-data.sh`；静态数据可读、JSON/Excel 可解析不证明符合当前后端模板或已导入成功，真实业务验收组合测试 Skill。                                                                                                                                                          |
| 已退役的造数、清理与旧分支同步脚本                                        | `frontend-docs-release-governance`                  | `e2e-data/archive/`、`scripts/archive/`、`e2e/archive/` 只保存原始经验；不作为当前操作入口。复用方法需先与 Cookie/CSRF、当前 API、数据边界和短期分支流程核对。                                                                                                                            |
| `tools/download-list-manager.ps1`                                         | `frontend-engineering-governance`（仅负责资产归属） | 独立下载清单工具，使用其旁置说明；不属于控制台业务或交付流程，不因项目治理而运行下载或外部命令。                                                                                                                                                                                          |

## 全量复核方法

失败节点重放的 `test:e2e:workflow-node-replay:real`、`WorkflowReplayFixture` 与 `runtime-progress/sql/workflow-replay-*.sql` 由 `frontend-testing-ci` 主责，角色／端点权限由 `frontend-api-contract` 配合，冻结图和推送由 `frontend-state-data-flow` 配合。输入准备／修复、业务状态回读、执行终态后的精确清理、认证去重收尾与全租户表残留检查分别承担不同职责；本地 HTTP GET 是真实 Worker 的受控目标，不是伪造 Console 响应。未知结果拒绝与已知失败重放分别留证，不能为通过而把未知结果降为普通失败。

`test:e2e:workflow-dag-branches:real`／`WorkflowDagFixture` 沿用同一测试与状态流Skill，覆盖实际双Job并行、ALL等待及CONDITION／FAILURE边。Worker状态SQL按租户与已保存多个Job定义ID回读，清理按各自编码和ID执行；本地HTTP只控制响应时间。生产状态语义仍以后端调度器和节点终结逻辑为准，不由测试改写。

`test:e2e:multi-calendar-progress:real`／`MultiCalendarProgressFixture`由测试与状态流Skill负责，时间语义参照后端`scheduler-correctness`。`multi-calendar-progress-prepare.sql`只准备第二日历，`multi-calendar-progress-state.sql`只独立回读；三定义双日历和FIXED_RATE由真实Quartz执行。定时关闭与计划清理按保存的全部Workflow定义ID进行，不用直接改Quartz表推进调度；批次日cutoff不足、未生成任务与实际成功率分开呈现。

1. 先确认当前工作树、HEAD、暂存/未暂存/未跟踪状态。完整目录使用 Git 可版本化且实际存在的文件集：`git ls-files -z --cached --others --exclude-standard`，按 NUL 分隔去重；不要解析默认带引号的中文路径输出。
2. 文本资料包含根说明、`docs/`、`design/`、`e2e-data/`、工具旁置说明、PR 模板及全部 `SKILL.md`。脚本包含 Shell、Node、Python、PowerShell、SQL fixture 和无扩展名 hooks；脚本测试、共享库与入口配置分别标注角色。生成 API、SBOM、图片、Excel 与原始输出属于支持数据，不能伪装成人工审阅过的文档。
3. 为每个来源记录路径、SHA-256、角色、生命周期、主责 Skill、复核层级、处理和证据。对完整集合与覆盖表双向差集，新增、删除和改名都应解释。归档脚本仍在分母中，状态标为历史。
4. 当前资产与代码、API、脚本、导航交叉核对；历史记录保留原始范围和结论，注明历史属性。当前未完成计划保留并更新状态，不能仅因日期早就归档。
5. 对新名称、迁移、Skill 与规范同步检查索引及引用。覆盖表是本次快照；后续文件变化需要重新盘点，不能将旧表当成永久“全量通过”。

完整文件盘点和静态路由复核不等于逐行业务审查、脚本执行成功、测试通过或目标环境验收。真实写入、清理、启停、Git/PR 与部署按当前用户请求判断授权，不因加载 Skill 或看到历史命令就执行。

统一文档站的 `scripts/lib/docs-publication.mjs`、`scripts/tests/docs-publication.test.mjs` 和 VitePress 主题 `publicationNavigation.mjs` 归 `frontend-docs-release-governance`，构建／预检门禁由 `frontend-testing-ci` 配合。`test:docs-publication` 验证无损块分卷、重复／自定义锚点和同目录同基名跳转；完整 `docs:build` 仍检查体积。只处理被忽略的发布副本，不改配对后端权威证据；真实浏览器导航另行复验，见[统一文档站](unified-documentation-site.md)。

运行DAG/每日进度的真实验收入口为 `npm run test:e2e:progress:real`，由 `frontend-testing-ci` 负责；该控制图场景不创建Job/Worker，通过真实API验证Workflow暂停/恢复与角色边界、SSE冻结DAG状态和运维总览统计，手工业务日期不能代表Quartz计划。`e2e/fixtures/runtime-progress/` 包含正式运行包密码适配器与身份准备/清理SQL，边界见[夹具说明](../../e2e/fixtures/runtime-progress/README.md)。进度状态与图表组合规则由 `frontend-state-data-flow` 维护。

Atomic Worker实际执行闭环使用 `npm run test:e2e:worker-progress:real`，由 `frontend-testing-ci` 负责。它真实启动独占Worker并检查Workflow节点、Job/分区/任务推送和租户每日图表；`worker-progress-state.sql` 只回读，`worker-progress-cleanup.sql` 按租户与已保存身份精确清理。该场景独立于不创建Worker的控制图验收和SQL驱动的Pipeline投影验收。

Atomic执行器运行态门控验收使用 `npm run test:e2e:atomic-runtime:real`，同样由 `frontend-testing-ci` 负责。用`E2E_ATOMIC_RUNTIME_MODE=available|unavailable`分别核对真实Worker状态反查和禁用时的安全降级，四角色读权限及精确清理；认证、运行模式和日期化证据要求见[runtime-progress夹具说明](../../e2e/fixtures/runtime-progress/README.md)。

Pipeline完整推送的`test:e2e:pipeline-progress:real`及`e2e/fixtures/runtime-progress/sql/pipeline-{prepare,advance,cleanup}.sql`由`frontend-testing-ci`负责。这里有真实写入和精确清理，仅证明真实API/SSE传输与SQL投影，不证明Worker业务执行；操作前提见同目录README。

人工文件上传与文件组联动的`test:e2e:manual-upload:real`、`ManualFileUploadFixture`及`runtime-progress/sql/manual-upload-*.sql`由`frontend-testing-ci`负责真实浏览器/对象存储/权限/精确清理验收；上传目标、业务日、必需文件集合和IMPORT模板的用户流程由`frontend-import-template-governance`配合。SQL只准备独占Workflow/文件组/模板及角色，业务上传和确认必须经过页面与真实服务；占位未确认时跨过扫描周期且Workflow运行数为0，确认后核对Workflow终态。该START→END夹具不替代真实Worker/IMPORT Pipeline处理验收。

批次日治理的 `test:e2e:batch-day:real` 与 `runtime-progress/sql/batchday-{prepare,state,cleanup}.sql` 归 `frontend-testing-ci`：真实业务动作、角色、丢响应/刷新恢复和清理验证。源SQL只准备前置状态或独立回读，不替代治理API；范围与环境见[夹具说明](../../e2e/fixtures/runtime-progress/README.md)。未知命令恢复属于既有状态数据流和幂等契约，不另设重复Skill。

结果版本治理的 `test:e2e:result-versions:real` 与 `runtime-progress/sql/result-version-{prepare,state,cleanup}.sql` 归 `frontend-testing-ci`，API响应边界与生成类型由 `frontend-api-contract` 配合维护。场景覆盖真实提升/归档、审计与四角色，不输出原始载荷；SQL准备/回读/精确清理的权限和数据边界见[夹具说明](../../e2e/fixtures/runtime-progress/README.md)。

对象文件的真实IMPORT阶段和恢复使用 `test:e2e:import-worker-progress:real`、`ImportWorkerPipelineFixture`及`runtime-progress/sql/import-worker-{prepare,state,cleanup}.sql`，主责为`frontend-testing-ci`，进度关联和推送由`frontend-state-data-flow`配合。目标表延迟只服务本例真实LOAD观察，保留强制RLS和业务唯一键；进程中断只命中保存的子进程句柄，恢复必须等待Orchestrator租约回收与真实Worker续跑。当前运行状态不能由SQL写入，活跃副作用未收敛不能清理或报告通过。

## 整轮Workflow与EXPORT恢复

`test:e2e:process-worker-progress:real`／`ProcessWorkerPipelineFixture`由测试及状态流Skill承接PROCESS代表路径。`process-worker-prepare`、`process-business-state`与`process-worker-cleanup`只访问显式`E2E_PROCESS_BUSINESS_DATABASE`业务库；`process-worker-state`与`process-platform-cleanup`访问独立平台库。官方业务bootstrap仅用于本例新空库，不能在共享平台库执行；平台状态不由造数SQL推进。Worker身份、RLS、真实COMMIT中断、业务产出、阶段推送和双库精确清理分别留证。

`test:e2e:dispatch-worker-progress:real`、`DispatchWorkerPipelineFixture`及`dispatch-worker-{state,cleanup}.sql`由测试Skill主责，状态流／API Skill配合。只读状态与终态清理分开；真实对象限速代理不记录凭据，不伪造源对象。NAS必须使用正式适配器，未知结果保留原失败，经核实与审批恢复，实际字节／sidecar／回执及授权消费分别核对；不将本地隔离目录解释为外部渠道验收。

`test:e2e:whole-workflow-replay:real`／`ExportWorkflowReplayFixture`复用测试、状态流及API契约Skill，并按后端Worker／对象存储方法核对真实产物。`export-replay-prepare.sql`只准备RLS源表、延迟只读视图和导出模板；`export-replay-state.sql`只回读；`export-replay-cleanup.sql`在运行终态后清理本例租户／作业和所建关系。能力目录由真实注册产生，不能SQL注入声明；审批、冻结图、恢复与文件SHA分别留证。

## Nginx路由的HTTP回归入口

`npm run test:nginx-routing`和`scripts/tests/nginx-routing.test.mjs`由`frontend-deploy-runtime`负责路由/缓存契约，`frontend-testing-ci`维护运行夹具。镜像事实来自Dockerfile，配置来自nginx目录；只创建独占容器、临时制品和鉴权替身，按标签清理，不操作共享应用或真实业务数据。场景和验收边界见[测试说明](../testing/README.md#nginx运行时路由回归)与[部署说明](../deploy/docker-nginx.md#静态错误状态与隔离路由回归)。
