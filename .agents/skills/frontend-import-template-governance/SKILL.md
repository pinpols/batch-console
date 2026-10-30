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

## 文件组人工入站上传

- 上传目标只能来自后端按当前租户返回的唯一启用文件组/Workflow 绑定；不要让用户自行填写 Workflow 编码或用前端缓存推断目标。
- 绑定上传必须同时传业务日、完整必需文件集合和本租户启用的 `IMPORT` 模板。普通上传继续走兼容路径；不能把 EXPORT/SHARED 模板当成导入绑定。
- 后端 OpenAPI 与 Controller 定义可选绑定请求体。文件组只有在内容已写入对象存储且到达确认后才参与完整性扫描；上传会话占位行不能触发下游 Workflow。
- 真实验收使用 `e2e/manual-file-upload-real.spec.ts` 和 `ManualFileUploadFixture`：检查确认前跨扫描周期无运行，确认后检查 Bundle Workflow 持久终态、对象字节、审计、角色与精确清理。START→END 夹具只证明触发，不证明 Worker/IMPORT Pipeline 处理成功。

## 验证

- 运行 `npm run gen:api:check`、`npm run check:i18n` 和相关导入测试；涉及 UI 流程时跑对应 Playwright。
- 未跑真实后端导入时，要明确只验证了前端渲染/fixture。

## Fixture 与数据脚本

- 当前配置包来源是配对后端 `test-data/tenant-config-packages/` 与后端 schema；前端 `e2e/global-setup.cjs` 负责上传、previewToken 校验与 apply，导出到测试目录的 XLSX 是派生物。
- `e2e-data/` 保留的 payload、XLSX 与样本是历史场景输入，复用前核对当前 schema、DTO 和独立预期。`verify-data.sh` 只读核对解析/事务标记，不证明接口或数据库兼容。
- `e2e-data/archive/` 的旧造数、认证、清理、SQL 与 Excel 生成脚本只作历史证据；不要执行，也不要用直接写库补造“真实业务成功”。当前数据准备/回收按测试 Skill 和真实环境授权执行。
- 新增脚本或 fixture 来源调整时同步 `docs/engineering/script-skill-routing.md` 的职责与调用方，保留契约断言的独立预期。
