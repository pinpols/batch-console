---
name: frontend-api-contract
description: 修改或审查前端 API 调用、OpenAPI 生成类型、后端 Console 契约、权限/认证 payload、错误映射和接口漂移时使用。以后端 OpenAPI 与 Controller 为权威。
---

# 前端 API 契约治理

## 权威来源

- 配对后端仓库是 `../file-batch-system`；Console API 权威来自后端 Controller、DTO、权限配置和 `docs/api/console-api.openapi.yaml`。
- `src/types/api.generated.ts` 只能由 `npm run gen:api` 生成，禁止手改。
- 前端请求统一走 `src/api/client.ts` 和 `src/api/*.ts` 封装，组件内不要直接创建 axios 实例或拼接裸请求。

## 变更流程

1. 先到后端确认接口路径、方法、请求/响应、错误码、租户和权限语义，不凭前端现状反推契约。
2. 后端 OpenAPI 变化后运行 `npm run gen:api`，再调整 `src/api`、页面、store、fixture 和测试。
3. 认证、租户、权限、菜单显隐和导航变化要同时检查 `src/stores`、`src/router`、`src/constants/navigation.ts` 和相关页面。
4. 错误展示要依据后端错误契约，避免把业务错误裸展示为通用 500 或吞掉可操作信息。

## 验证

- API 类型同步至少运行 `npm run gen:api:check`；涉及类型使用时运行 `npm run typecheck`。
- 用户路径变化按范围补 Vitest 或 Playwright；未跑 paired backend 联调时明确说明。
- 报告中区分“OpenAPI 已同步”“前端类型已生成”“真实后端联调已验证”。

## 契约工具与来源记录

- `scripts/gen-api-types.sh` 写生成类型，`scripts/check-api-drift.sh` 在临时目录重生成并比较。通过 `BE_OPENAPI_PATH` 选择当前配对工作树契约，或显式 `BE_OPENAPI_URL` 下载。漂移检查器在缺源、下载或工具链失败时返回 2；生成脚本按自身及下载/生成工具的真实退出码失败，均不能记为通过或跳过。
- CI 的 `scripts/ci/resolve-backend-openapi.sh` 可选择 `BACKEND_API_REF` 或覆盖 URL；配对分支 404 时会回退 main，记录实际采用来源，不能把 main 契约结果当指定 WDI 分支结果。
- 认证相关脚本也遵守当前 HttpOnly Cookie/CSRF 契约；历史响应体 token、Bearer 与旧路径仅是归档证据。当前 storageState 与角色准备由 `e2e/global-setup.cjs` 负责；脚本归属见 `docs/engineering/script-skill-routing.md`。
