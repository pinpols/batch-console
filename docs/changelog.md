# 变更记录(Agent 规范条款变化)

> 本文件只记录 **Agent 指南规范条款本身** 的变化(项目结构 / 构建命令 / 架构约束 / 编码红线 / i18n / 测试范围等文档自身内容变动)。
>
> Feature 完成、bug 修复、运维操作、临时数据动作等项目演进信息**不要**写到这里 —— 那些以 git commit + PR 描述 + 对应模块文档(`docs/engineering/*.md` / `docs/runbook/*.md` / `docs/reports/*.md`)为权威记录。
>
> 按日期倒序,使用绝对日期(`YYYY-MM-DD`)。

### 2026-09-27

- **GitHub 项目主页对齐**——README 采用与配对后端一致的定位、门禁徽章、快速导航和能力概览结构，并明确前端只承担控制面交互、不越过调度与执行职责边界。
- **工程治理技能固化**——新增 `frontend-engineering-governance`，明确 staged 预检、无后端完整门禁和真实环境验收三层入口；同步测试、文档、部署技能对 staging、环境登记、SBOM、归档和证据边界的约束。
- **本地治理入口收口**——`verify:local` 承担无后端完整门禁；真实业务验收由 `fe-acceptance.sh` 承担，后端、preview 或真实审计不可用时明确失败。
- **变更预检与历史文档归档**——`preflight:changed:all` 只读取实际工作区变更，并按范围执行架构、环境、workflow、文档、合规和 Changelog 检查；2026-07 重设计计划及已完成 i18n TODO 移入归档。
- **工程治理门禁补齐**——新增架构边界、环境变量、文档链接、维护性、workflow 安全和 SBOM 漂移检查；`AGENTS.md` 的 CI 与部署入口同步当前工作流。
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
