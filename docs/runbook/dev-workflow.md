# 开发工作流(dev workflow)

本仓采用 **GitHub Flow 简化版**:只 `main` 一个长期分支,日常交付使用短期分支与 PR；合并及分支清理由本次授权和 `git-pr-workflow` 决定。

> 与配对后端 `file-batch-system` 一致策略，详见[后端本地开发手册](../../../file-batch-system/docs/runbook/local-development.md)。

## 分支策略

| 分支 | 命名 | 用途 |
|---|---|---|
| `main` | `main` | 唯一长期分支、生产代码、protected |
| 功能 | `feature/<topic>` | 新功能(如 `feature/dashboard-realtime`)|
| 修复 | `fix/<topic>` | bug 修复 |
| 杂项 | `chore/<topic>` | 重构 / 依赖升级 / CI 改动 |
| 文档 | `docs/<topic>` | 仅文档改动 |
| 紧急 | `hotfix/<topic>` | 生产 P0 bug |
| 自动化分支 | 以实际工作流为准 | 联合版本由后端准备 Release PR；本仓 Renovate 仅季度盘点 |

## 日常开发

```bash
# 1. 同步 main
git checkout main && git pull

# 2. 开短命分支
git checkout -b feature/dashboard-realtime main

# 3. 改代码 + commit(无 emoji,信息说"为什么")
git add <本次明确范围的文件>
git commit -m "feat(dashboard): 实时刷新 job 监控面板"

# 4. push + 开 PR
git push -u origin feature/dashboard-realtime
gh pr create --base main --title "..." --body "..."

# 5. 可选:标 automerge 让 CI 绿了自动合
gh pr edit <PR#> --add-label automerge

# 6. 等 required check 绿(pr-gate)+ merge
```

## 改 API 相关代码必做

```bash
# 改 src/api/* 或接口前
npm run gen:api          # 从 BE OpenAPI 重新生成 src/types/api.generated.ts
# CI 漂移检查会 reject 不同步的 PR
```

详见 [`AGENTS.md`](../../AGENTS.md) 「后端 OpenAPI 同步」。

## 提交前自检

```bash
npm run typecheck      # vue-tsc
npm run lint           # eslint
npm run test:unit      # vitest
npm run check:i18n     # zh/en 词条对齐
npm run build:fast     # vite build
```

## Hotfix（生产 P0）

从核实后的 main 基线建立 `fix/<topic>` 短期分支，完成针对性修复、检查和 PR。紧急情况也需核实前后端版本兼容；恢复当前服务优先按[回滚手册](./rollback.md)处理。正式版本、tag 和制品晋级仍走联合发布流程，不因合并 hotfix 就直接创建未经 staging 验收的 tag。

## Release(无 release 分支)

在后端仓库手动运行 `prepare-platform-release`，按本周期变更选择 patch/minor/major；审核并合并前后端同版本 Release PR 后，再按[发布晋级手册](./release-promotion.md)完成 staging、验收和 tag。普通 PR 不递增版本，也不直接打 tag。

## Label automerge

打 `automerge` 标签 → 等 required check 绿了自动 squash merge。
- ❌ 不自动 approve(reviewer approval 仍是 gate)
- ❌ 不跳 check
- 撤销:删 label + `gh pr merge --disable-auto <PR_URL>`

## 各 CI 门禁的角色

| Workflow | 触发 | 做什么 | 阻断 PR? |
|---|---|---|---|
| **pr-gate** | PR → main / push main / 手动 | 单 job 跑 lint + typecheck + i18n + api-drift + unit + build + audit | ✓ |
| **full-ci-gate** | PR → main / push main / 每周一 02:00 UTC / 手动 | PR 上执行范围适配的回归与审计；Docker build/Trivy/Lighthouse 仅在非 PR 事件运行。**main 守底** | — |
| **staging-gate** | tag `v*` push + 手动 | 对真 staging URL 跑 Playwright 真环境 e2e + Lighthouse | — |
| **prepare-platform-release** | 后端仓库手动触发 | 创建两仓同版本 Release PR；不打 tag、不发布 | 需配置 GitHub App |
| **renovate** | Renovate 计划 | 自动开依赖升级 PR(类 Dependabot) | — |

### 一句话用法

| 想看 | 看哪个 |
|---|---|
| 我的 PR 能不能合 | **pr-gate** ✓ |
| main 现在坏没坏 | **full-ci-gate** 最新一次 |
| 这次 release 能不能上 | **staging-gate**(tag 后)|
| 我开了 PR 怎么自动合 | 贴 `automerge` 标签；是否可合并以当前远端保护与本次授权为准|

完整 CI 设计细节 → [`ci.md`](ci.md)。

## 远端保护与权限

仓库内 workflow 只能证明配置，不能证明 GitHub 当前分支保护、reviewer 数量、协作者或 auto-merge 设置。需要提交/合并时按 `git-pr-workflow` 查询当前远端状态，记录必需检查和授权。文档不固定个人账号清单，不将 admin 权限视为可绕过门禁的常规操作入口。

## 常见情况

**Q: 误在 main 上 commit 了(没 push)**
A: 先记录 HEAD 与工作区状态，保留当前提交和改动；建立本次短期分支后再核对基线。已有提交的搬移按 `git-pr-workflow` 明确目标，避免在未知脏工作区直接 reset/stash。

**Q: PR 跟 main 漂了 conflict**
A: `gh pr update-branch <PR#>` → 解 conflict → push。

**Q: 想撤回已 merge 的 PR**
A: `gh pr revert <PR#>` 自动开 revert PR,正常 merge 流程。

**Q: BE OpenAPI 变了 PR `gen:api:check` 挂**
A: 拉 BE 最新 → 本地 `npm run gen:api` → commit `src/types/api.generated.ts` → push。

## 相关文档

- CI 流水线:[`docs/runbook/ci.md`](ci.md)
- Agent 指南:[`AGENTS.md`](../../AGENTS.md)
- 配对后端开发流程：[后端本地开发手册](../../../file-batch-system/docs/runbook/local-development.md)
