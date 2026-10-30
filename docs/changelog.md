# 变更记录(Agent 规范条款变化)

> 本文件只记录 **Agent 指南规范条款本身** 的变化(项目结构 / 构建命令 / 架构约束 / 编码红线 / i18n / 测试范围等文档自身内容变动)。
>
> Feature 完成、bug 修复、运维操作、临时数据动作等项目演进信息**不要**写到这里 —— 那些以 git commit + PR 描述 + 对应模块文档(`docs/engineering/*.md` / `docs/runbook/*.md` / `docs/reports/*.md`)为权威记录。
>
> 按日期倒序,使用绝对日期(`YYYY-MM-DD`)。

### 2026-10-26

- **CI结果输出契约**：与配对后端统一通过/不通过/跳过/报告/忽略、参数错误和失败汇总格式；结果字段单行编码，旧失败原因以诊断保留，日志及GitHub摘要一致。保持原阻断、模式控制与required check边界；契约及复验入口见[CI手册](runbook/ci.md#门禁结果格式)。

- **Skill界面与按需参考**：补齐现行前端Skill的中文显示名、短说明及新增文件的默认调用提示，保留已有调用策略与依赖。运行进度真实验收详细方法无损移至测试Skill的references，入口说明适用场景；短Skill继续引用权威文档，不机械创建目录或复制个人偏好。

- **超长证据发布复核**：文档治理Skill补入只拆生成副本、完整块／字节／锚点保留及构建失败边界；保留HTML禁用与既有体积预算，发布或主题变更需实际复验旧链接和分卷导航，不以编译通过代替页面可用。

- **DISPATCH恢复验收方法**：测试Skill补入真实NAS适配器、真实对象透传限速、部分临时文件和最终发布的区别；进程中断后先保持未知结果阻断，核实目标未发布后经不同申请／审批身份恢复，逐项核对字节、sidecar、回执与授权消费，不放宽重投围栏。

- **PROCESS双库真实验收方法**：测试Skill要求独立平台／业务库、正式WAP表结构和完整strict RLS表策略；不修改共享角色、不禁用启动检查。仅在实际COMMIT查询及暂存可见后中断本例Worker，分别核对记录／金额、跨租户哨兵、旧新尝试、页面推送及双库清理。

- **整轮重放与EXPORT恢复方法**：测试Skill补充真实能力注册、审批身份、原版本冻结、独立产物和checkpoint对账；隔离数据库之外还要隔离Worker临时文件目录。延迟SQL先核对真实分页计划，收尾等待源查询退出；共享SQL参数变化检查全部调用方并复验既有入口。

- **混合日程统计验收方法**：测试Skill与夹具说明补入真实多定义、双日历、CRON／FIXED_RATE、独立覆盖水位和日期切换；控制Workflow计数不冒充Job/Task数量。定时清理覆盖全部保存定义，首次引导通过页面关闭后再留截图，不硬编码身份版本键。

- **真实业务DAG分支验收方法**：测试Skill区分控制节点与实际Job并行，按冻结节点与持久Job ID核对关联，分步放行外部响应验证ALL等待，分别保留条件跳过、失败处理和根失败。首次Kafka分区分配与Worker注册分开判断，失败收尾覆盖后续到达请求，多Job按全部保存定义ID回读／清理。

- **重放与运行位置验收方法**：测试Skill补充未知结果拒绝／已知失败审批重放的分层证据、既有明细展开、Controller权限、原运行保留与全租户表清理；状态Skill明确执行位置来自冻结节点集合，不能把根运行结束游标当作已执行END。

- **前端Skill职责与UI检查补强**：复用现有质量、工程治理、UI、i18n与测试入口，明确Bug/规约/可用性/视觉建议的证据边界；UI专项增加[常见问题与复核表](../.agents/skills/frontend-ui-ia-review/references/common-ui-checks.md)，涵盖布局一致性、表单/表格/弹层、状态反馈、长文本、中英文/主题/窄屏、键盘、图表及真实业务对账。前端双仓入口引用配对后端权威总控，不重复维护20域清单；[复核记录](audits/frontend-skill-boundaries-and-ui-review-2026-10-26.md)区分方法更新与实际页面验收。

- **真实文件阶段与Worker恢复方法**：测试Skill、脚本路由和runtime-progress夹具说明补充对象文件/BUNDLE_IMPORT、业务RLS、保存子进程句柄、租约回收、checkpoint、阶段旧尝试及业务唯一行的证据边界；修正人工上传绑定Workflow已实现后的测试入口说明。

### 2026-10-25

- **前端文档与脚本全量补查**：按 WDI 当前 Git 文件集建立逐文件覆盖和 Skill 主责路由；修正现行用户/运维资料与 Cookie、Workflow、系统 Pipeline 的漂移，日期化归档旧设计和 QA 结果，隔离退役写脚本及常驻分支同步脚本，移除 Git hook 隐式创建 PR。历史证据、静态检查和真实环境验收分开记录。
- **文档生命周期与 Skill 路由**：归档历史 Phase 1 联调清单、E2E 根因快照和 dated LOC 快照；统一当前文档治理入口、索引和文档检查脚本路由。产品行为变更留在根 `CHANGELOG.md`，不重复记录在本文件。

### 2026-10-24

- **文档查找与更新路由**：AGENTS 与前端文档 Skill 统一引用本仓索引和配对后端路由指南，区分长期资产维护原文、阶段方案更新、日志追加和每轮日期记录；系统变化按实际影响同步原资产，前端不复制后端权威契约。
- **后端文档迁移引用同步**：修正配对后端目录收敛后的文档链接；本仓目录布局保持现有职责。

### 2026-10-16
- **前后端 Skill 中文显示名**：为两仓全部项目 Skill 补齐中文 `display_name` 与 `short_description`，保留英文规范名用于 `$skill` 调用，并在两仓指南说明中文自然语言匹配边界。
- **前端 Agent 工程规则对照补齐**：对照后端基线补充前端编辑前保留工作区差异、行为改动测试先行及测试层级原则，并在 Skill 指南中明确前端与共享开发环境、只读运维分析的组合路由和禁止副作用边界。
- **改造方案、评审与治理结论留档规则**：明确 Agent 应主动更新前端权威方案、工程规范、审计/报告、Backlog 或验收记录，不依赖用户逐次提醒；评估建议与实施授权分开。
- **长任务检查点与防偏航**：前端 `AGENTS.md` 增加跨轮次和高风险任务的目标、范围、验收、进度记录及只读检查点要求，共用详细流程以配对后端 Skill 指南为准。
- **AGENTS 强化 Skill 调用规则**：要求前端任务先查 Skill 指南，命中适用范围时读取并遵循完整 `SKILL.md`，选择一个总控和必要专项；明确用户点名 Skill 的使用要求，以及 Skill 不扩展操作授权。
- **前后端 Skill 职责与授权统一**：前端指南引用后端共用的任务阶段与授权协议；同步双仓周期治理总控中的三类整改台账、分维度优先级和完整调度语义矩阵；补充后端 Java 测试治理入口、开发/只读运维入口及前端功能、Bug、Issue、多 PR 交付边界。

### 2026-10-13
- **前后端联合版本自动准备**：前端提供同步版本清单/lockfile/Changelog 的脚本，移除独立 release-please 工作流，改由配对后端统一创建同版本 Release PR；发布与部署仍需人工审核和 staging 验收。

- **前后端周期治理 skill 总控**——新增 `cross-repo-governance-review`，将月度增量、季度存量、发布前、事故后和首次全量基线统一到固定 20 域覆盖矩阵；新增 Agent Skill 使用指南，明确双仓治理、前端综合审查、专项技能、组合示例和 PR 交付边界，避免门禁绿灯替代业务语义、目标环境与守卫有效性复核。
- **前后端联合版本约定**——正式版与 RC 在两个仓库使用相同 SemVer；普通 PR 只累计 `[Unreleased]`，不逐 PR 递增版本。联合 Release PR 按发布周期最高变更级别确定版本，并以固定前后端 SHA、镜像 digest 和真实 staging 验收作为 tag 与生产晋级依据。
- **代码可读性治理**——新增嵌套方法调用、语义中间变量、判别联合、多个 `null` 参数、字符串事实源和设计抽象边界的落地规范；新增调用现场 AST 候选门禁，仅阻断 PR 中新增/修改的深层嵌套实参与返回表达式，避免按括号数量机械整改。

### 2026-10-10

- **测试 fixture 与配置来源约定**——在 `docs/testing/README.md` 固化平台事实来源、共享 helper 与契约独立预期的边界；新增 `check:test-fixture-sources` 守护重复持久化键和内联 localStorage 桩，并接入增量预检、PR/Full Gate；`AGENTS.md` 增加简要入口。
- **前端门禁失败边界说明**——在 CI runbook 逐项区分增量预检的快速失败、PR/Full Gate 与本地完整门禁的失败汇总，以及文档构建和真实环境验收的依赖阻断边界。

### 2026-10-09

- **前端 Agent 指南与质量审查**——新增 `frontend-quality-review`，将 UI/交互、代码可读性/维护性、可访问性与浏览器安全纳入有证据边界的审查流程，并路由到既有专项技能；同时收敛 `AGENTS.md` 的重复测试/编码细则，保留高频约束和权威文档入口。参考 Vue、Carbon、W3C 和 OWASP 官方指南，继续遵循本仓库 design token、Element Plus、OpenAPI、HttpOnly Cookie 和安全渲染约束。
- **发布环境门禁补强**——staging gate 增加部署安全响应头检查及 Chromium、Firefox、WebKit、Pixel 5 的标记路由冒烟；完整业务 E2E 与 axe 基线仍在 Chromium 运行，浏览器覆盖边界在支持策略中明确记录。

### 2026-10-07

- **文档预检分层**——普通文档变更在提交前只执行链接、路径和上线准入检查；文档桥接、站点配置或构建脚本变化才触发本地完整文档构建，统一文档 CI 保留构建兜底，降低日常提交等待时间。
- **连续 PR 交付治理**——新增 `git-pr-workflow` skill；创建分支或 PR 前只从同一交付链核实前置 PR，记录 head/base/OID，未合并时使用 stacked PR，前置合并后收口 base 与平台 diff，并在汇总本地改动时只转移尚未交付的补丁。
- **GitHub 安全告警治理**——固化真实缺陷、误报与证据缺口的分类、修复边界和合并后 main 扫描确认;后续守护采用报告优先与基线增量阻断,不以绿色 workflow 代替告警关闭证据。

### 2026-10-03

- **前端工程化借鉴清单固化**——工程成熟度路线图补充组件库治理、信息密度分级、权限驱动 UI、门禁分层、工具链锁定、小 PR 影响清单和文档代码绑定，作为后续 UI/工程治理 PR 的长期评审口径。
- **前端工程成熟度入口**——新增工程成熟度路线图和上线准入清单，将 API 契约、四角色权限、真实环境验收、UI 统一、发布运行时和证据留存收敛为长期治理入口，避免把单次 UI 审查或本地模拟测试误写成上线通过。
- **上线准入文档门禁**——新增 `check:go-live-readiness`，在文档变更预检和治理检查中确认上线准入清单、工程成熟度路线图及索引覆盖关键治理口径，防止准入文档漂移成孤立说明。

### 2026-10-01

- **统一文档站发布过滤**——前后端分别通过 `docs/.docsignore` 排除已被替代且无现行依赖的历史页、技术试验、测试数据、规模统计和一次性验证证据；规则只接受相对 `docs/` 的路径前缀，现行设计、治理和可追溯证据继续发布。
- **当前待办与历史记录分层**——AI 文档对齐已落地的 SSE、服务端取消、会话恢复和权限证据，仅保留来源引用、真实 provider 故障和真机验收缺口；Phase 1 BE CRUD 清单明确降为历史记录，避免已修问题继续伪装成当前待办。
- **注释语言治理落地**——手写前端代码的业务意图、异常处理、测试场景和维护说明统一使用中文；API 路径、类型字段、命令、代码示例和工具指令保留原文。新增 `check:comments` 并接入变更预检、本地治理、PR Gate 与 Full Gate。

### 2026-09-30

- **认证与维护边界收口**——明确前端只使用后端下发的 HttpOnly Cookie，不再描述兼容 Authorization 注入；维护期间所有业务写请求由统一拦截器保护，后端 503 保持最终裁决权。
- **CI 依赖治理规则落地**——新增 Action、Runner、Artifact 的版本基线、分批升级、完整门禁、合并后确认和回滚规范；明确 npm 主版本与 CI 基础设施不得混合升级，并记录 Ubuntu 26.04 与 Artifact v7/v8 的本轮验证边界。

### 2026-09-27

- **GitHub 项目主页对齐**——README 采用与配对后端一致的定位、门禁徽章、快速导航和能力概览结构，并明确前端只承担控制面交互、不越过调度与执行职责边界。
- **工程治理技能固化**——新增 `frontend-engineering-governance`，明确 staged 预检、无后端完整门禁和真实环境验收三层入口；同步测试、文档、部署技能对 staging、环境登记、SBOM、归档和证据边界的约束。
- **本地治理入口收口**——`verify:local` 承担无后端完整门禁；真实业务验收由 `fe-acceptance.sh` 承担，后端、preview 或真实审计不可用时明确失败。
- **变更预检与历史文档归档**——`preflight:changed:all` 只读取实际工作区变更，并按范围执行架构、环境、workflow、文档、合规和 Changelog 检查；2026-07 重设计计划及已完成 i18n TODO 移入归档。
- **工程治理门禁补齐**——新增架构边界、环境变量、文档链接、维护性、workflow 安全和 SBOM 漂移检查；文档检查在单仓 CI 中识别配对后端的受控同级路径；`AGENTS.md` 的 CI 与部署入口同步当前工作流。
- **发布约束收紧**——staging 验收改为 fail-closed，版本标签只晋级同 commit 的不可变镜像；生产文档构建缺少后端权威源时直接失败。

### 2026-09-26

- **Agent 指南权威入口迁移**——`AGENTS.md` 从兼容入口升级为通用 Agent 权威指南；移除旧的工具专属指南文件和专属技能目录，避免规范口径继续绑定单一工具。
- **`.agents/skills/` 新建前端工程技能**——提取 8 类高频工作流：API 契约、状态数据流、UI/IA、i18n/可访问性、导入模板、测试 CI、部署运行时、文档发布治理；`AGENTS.md` 新增技能索引。

### 2026-06-23

- **AGENTS.md §分支用途 改写**——前端常驻分支从「`main` + `dev` 两条常驻」收敛为 **唯一常驻 `main`**,与配对后端 `file-batch-system` 单 main 模型对齐。`dev` 已并入 main 并删除(本地+远程);此后所有改动从 `main` 开 `feature/`·`fix/` → PR → `main`,合后即删(`deleteBranchOnMerge` 已开)。背景:`dev → main` 发布 PR 合并会被 auto-delete 误删常驻 dev,单 main 模型免此坑。

### 2026-06-16

- **AGENTS.md §分支用途 改写**——前端常驻分支从「main + 部署分支 `feature/docker-deploy`」改为 **`main` + `dev` 两条常驻**。部署文件(docker-compose / nginx / deploy.ps1 / sync-main / build-image·deploy workflow)**并入 main**(部署是产品一部分,与后端 main 同理),原 `feature/docker-deploy` 删除;`scripts/deploy.ps1` + `scripts/local/sync-main.ps1` 已 fold 进 main。日常 feature/fix 从 `dev` 开 → PR `dev`,发布 `dev → main`。

### 2026-05-22

- **AGENTS.md §CI 新增**(同日)— 3 workflow 表 + 关键决策(e2e 只 staging 跑)+ 指针 `docs/runbook/ci.md`。
- **`docs/runbook/ci.md` 新建**(195 行)— FE CI / CD 完整文档:3 workflow 详情(pr-gate 7 步 / full-ci 4 job / staging 2 job)+ 关键决策(锁住)+ Secrets 配置表 + 守护脚本↔workflow 覆盖矩阵 + 常见故障排查表。
- **CI 扩 3 个 workflow 对齐 BE**(原 `ci.yml` 单 workflow → `pr-gate.yml` + `full-ci-gate.yml` + `staging-gate.yml`):
  - `pr-gate.yml`(改名原 ci.yml + 补 `check:i18n` + `npm audit --omit=dev --audit-level=high`)— PR 必过门禁,~7-10 min
  - `full-ci-gate.yml` 新建 — main push / nightly cron(02:00 UTC = 10:00 Asia/Shanghai)/ 手动,4 个并行 job:static-and-unit / docker-and-scan(Trivy CRITICAL 拒) / lighthouse(perf 0.8 / a11y 0.9)/ security-audit(全量 npm audit critical 拒),~20-30 min
  - `staging-gate.yml` 新建 — tag `v*` / 手动,Playwright 82 specs against staging URL + Lighthouse against staging,~15-25 min
  - `.github/lighthouse-budget.json` 阈值统一管理(perf 0.8 / a11y 0.9 / SEO 0.8 / CLS 0.1 / LCP 2.5s)
  - **关键决策**:Playwright e2e 不在 PR / nightly 跑(CI 起 BE 太脆,业界 Vercel/Netlify 也是 deploy-time 跑),只 staging 真环境跑;e2e fail block deploy 不 block merge

### 2026-05-21

- **AGENTS.md §测试约定 新增**:扫 46 个 `*.test.ts` 后归纳已成事实的统一项 + 锁住(避免后续偏移):Vitest 唯一框架 / 同目录 `*.test.ts` / `describe` 用被测对象短名(`jobApi` 不是 `xxx API`) / 禁 `should` 前缀 / mock 顶层 `vi.mock` + `vi.mocked` / DOM 时 `@vitest-environment jsdom` / SFC 测试受 element-plus 阻塞优先抽 util。同时把上轮新加的 3 个 `describe('xxx API', ...)`(triggers/approvals/tenants)改成 `xxxApi` 跟 `jobApi`/`instanceApi` 对齐。

### 2026-05-20

- **Agent 指南新建**(107 行):FE 之前只有轻量入口,不同 Agent 的默认加载入口不一致 → 进项目无规范,反复违反 i18n / API 客户端 / 类型生成等约定。按 BE Agent 指南同样结构组织,首次落地:
  - §项目概览(Vue 3 + TS + Element Plus + Pinia + vue-i18n + TanStack Query;桌面 + 移动双端)
  - §配对后端仓库(从 AGENTS.md 迁移,路径 / 子模块 / 联调约定)
  - §构建 / 测试(12 个 npm script 表 —— 原 AGENTS.md 缺失关键运行命令)
  - §目录结构(src/ 一级目录注释)
  - §架构硬约束(5 条:api.generated.ts 禁手改 / 统一 client.ts / useTenantReload / v-safe-html / HttpOnly cookie)
  - §i18n(必走 t() / zh + en 1:1 / check:i18n CI)
  - §移动端测试范围(不写自动化测试 + 何时补测 —— 原 AGENTS.md 完整保留)
  - §Vue/TS 编码细则 quick-ref(10 条最常被违 + 4 条红线)
  - §后端 OpenAPI 同步(gen:api → check:i18n → gen:api:check 三步)
  - §桌面 vs 移动(路由 / 共享 / 设备分流 / iOS HIG)
- **AGENTS.md 收敛为权威入口**:统一承载通用 Agent 入口和项目规范。
- **docs/changelog.md 新建本文件**:对齐 BE 仓库 `file-batch-system/docs/changelog.md` 模式,后续 AGENTS.md 条款变化在此追加。
