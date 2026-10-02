# 批量账号开户前端待办

> 状态：前后端已编码，待真实环境联测与安全审计验收。
> 后端契约：配对仓库 `file-batch-system/docs/api/console-api.openapi.yaml` 的 `/api/console/users/batch/**`。

当前账号管理支持单账号创建、编辑、启停和重置密码；批量租户 Provisioning 已存在，但前端缺少批量账号开户流程。

## 待办

- [x] 账号管理页增加“批量开户”入口。页面沿用已有管理员路由，后端再次授权。
- [x] 提供 XLSX 模板下载；字段覆盖 username、displayName、role、tenantId。CSV 不在第一版范围。
- [x] 平台角色 ADMIN / AUDITOR 的租户语义由后端校验为 system。
- [x] TENANT_ADMIN / TENANT_USER 绑定 ACTIVE 业务租户；TENANT_ADMIN 编辑租户字段禁用，后端固定为当前 principal tenant。
- [x] 上传后先 Preview，不直接 Apply；展示格式错误、无效租户、角色越权、username 存量冲突、批次内重复等逐行问题。
- [x] 支持行修正后重新预检。
- [x] Apply 前展示创建数量、涉及租户数和高权限账号数；详细分布暂未做。
- [x] 展示成功行一次性凭据与 operationId。Apply 全批原子，不存在部分成功；失败须修正后重新预览。
- [x] 初始密码仅在 Apply 回包展示，弹窗关闭清除内存状态；不写浏览器存储或下载文件。
- [x] 明确 mustChangePassword 目前只是提示，不是强制改密。
- [x] 重新生成 OpenAPI TypeScript 类型，API 客户端使用生成的批量 DTO。
- [x] API 单测与隔离 API 桩的 Playwright 页面 E2E 覆盖预览、行修正、Apply、一次性凭据清除及桌面/手机布局。
- [ ] 真实后端的 PG/Redis 端到端、并发和审计检索仍待验收；模拟响应的页面 E2E 不代表生产链路通过。

## 权限与租户模型

    system
    ├── ROLE_ADMIN
    └── ROLE_AUDITOR

    tenant-a
    ├── ROLE_TENANT_ADMIN
    └── ROLE_TENANT_USER

前端只负责表达和预览，最终 tenant scope、角色授予和账号创建规则以后端为权威，不能仅依赖 UI 禁用实现安全边界。
