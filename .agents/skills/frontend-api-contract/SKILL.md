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
