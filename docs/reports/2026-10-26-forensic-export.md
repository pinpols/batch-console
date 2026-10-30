# G09 取证导出真实联调

## 基线与隔离

- 前后端工作树均为 `fix/wdi-current`；前端 HEAD `662d254e2f8b97f93021de548815470d2291c997`，后端 HEAD `f3d5e400d3b5bd737124b57cf0a38e685432aab2`。
- 浏览器使用 WDI 前端 Vite `5181`，API 经临时 Console `18181`。Console 使用当前 WDI `console.jar`，启用真实认证、关闭本地绕过，并关闭 Kafka listener、Webhook relay 与 Push poller。
- 临时 Console 将唯一导出请求转发到现有 WDI Orchestrator `18082`；没有重启或修改该服务。PostgreSQL 与默认私有临时存储路径沿用当前本地 WDI 环境。
- 本例使用随机租户和随机账号；报告及机器证据不保留租户、账号、导出 ID、存储路径、凭据或 Cookie。
- 隔离预检曾短暂启动第二份 Orchestrator `18182`；发现它加入默认 Kafka trigger consumer group 后，立即按记录 PID/JAR 停止。只读核对该时间窗新增的 Job、Workflow、Trigger 请求记录分别为 0，原 `18082` 健康检查为 200。最终验收没有启动第二份 Orchestrator。

## 验收结果

`npm run test:e2e:forensic:real` 的真实 Chromium 用例 **1/1 通过，0 重试**。

- 匿名 `/auth/me` 返回 401；TENANT_ADMIN 导出返回 403；ADMIN 在 OpsDiagnostic 页面完成二次确认并导出。
- PostgreSQL 中的导出元数据与当前租户、单日范围、状态、操作者、文件大小及 SHA-256 相符。
- 浏览器下载文件的 SHA-256 与 Console 返回值及数据库记录相同。ZIP 含 `job-instances.json`、`batch-day-operation-audits.json`、`manifest.json`；Manifest 的日期、操作者、行数与数据库一致。
- 页面显示导出状态、大小和摘要，不渲染后端存储路径。
- 清理精确删除 1 条本例导出日志和 1 个对应 ZIP；父夹具中账号、租户、日历、作业及审计等残留计数全部为 0。

脱敏机器证据：[real-evidence.json](assets/forensic-export-2026-10-26/real-evidence.json)。

## 验收边界

本次验证本地真实认证、导出持久化、下载完整性、ZIP结构与权限边界。测试范围是一个日期的空数据包，两个数据 JSON 数组均为空；这不证明非空 Job/批次日数据的筛选结果，也不覆盖 31 天上限、最大行数、并发导出或生产对象存储。

初次运行发现当前 18080 本地 Console 的匿名 `/auth/me` 返回 200，未满足真实认证条件，未写入夹具；后续通过临时 Console 独立启用认证。第一次实际导出后的失败是夹具把未来业务日误用于 UI 今日日期断言，失败时导出日志、ZIP 与父夹具均已清零。修正为界面实际提交的业务日期后，最终运行通过。
