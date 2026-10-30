# 人工文件上传与文件组 Workflow 联动

## 之前完成的普通上传实测

WDI 真实认证环境中的普通上传 Chromium E2E 曾通过 1/1、0 重试。ADMIN 在文件列表上传唯一 CSV 至 MinIO，确认到达后从真实 Console 列表读回。

- 原始内容 37 字节；独立从 MinIO 读取的对象字节与原文一致，确认接口回写 `file_size_bytes=37`。
- 文件持久状态为 `RECEIVED`，页面在列表读回后才显示成功。
- `UPLOAD_SESSION_CREATED` 与 `CONFIRM_ARRIVAL` 两条审计均为 `SUCCESS`。
- TENANT_ADMIN 页面显示上传入口；AUDITOR/TENANT_USER 入口隐藏且上传会话 API 返回 403。
- 当时对象、文件行、审计、通道和临时账号均精确清理为 0。该证据只覆盖普通上传，不证明文件组绑定或下游 Workflow。

旧版实测证据：[脱敏 JSON](./assets/manual-file-upload-2026-10-26/real-evidence.json)。

## 当前实现

当前 WDI 源码已扩展为可选的文件组绑定上传，同时保留原普通上传参数兼容：

- `GET /api/console/files/manual-upload-targets` 按租户返回唯一启用的文件组与 Workflow 目标。
- `POST /api/console/files/presign-upload` 可接收业务日、文件组、必需文件名集合及 IMPORT 模板。Console 校验模板租户和类型；Orchestrator 再校验目标绑定，并把 `fileGroupCode`、`bizDate`、`requiredFileSet`、`bundleWorkflowCode` 和模板写入托管文件记录。
- 文件列表上传抽屉在同一页面提供目标、业务日、必需文件、模板选择及普通上传。重复文件名、无效绑定、目标变更和租户变化均由界面或服务端校验。
- 文件组扫描只把包含 `arrivalConfirmedAt` 的 APP_MANAGED 文件作为已到达成员，避免上传会话占位行在内容确认前触发 Workflow。
- [真实验收用例](../../e2e/manual-file-upload-real.spec.ts) 覆盖：对象内容已真实写入后跨过一次 30 秒扫描周期，确认前断言 Workflow 运行数为 0；随后由页面正常确认到达，断言绑定文件触发唯一 Workflow 并成功结束，同时核对对象字节、业务日、元数据、审计、角色和精确清理。

## 当前源码验证

- 前端：`npm run typecheck` 通过；上传 API 单测 5/5；`npm run check:i18n` 通过，6,131 个中英文 key 对齐；`npm run gen:api:check` 通过；E2E/API/上传页面定向 Prettier 检查通过。
- 后端：Orchestrator 和 Console API reactor 编译通过；Orchestrator 上传目标、治理服务及 Mapper SQL 契约测试 45/45；Console 文件服务和控制器测试 10/10；本次 Java 文件定向 Spotless 通过。
- 最终真实联验于 2026-10-26 使用当前 WDI 前后端工作区和独立 Console 18181、Orchestrator 18182、Vite 5181、PostgreSQL 与 MinIO 完成；共享 18080/18082 未重启或改配。真实认证 Chromium 1/1、0 重试。37 字节 CSV 在确认前已存在 MinIO，35 秒扫描窗口内 Workflow 数为 0；页面确认后，数据库回读 `file_size_bytes=37`、文件状态 `RECEIVED`、两条成功审计，并关联唯一 `SUCCESS` Workflow。租户管理员上传入口可见；AUDITOR/TENANT_USER 入口隐藏且接口返回 403。匿名 POST 返回 403 是 CSRF 过滤结果，不作为认证状态证据。
- E2E 清理附件中的文件、审计、通道、目标、模板、Workflow/节点/运行、触发及事件记录、账号计数均为 0；对象按隔离 namespace 精确删除。两份任务创建的隔离数据库随后移除。脱敏详情见[文件组绑定验收证据](./assets/manual-file-upload-2026-10-26/file-group-binding-evidence.json)。
- 首轮失败是验收夹具问题：隔离部署会给对象键加 namespace，旧夹具按逻辑键读删；随后发现确认 POST 在浏览器侧暂停超过前端 30 秒超时，修正为对象写入后延迟 PUT 响应；最后补齐夹具终态轮询的 `expect` 导入。最终运行通过，不需要修改上传业务 API。

## 尚待真实验收

G12 的文件组绑定上传及下游 Workflow 触发已通过真实验收。该夹具的 Workflow 是 START→END 控制图，只证明文件束触发与运行终态；真实 Worker、IMPORT Pipeline 阶段进度、故障恢复仍属于 P01/P02 验收范围。

进度图表仍放在现有运维总览的租户日统计、作业详情的阶段/分区/任务进度、Workflow 详情的冻结 DAG、Pipeline 观测页，不新增重复看板。
