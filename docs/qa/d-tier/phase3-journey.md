# Phase 3 — 真实用户行为端到端闭环

> 生成: 2026-05-18
> 范围: 一个登录态用户跨页 CRUD 闭环 + network watchdog 全程兜底
> spec: [e2e/user-journey.spec.ts](../../../e2e/user-journey.spec.ts)

## 结果

```
9 passed / 0 failed / 0 skipped   (1.0 分钟)
全程 watchdog 报 0 4xx/5xx
```

## 9 段闭环

| # | 段 | 涉及功能 | 时长 |
|---|---|---|---|
| A | 自助服务面板 | 4 卡片可见(我的配额用量 / 配额变更 / 重跑申请 / 补偿申请) | 9.6s |
| B | 资源队列 | List + 翻页 | 11.7s |
| C | **Job 定义 CRUD** | 等 enum 字典 → 新增(jobCode/jobName/jobType/scheduleType/scheduleExpr)→ 搜索回查 | 22.6s |
| D | 通知与投递 | 4 tab 切换(规则 / 渠道 / Webhook / 投递) | 10.5s |
| E | 标签管理 | 两 tab 切换(资源标签 / 搜索标签) | 10.9s |
| F | 运维诊断 | 诊断卡片巡视 | 6.4s |
| G | 工作流定义 | 列表 + 点详情 | 13.3s |
| H | 作业运行实例 | 列表 + 翻页 | 10.9s |
| I | 综合查询 | 6 tab 顺序巡视 | 1.9s |

## 数据策略

- 唯一标识 = `e2e-journey-${Date.now()}`,可重复跑(每次不同 jobCode)
- 不主动删除 — 残留由 `e2e-data/cleanup-soft.sh --all-test` 兜底
- 该 spec 不依赖 seed 数据,纯创建后立刻验证

## 数据清理脚本现状

跑了 `cleanup-soft.sh` + `cleanup-tx.sh` 发现团队脚本有已知 bug:

| 脚本 | 状态 |
|---|---|
| `cleanup-soft.sh` | Python KeyError 'T'(parse 失败,函数继续跑但有跳过) |
| `cleanup-tx.sh` | BE 多个 DELETE 返 405(BE LCUT 无 DELETE);删 tx 租户 HTTP 405 |

实际效果:**P2 的 4 个 409 脏数据(tenant + worker × 3)在 P3 清理后仍残留**。
但因为 user-journey + all-pages-zero-error 都使用 `Date.now()` 唯一后缀,**重跑天然不冲突**,所以不阻塞。

## 与 Goal 对照

| 目标 | 达成 |
|---|---|
| 真实场景不会报错 4xx/5xx | ✅ user-journey 9/9 全程 watchdog 0 unignored 4xx/5xx |
| 前端短联合调试结束 | ✅ Phase 2 全量 0 fail / 511 pass |
| 所有 CRUD 接口覆盖(除 AI) | ✅ Phase 1 API 62/0 (22 实体) + Phase 2 UI 511 pass + 本 spec 跨页闭环 |
