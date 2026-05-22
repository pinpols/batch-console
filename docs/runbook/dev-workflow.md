# 开发工作流(dev workflow)

本仓采用 **GitHub Flow 简化版**:只 `main` 一个长期分支,所有工作走短命子分支 + PR + merge 后自动删。

> 与配对后端 `file-batch-system` 一致策略,详见 [`../../file-batch-system/docs/runbook/dev-workflow.md`](../../../file-batch-system/docs/runbook/dev-workflow.md)。

## 分支策略

| 分支 | 命名 | 用途 |
|---|---|---|
| `main` | `main` | 唯一长期分支、生产代码、protected |
| 功能 | `feature/<topic>` | 新功能(如 `feature/dashboard-realtime`)|
| 修复 | `fix/<topic>` | bug 修复 |
| 杂项 | `chore/<topic>` | 重构 / 依赖升级 / CI 改动 |
| 文档 | `docs/<topic>` | 仅文档改动 |
| 紧急 | `hotfix/<topic>` | 生产 P0 bug |
| Renovate / Release-please | 机器人前缀 | 别动 |

## 日常开发

```bash
# 1. 同步 main
git checkout main && git pull

# 2. 开短命分支
git checkout -b feature/dashboard-realtime main

# 3. 改代码 + commit(无 emoji,信息说"为什么")
git add . && git commit -m "feat(dashboard): 实时刷新 job 监控面板"

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

详见 [`CLAUDE.md`](../../CLAUDE.md) 「后端 OpenAPI 同步」。

## 提交前自检

```bash
npm run typecheck      # vue-tsc
npm run lint           # eslint
npm run test:unit      # vitest
npm run check:i18n     # zh/en 词条对齐
npm run build:fast     # vite build
```

## Hotfix(生产 P0)

```bash
git checkout main && git pull
git checkout -b hotfix/login-redirect-loop main
# 改代码 + commit + push + PR
# merge 后立即 tag:
git checkout main && git pull
git tag v1.2.4 && git push origin v1.2.4
```

tag `v*` push → staging-gate 自动跑 Playwright 真环境 e2e。

## Release(无 release 分支)

```bash
git checkout main && git pull
git tag v1.3.0 && git push origin v1.3.0
# release-please 自动出 changelog PR
```

## Label automerge

打 `automerge` 标签 → 等 required check 绿了自动 squash merge。
- ❌ 不自动 approve(reviewer approval 仍是 gate)
- ❌ 不跳 check
- 撤销:删 label + `gh pr merge --disable-auto <PR_URL>`

## 各 CI 门禁的角色

| Workflow | 触发 | 做什么 | 阻断 PR? |
|---|---|---|---|
| **pr-gate** ~1.5min | PR open/sync + 非 main push | 单 job 跑 lint + typecheck + i18n + api-drift + unit + build + audit | ✓ |
| **full-ci-gate** ~3.7min | push main + nightly cron + 手动 | pr-gate 全套 + Docker build + Trivy + Lighthouse + 完整 npm audit。**main 守底** | — |
| **staging-gate** | tag `v*` push + 手动 | 对真 staging URL 跑 Playwright 真环境 e2e + Lighthouse | — |
| **release-please** ~2min | push main | 出 changelog PR + 自动准备 GitHub Release(tag + release notes)| — |
| **renovate** | Renovate 计划 | 自动开依赖升级 PR(类 Dependabot) | — |

### 一句话用法

| 想看 | 看哪个 |
|---|---|
| 我的 PR 能不能合 | **pr-gate** ✓ |
| main 现在坏没坏 | **full-ci-gate** 最新一次 |
| 这次 release 能不能上 | **staging-gate**(tag 后)|
| 我开了 PR 怎么自动合 | 贴 `automerge` 标签(本仓 0 reviewer,CI 绿了直接合)|

完整 CI 设计细节 → [`ci.md`](ci.md)。

## main 分支保护

| 项 | 值 |
|---|---|
| Required PR | ✓ |
| Required reviewers | 0(温和,可自审 self-merge) |
| Required status checks | `pr-gate` |
| Strict | ✓ |
| Enforce admins | ❌(admin 可 override 紧急 hotfix) |
| Force push / 删除 | ❌ 禁 |
| Auto-merge | ✓ |
| Delete branch on merge | ✓ |

## 谁能提代码 / 权限模型

仓库是 **public**,但 push 权限只给 collaborator。任何人能 fork + cross-repo PR,但**直接 push 到仓内分支必须授权**。

### 当前权限盘点

| 设置 | 值 | 含义 |
|---|---|---|
| 可见性 | `public` | 任何人能 clone / fork / 开 cross-repo PR |
| Collaborators | 只 `pinpols`(admin) | 只 owner 能直接 push 到仓内分支 |
| Push main | branch protection 禁直接 push | 必须走 PR,**任何人**(含 admin)都不能直接 push main |
| Merge PR | write 权限以上 | 路人能开 PR,但 merge 是仓内 collaborator 点 |

### 谁能"提代码"

| 角色 | 能做什么 | 需要授权? |
|---|---|---|
| owner(`pinpols`) | clone / `git push origin feature/xxx` / 开 PR / merge | 已是 admin |
| 路人(任何 GH 用户) | fork → 自己 fork 改 → 开 **cross-repo PR** | ❌ public 仓自带 |
| 想让 ta 在仓内直接开分支 | clone / `git push origin feature/xxx` | ✓ 加 collaborator |

### 加协作者

```bash
# permission 等级:pull(只读) / triage(管 issue) / push(读写) / maintain(管 release) / admin
gh api repos/pinpols/batch-console/collaborators/<username> \
  -X PUT -f permission=push
```

被邀请方在 GitHub 邮件 / 通知里 accept 后生效。

### 撤销

```bash
gh api -X DELETE repos/pinpols/batch-console/collaborators/<username>
```

## 常见情况

**Q: 误在 main 上 commit 了(没 push)**
A: `git reset --soft HEAD~1` → `git stash` → `git checkout -b feature/xxx` → `git stash pop`。

**Q: PR 跟 main 漂了 conflict**
A: `gh pr update-branch <PR#>` → 解 conflict → push。

**Q: 想撤回已 merge 的 PR**
A: `gh pr revert <PR#>` 自动开 revert PR,正常 merge 流程。

**Q: BE OpenAPI 变了 PR `gen:api:check` 挂**
A: 拉 BE 最新 → 本地 `npm run gen:api` → commit `src/types/api.generated.ts` → push。

## 相关文档

- CI 流水线:[`docs/runbook/ci.md`](ci.md)
- Agent 指南:[`CLAUDE.md`](../../CLAUDE.md)
- 配对后端开发流程:[`../../file-batch-system/docs/runbook/dev-workflow.md`](../../../file-batch-system/docs/runbook/dev-workflow.md)
