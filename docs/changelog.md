# 变更记录(CLAUDE.md 规范条款变化)

> 本文件只记录 **CLAUDE.md 编码规范条款本身** 的变化(项目结构 / 构建命令 / 架构约束 / 编码红线 / i18n / 测试范围等文档自身内容变动)。
>
> Feature 完成、bug 修复、运维操作、临时数据动作等项目演进信息**不要**写到这里 —— 那些以 git commit + PR 描述 + 对应模块文档(`docs/design/*.md` / `docs/runbook/*.md` / `docs/reports/*.md`)为权威记录。
>
> 按日期倒序,使用绝对日期(`YYYY-MM-DD`)。

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
