# AGENTS.md

## 配对后端仓库

前后端联调时，后端代码位于相对路径：

```
../file-batch-system
```

绝对路径示例：`/Users/dengchao/Downloads/file-batch-system`

### 关键子模块

- `../file-batch-system/batch-console-api` —— 给本前端项目提供的 Console REST API（Spring Boot）
- `../file-batch-system/batch-orchestrator` —— 调度/编排服务
- `../file-batch-system/batch-worker-*` —— 各 worker 模块
- `../file-batch-system/db` —— 数据库 schema / 迁移脚本
- `../file-batch-system/CLAUDE.md` —— 后端仓库的 Agent 指南（优先阅读）

### 接入约定

- 前端 `src/types/api.generated.ts` 由后端 OpenAPI 生成，调整接口时应先在后端改动并重新生成。
- 认证相关接口在 `../file-batch-system/batch-console-api` 下查找（`/api/console/auth/*`）。
- 联调时若需要验证后端行为，直接去 `../file-batch-system` 中搜控制器 / DTO / 权限配置，而不是凭空假设。

### 前端通用规则

- **切换租户重取**：任何依赖 `tenant.tenantId` 的视图，统一用 `useTenantReload(loadFn)`（`src/composables/useTenantReload.ts`），不要再手写 `onMounted + watch(tenant.tenantId)` 组合。TanStack Query 场景把 `tenant.tenantId` 写进 `queryKey` 即可，无需该组合式。
- **XSS 兜底**：原生 `v-html` 已被 ESLint 禁用（`vue/no-v-html: error`）。任何需要以 HTML 渲染的字符串，使用 `v-safe-html="content"` 指令（内部走 DOMPurify）；手动 `innerHTML = ...` 场景请先经 `purifyHtml()`（`src/utils/safeHtml.ts`）。**不信任后端是否已转义**——前端独立过滤。
