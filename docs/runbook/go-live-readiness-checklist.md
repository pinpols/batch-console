# 前端上线准入清单

本文是 `batch-console` 发布前的准入矩阵。它补充 [`release-promotion.md`](./release-promotion.md) 和 [`ci.md`](./ci.md):CI 能自动挡住确定性问题,但上线前仍需要确认真实环境、角色、权限和主要业务链路。

## 准入结论口径

| 结论 | 含义 |
|---|---|
| 通过 | 命令或真实环境验收完成,证据可复查 |
| 阻断 | 影响登录、权限、主链路、数据安全、发布回滚或生产可观测性 |
| 可带风险 | 有明确影响范围、回滚路径和 owner,不影响主链路 |
| 未验证 | 当前没有证据,不得写成通过 |

## 1. PR 快门禁

| 项目 | 命令 / 入口 | 阻断条件 |
|---|---|---|
| 类型检查 | `npm run typecheck` | TS / Vue 类型错误 |
| ESLint | `npm run lint:check` | 规则错误或自动修复未提交 |
| i18n | `npm run check:i18n` | zh-CN / en-US key 不一致 |
| API 漂移 | `npm run gen:api:check` | 生成类型与后端 OpenAPI 不一致 |
| 单测 | `npm run test:unit` | 业务逻辑或 API 映射失败 |
| 构建 | `npm run build` 或 CI 完整构建 | 产物无法生成 |
| 依赖安全 | `npm audit` / CI SBOM license gate | high/critical 或许可证红线未处理 |

## 2. 真实环境验收

| 场景 | 关注角色 | 验收点 |
|---|---|---|
| 登录与首次密码提示 | 全部角色 | 登录、语言切换、主题、必须改密提示不误阻断普通提示 |
| 租户切换 | ADMIN / AUDITOR | 菜单、查询、缓存和当前租户显示同步刷新 |
| 作业与流程配置 | ADMIN / TENANT_ADMIN | 作业、Workflow、Pipeline 的创建、编辑、校验、保存和权限拒绝 |
| 作业运行 | 全部角色按权限 | 状态段、日期筛选、TraceId 查询、重试 / 取消 / 详情 |
| 审批中心 | ADMIN / TENANT_ADMIN / AUDITOR | 批量审批、详情抽屉、只读角色不可审批 |
| 配置导入 / 同步 | ADMIN / TENANT_ADMIN | 模板下载、上传预览、差异、应用、失败提示和回滚说明 |
| 文件中心 | ADMIN / TENANT_ADMIN / TENANT_USER | 文件到达、渠道、模板、进度和空态 |
| Outbox / 告警 | ADMIN / AUDITOR | 过滤、实时监控条、TraceId、空态和路由规则入口 |
| 账号治理 | ADMIN / TENANT_ADMIN | 四角色边界、批量开户、重置密码、停用和审计提示 |
| 运维工具 | 全部角色按权限 | 时区、Cron、文件样本、重试时间线不越权修改业务状态 |

## 3. UI 与交互准入

| 检查项 | 标准 |
|---|---|
| 信息密度 | 筛选区不挤占列表主体,高级筛选默认可收起 |
| 视觉一致性 | 按钮、圆角、线距、边框、状态色和过渡遵守 design token |
| 空态 | 使用统一空态组件,含主文案、辅助文案和可选动作 |
| 降级 | 403、移动端不支持、维护中、下游降级均有明确页面或提示 |
| 危险操作 | 批量、删除、重放、重置、导入应用等操作有影响预览或二次确认 |
| TraceId | 错误提示可复制 TraceId,但不遮挡主体任务 |

## 4. 发布运行时

| 项目 | 标准 |
|---|---|
| 镜像 | 使用 `sha-*` 或 digest 晋级,不使用浮动 `latest` |
| 版本 | `/version.json` 的 `gitSha` 等于目标 commit |
| 健康 | `/healthz` 正常,Nginx 静态资源和 API 反代路径可访问 |
| 配置 | 环境变量登记完整,无本地专属默认值混入生产 |
| 回滚 | 已知上一稳定 digest,回滚步骤见 `rollback.md` |
| 日志 | 前端无 `console.log` 残留,运行时错误能进入观测链路 |

## 5. 证据留存

上线前报告至少包含:

- 目标 commit / 镜像 digest / 环境 URL。
- 自动门禁状态,区分 pass、pending、skipped 和 failed。
- 真实验收覆盖的角色、页面、核心流程和未覆盖项。
- 已知风险、owner、回滚动作和是否阻断。

不要把本地模拟接口、单个代表页面截图或历史验收记录写成当前全量通过。
