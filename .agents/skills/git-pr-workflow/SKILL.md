---
name: git-pr-workflow
description: 用户要求创建前端分支、提交或审查 Pull Request、连续交付 stacked PR、合并 PR 或清理分支时使用。重点核实交付链基线、远端 head、适用前端门禁和合并后的差异收口；不隐含合并或删除未交付分支的授权。
---

# Git 与 Pull Request 流程

## 基本边界

- 仓库 `AGENTS.md`、当前 CI、配对后端契约和用户明确范围优先；本 skill 不替代 API、测试、部署或文档专项 skill。
- 不覆盖、暂存或提交无关改动。创建 PR、合并 PR、删除分支是不同的状态变更；“提交 PR”不等于获准合并。
- 运行中、跳过或未触发的检查不算通过。PR 页面绿色也不能替代对实际 head、base、diff 和 required checks 的核实。

## 交付链基线

1. 创建分支或 PR 前，查询当前任务或明确连续交付链中最新的未合并 PR，并记录 `headRefName`、`headRefOid`、`baseRefName` 和 `state`。可使用：

   ```bash
   gh pr list --state open --json number,title,headRefName,headRefOid,baseRefName,state,url
   gh pr view <pr> --json headRefName,headRefOid,baseRefName,state,isDraft,mergeable,url
   ```

2. “最新 PR”只按任务、变更范围、前置关系或用户明确指向判断。更新时间更晚、编号更大但与当前任务无关的 PR 不得作为分支基线。没有同链未合并 PR 时，从 fetch 后核实的目标分支创建短期分支。
3. 上一张同链 PR 尚未合并时，新分支从其已核实的 `headRefOid` 派生，新 PR 的 base 指向其 `headRefName`，形成 stacked PR。PR 描述必须写明前置 PR、依赖关系和建议合并顺序。
4. 推送或创建 stacked PR 前，重新查询前置 PR 的远端 `headRefOid`。若 OID 已变化，先将新分支同步到新的 head，再审查提交列表和完整 diff；不得继续基于旧 head 推送，造成前置修复遗漏或重复提交。
5. 同步前置 head 时保留语义：检查双方提交与文件差异，按实际拓扑选择 merge 或受控 rebase。已推送分支需要改写历史时，不擅自强推；只有确认远端归属、无他人后续提交且用户授权后，才使用 `--force-with-lease`。

## Stacked PR 收口

1. 前置 PR 合入目标分支后，fetch 最新目标分支，核对前置 PR 的 `state=MERGED`、merge commit 和目标分支包含关系，再将后续 PR 的 base 改回目标分支。
2. 基于前置分支创建的后续分支可能仍携带前置提交。通过受控 rebase、`rebase --onto` 或等价的提交转移方式只保留本 PR 自身提交；处理前记录分支和远端 OID，保留可恢复引用。
3. 使用 `gh pr diff <pr>`、提交列表和本地目标分支比较，确认平台显示的 diff 只包含当前 PR 自身变更。不能只因 base 已修改就认定差异已收口。
4. 出现冲突时先理解两侧业务语义和前置修复，逐文件合并并重新执行适用门禁；不得用机械选边覆盖任一侧改动。
5. 用户要求将多处本地改动汇总到一张后续 PR 时，先核实补丁是否已在目标分支或前置 PR 中等价存在。只转移真正未交付的提交或文件，原 worktree 保留到汇总 PR 创建、远端 head 核实且 diff 确认完成。

## 前端实现与验证

1. 开工前检查仓库根目录、remote、当前分支、worktree、暂存区、未完成的 merge/rebase 和完整 diff。保留已有本地改动；无法隔离时创建独立 worktree。
2. 按改动范围加载专项 skill。API 变更以后端 OpenAPI 为权威；文档、部署、UI、状态流和 CI 分别遵循对应前端 skill。
3. 提交前逐文件暂存并审查 `git diff --cached --check` 和 `git diff --cached`。运行 `npm run preflight:changed`；再按风险补充 typecheck、lint、i18n、单测、构建、API drift、文档构建或真实后端验收。
4. 推送前复核本分支相对实际 PR base 的提交和 diff。stacked PR 不使用 `main...HEAD` 代替真实 base；应与记录的前置 head 比较。
5. PR 描述记录目的、影响范围、前置 PR、建议合并顺序、已执行验证、未执行项和残余风险。创建后再次核实平台上的 head/base/OID 和 required checks。

## 合并与清理

1. 只有用户明确要求合并，且 required checks、review 和分支保护均满足时才合并。合并操作返回后仍需核实 `state=MERGED` 及目标分支包含关系。
2. 清理前确认远端分支仍指向已记录的 `headRefOid`，检查所有 worktree，并确保没有未交付提交。只清理用户授权且已核实合并的分支。
3. stacked PR 按前置顺序逐张收口。前置合并后先调整后续 PR base 和 diff，再决定是否合并或清理；不得因前置已合并而连带删除后续分支。
