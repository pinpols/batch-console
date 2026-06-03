# QA 验证目录

集中存放各档(tier)QA campaign 的报告与配套补丁,与 `docs/runbook/` 的运维 SOP 分开维护。

## 目录结构

```
docs/qa/
├── README.md            ← 本索引
└── d-tier/              ← D 档 QA 完整覆盖(2026-05 闭环)
    ├── README.md        ← 总索引(P1-P5 + P5b 完整闭环)
    ├── phase1-*.md      ← API CRUD / 边界 / RBAC
    ├── phase2-*.md/tsv  ← UI 测试
    ├── phase3-journey.md
    ├── phase4-mobile-real-be.md
    ├── phase5-*.md      ← API 全覆盖 + 终结报告
    ├── phase5b-replication-fix.md
    ├── phase6-business-flows.md
    └── be-patches/      ← 配套 BE 代码补丁(供 BE 同事 apply)
```

## QA tier 体系

- **C 档基线**:`docs/runbook/fe-qa-c-tier-plan.md` / `report.md`(及 `qa-c-baseline.md`)—— 仍在 runbook,日常 baseline 不归此目录
- **D 档完整**:本目录 `d-tier/`,4 维度(移动操作 / 多浏览器 / 上传链路 / 长会话)+ API + UI + RBAC 6 阶段
- **C/D 顶层计划与报告**:`docs/runbook/fe-qa-{c,d}-tier-{plan,report}.md`(轻量入口)
- **联调计划/报告**:`docs/runbook/fe-be-joint-test-plan.md` 及 `fe-be-joint-test-report*.md`

> 2026-06-03 把 `docs/runbook/qa-d-phase-reports/` 移至 `docs/qa/d-tier/`,因为这堆 D 档阶段细节属于"QA 资产",不是"运维 SOP"。`docs/runbook/` 保留与运维 / CI / 应急响应直接相关的文档。

## 与其他目录的分工

| 目录 | 用途 |
|---|---|
| `docs/qa/`(本目录) | QA campaign 阶段细节 + 配套补丁 |
| [`../runbook/`](../runbook/) | 运维 SOP / CI / 应急响应 + QA 顶层 plan/report |
| [`../reports/`](../reports/) | 项目阶段报告(不局限于 QA) |
| [`../design/`](../design/) | 长期权威设计文档 |

## 维护策略

- 新 tier campaign(如 E 档)→ 在本目录建 `<tier>-tier/` 子目录,内含 README + 各阶段细节
- 关闭的 tier(已完全归档)→ 移到 `archive/qa/<tier>/`(尚不存在,需要时创建)
- 顶层 plan/report 仍归 runbook(轻量入口),细节归 qa/(深度证据)
