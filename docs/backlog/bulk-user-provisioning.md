# 批量账号开户前端待办

> 状态：缺口 / P1
> 后端前置：正式 Bulk User Provisioning Preview / Apply API 与 OpenAPI 契约。

当前账号管理支持单账号创建、编辑、启停和重置密码；批量租户 Provisioning 已存在，但前端缺少批量账号开户流程。

## 待办

- [ ] 账号管理页增加“批量开户”入口，仅对后端授权的开户角色展示。
- [ ] 提供 Excel/CSV 模板下载或结构化批量录入；字段至少覆盖 username、displayName、role、tenantId。
- [ ] 平台角色 ADMIN / AUDITOR 的租户语义按后端契约显示为 system，不要求选择业务租户。
- [ ] TENANT_ADMIN / TENANT_USER 必须选择实际业务租户；TENANT_ADMIN 登录时租户固定为当前 principal tenant，不允许跨租户编辑。
- [ ] 上传后先 Preview，不直接 Apply；展示格式错误、无效租户、角色越权、username 存量冲突、批次内重复等逐行问题。
- [ ] 支持错误行修正后重新预检，交互尽量复用现有 Excel preview / patch / apply 模式。
- [ ] Apply 前展示创建数量、租户分布、角色分布和高权限账号确认信息。
- [ ] 展示逐行成功/失败结果与 batchOperationId，并支持失败项重新提交。
- [ ] 不在浏览器、日志或可长期保存的导入文件中持久化明文密码；初始凭据展示/下载方式以后端安全契约为准。
- [ ] 明确 mustChangePassword 首次登录提示，并补充批量开户后的登录体验。
- [ ] 重新生成 OpenAPI TypeScript 类型，不手写重复 DTO。
- [ ] 补单测和 Playwright：平台账号、本租户账号、跨租户拒绝、重复 username、无效 tenant、部分失败/重试等场景。

## 权限与租户模型

    system
    ├── ROLE_ADMIN
    └── ROLE_AUDITOR

    tenant-a
    ├── ROLE_TENANT_ADMIN
    └── ROLE_TENANT_USER

前端只负责表达和预览，最终 tenant scope、角色授予和账号创建规则以后端为权威，不能仅依赖 UI 禁用实现安全边界。
