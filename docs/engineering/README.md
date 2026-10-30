# 工程文档索引

长期规则和当前能力维护稳定入口；阶段方案保留原始基线日期和当前状态。历史执行数字及验证结论见日期记录。

## 协作、规则与资料维护

| 文档 | 用途 |
|---|---|
| [前端 Agent Skill 使用指南](./agent-skills-guide.md) | 选择、组合和验收 Agent Skill |
| [前端文档治理](./document-governance.md) | 文档职责、生命周期、日期与归档 |
| [前端脚本与 Skill 路由](./script-skill-routing.md) | 脚本角色、Skill 主责、全量盘点与操作边界 |
| [前端工程成熟度路线图](./engineering-maturity-roadmap.md) | 工程成熟度及目标环境缺口 |
| [前端约定与 CI 守卫周期复核](./convention-drift-review.md) | 约定、防退化与人工复核 |

## 当前前端能力与契约

| 文档 | 用途 |
|---|---|
| [Console AI 助手前端设计与验收边界](./ai-assistant-frontend.md) | AI 助手当前实现与契约 |
| [AI 对话流式交互](./ai-chat-streaming.md) | AI SSE、取消与保留边界 |
| [AI 图片对话与回答复制](./ai-image-conversation.md) | 图片消息当前行为与接口 |
| [Console 使用率统计](./console-usage-statistics.md) | 使用率页面、埋点和证据边界 |
| [Console 维护与降级](./maintenance-degradation.md) | 维护与降级当前行为及环境验收 |
| [控制台筛选下拉与后端元数据](./meta-enum-coverage.md) | 枚举注册表、前端消费与回退 |
| [日期时间契约](./datetime-contract.md) | 时间点、业务日期与展示时区 |
| [前端可观测性方案](./frontend-observability.md) | 浏览器观测、错误与关联边界 |

## 页面与代码约束

| 文档 | 用途 |
|---|---|
| [前端代码可读性治理](./code-readability-governance.md) | 嵌套调用、参数状态、事实源与抽象边界 |
| [前端注释语言治理](./comment-language-governance.md) | 中文说明、技术标识与注释守卫 |
| [字符编码治理](./encoding-governance.md) | UTF-8、外部文件与编码门禁 |
| [页面命名与导航归属约定](./page-naming-convention.md) | 业务域、路由、页面与导航映射 |
| [控制台交互约定](./ui-interaction-conventions.md) | 页面和交互约定 |
| [设计 Token 治理](./design-tokens.md) | 运行时设计 Token |
| [移动端数据刷新策略](./mobile-refresh-strategy.md) | 移动端刷新与共享状态 |
| [浏览器支持策略](./browser-support.md) | 浏览器支持边界 |

## 运行、依赖与发布输入

| 文档 | 用途 |
|---|---|
| [前端环境变量](./environment-variables.md) | 环境变量与运行时来源 |
| [前端运行时与依赖版本](./runtime-versions.md) | Node 等运行时版本来源 |
| [CI 依赖治理](./ci-dependency-governance.md) | 依赖、CI 与合规基线 |
| [统一文档站](./unified-documentation-site.md) | 统一文档站、构建与访问权限 |

## 仍在推进的阶段方案

| 文档 | 用途 |
|---|---|
| [作业与工作流联动、系统 Pipeline 前端实施方案](./workflow-job-pipeline-unification-plan-2026-10-14.md) | Workflow、作业与系统 Pipeline 联动的当前范围和验收边界 |
| [FE 手写 Wrapper 到 OpenAPI 类型迁移计划](./fe-wrapper-migration-plan-2026-06-02.md) | API 包装迁移状态与剩余范围 |

- [WDI 前后端能力补齐与真实联调实施计划](backend-capability-alignment-plan-2026-10-25.md)：17项功能、依赖图、运行DAG/步骤进度与租户今日总进度的实施及验收唯一矩阵。
