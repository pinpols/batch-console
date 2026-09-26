---
name: frontend-import-template-governance
description: 修改或审查租户配置包、Excel/模板导入导出、多 sheet 表单、下拉校验、导入向导和前后端测试数据时使用。以后端模板 schema 为权威。
---

# 导入模板与配置包治理

## 契约来源

- 配置包 Excel 的 sheet、列、必填、默认值、枚举和校验规则以后端 `ConfigPackageExcelSchema`、导入 validator、writer 和 OpenAPI 为准。
- 前端负责让用户好填、少错、能理解错误；不能用前端临时规则覆盖后端真实校验。
- 一次性导入多个场景时，保留多 sheet/多域能力，同时提供清晰分组和最小必填说明。

## 用户友好性

- 导入向导要说明每个 sheet 的用途、是否必填、默认值、示例、枚举来源和常见错误。
- 支持下载后端生成模板，不手工维护一份可能漂移的前端模板。
- 对 Excel 友好的下拉、软链接、列宽、示例行、错误定位和 dry-run 反馈要与后端返回结构一致。
- 错误展示要能定位 sheet、行、列、字段和原因，并给出可操作修正建议。

## 同步范围

1. `TenantPackageImportWizard.vue`、导入 composable、Excel 工具和相关 locale。
2. 前端 fixture、mock、Playwright/Vitest 数据和文档截图/说明。
3. 后端 schema、OpenAPI、导出模板和错误码变化。

## 验证

- 运行 `npm run gen:api:check`、`npm run check:i18n` 和相关导入测试；涉及 UI 流程时跑对应 Playwright。
- 未跑真实后端导入时，要明确只验证了前端渲染/fixture。
