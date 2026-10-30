# 历史 Git 同步脚本

这些脚本保留旧分支模型的原始实现，已于 2026-10-25 退役，不属于当前开发或交付入口。脚本中的 `feature/fe-bugfixed`、`feature/docker-deploy`、自动同步/推送和部署机约定不再适用；不要执行或复制其中的操作流程。

| 历史文件 | Git 来源 | 退役原因 |
|---|---|---|
| `sync-main-2026-05-24.sh` | 初次加入：2026-05-24，`693f665` | 向已取消的常驻部署分支合并 main，还引用已不存在的部署脚本。 |
| `sync-from-main-2026-05-24.sh` | 初次加入：2026-05-24，`4dec95f` | 对固定长期功能/部署分支批量同步，与当前 main 加短期分支流程冲突。 |

当前分支与交付规则见 [AGENTS.md](../../AGENTS.md)、[开发流程](../../docs/runbook/dev-workflow.md)及 [`git-pr-workflow`](../../.agents/skills/git-pr-workflow/SKILL.md)。分支、工作树与 PR 的实际状态应在操作前重新核对。
