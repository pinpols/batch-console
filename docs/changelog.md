# 变更记录(CLAUDE.md 规范条款变化)

> 本文件只记录 **CLAUDE.md 编码规范条款本身** 的变化(项目结构 / 构建命令 / 架构约束 / 编码红线 / i18n / 测试范围等文档自身内容变动)。
>
> Feature 完成、bug 修复、运维操作、临时数据动作等项目演进信息**不要**写到这里 —— 那些以 git commit + PR 描述 + 对应模块文档(`docs/design/*.md` / `docs/runbook/*.md` / `docs/reports/*.md`)为权威记录。
>
> 按日期倒序,使用绝对日期(`YYYY-MM-DD`)。

### 2026-05-22

- **CLAUDE.md §CI 新增**(同日)— 3 workflow 表 + 关键决策(e2e 只 staging 跑)+ 指针 `docs/runbook/ci.md`。
- **`docs/runbook/ci.md` 新建**(195 行)— FE CI / CD 完整文档:3 workflow 详情(pr-gate 7 步 / full-ci 4 job / staging 2 job)+ 关键决策(锁住)+ Secrets 配置表 + 守护脚本↔workflow 覆盖矩阵 + 常见故障排查表。
- **CI 扩 3 个 workflow 对齐 BE**(原 `ci.yml` 单 workflow → `pr-gate.yml` + `full-ci-gate.yml` + `staging-gate.yml`):
  - `pr-gate.yml`(改名原 ci.yml + 补 `check:i18n` + `npm audit --omit=dev --audit-level=high`)— PR 必过门禁,~7-10 min
  - `full-ci-gate.yml` 新建 — main push / nightly cron(02:00 UTC = 10:00 Asia/Shanghai)/ 手动,4 个并行 job:static-and-unit / docker-and-scan(Trivy CRITICAL 拒) / lighthouse(perf 0.8 / a11y 0.9)/ security-audit(全量 npm audit critical 拒),~20-30 min
  - `staging-gate.yml` 新建 — tag `v*` / 手动,Playwright 82 specs against staging URL + Lighthouse against staging,~15-25 min
  - `.github/lighthouse-budget.json` 阈值统一管理(perf 0.8 / a11y 0.9 / SEO 0.8 / CLS 0.1 / LCP 2.5s)
  - **关键决策**:Playwright e2e 不在 PR / nightly 跑(CI 起 BE 太脆,业界 Vercel/Netlify 也是 deploy-time 跑),只 staging 真环境跑;e2e fail block deploy 不 block merge

### 2026-05-21

- **CLAUDE.md §测试约定 新增**:扫 46 个 `*.test.ts` 后归纳已成事实的统一项 + 锁住(避免后续偏移):Vitest 唯一框架 / 同目录 `*.test.ts` / `describe` 用被测对象短名(`jobApi` 不是 `xxx API`) / 禁 `should` 前缀 / mock 顶层 `vi.mock` + `vi.mocked` / DOM 时 `@vitest-environment jsdom` / SFC 测试受 element-plus 阻塞优先抽 util。同时把上轮新加的 3 个 `describe('xxx API', ...)`(triggers/approvals/tenants)改成 `xxxApi` 跟 `jobApi`/`instanceApi` 对齐。

### 2026-05-20

- **CLAUDE.md 新建**(107 行):FE 之前只有 AGENTS.md(41 行,Codex 约定),Claude Code 不自动 baseline 加载 → 进项目无规范,反复违反 i18n / API 客户端 / 类型生成等约定。按 BE CLAUDE.md 同样结构组织,首次落地:
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
- **AGENTS.md 改 5 行指针**:指向 CLAUDE.md,保留 Codex / OpenAI Agent 兼容入口,内容以 CLAUDE.md 为准。
- **docs/changelog.md 新建本文件**:对齐 BE 仓库 `file-batch-system/docs/changelog.md` 模式,后续 CLAUDE.md 条款变化在此追加。
