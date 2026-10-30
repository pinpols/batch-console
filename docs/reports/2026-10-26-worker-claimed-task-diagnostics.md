# Worker 认领任务诊断真实联调

日期：2026-10-26<br>
基线：前后端 `fix/wdi-current`，FE `662d254e2f8b97f93021de548815470d2291c997`，BE `f3d5e400d3b5bd737124b57cf0a38e685432aab2`

## 范围与结果

Worker 管理抽屉展示当前租户内由该 Worker 认领的任务安全摘要；平台诊断的终态子任务查询按管理员角色控制。Orchestrator 和 Console 的认领任务响应均使用明确白名单，只包含12个任务元数据字段，不返回租户ID、任务载荷、有效执行参数、心跳详情、结果摘要或错误正文。OpenAPI 与前端生成类型已同步。

## 验证

- 后端定向测试通过：`ClaimedTaskSummaryResponseTest`、`ConsoleWorkerClaimedTaskResponseTest` 与 `ControllerEntityBoundaryBehaviorTest` 共6项。
- 前端 `typecheck`、`gen:api:check`、相关文件 ESLint 与 Prettier 检查通过。
- 使用临时 WDI Console 18181、Vite 5181 和当前 Atomic Worker JAR，连接既有 WDI Orchestrator 18082 完成真实认证 Chromium 验收，1/1通过。共享 Console/Orchestrator 未重启或改配。
- 匿名 `/auth/me` 返回401；ADMIN读取认领任务返回200；TENANT_ADMIN读取本租户返回200、跨租户返回403；平台终态子任务诊断ADMIN返回200、TENANT_ADMIN返回403。
- Atomic Worker 实际执行任务后，认领列表返回1条 `RUNNING` 摘要，Worker 管理抽屉显示1行。真实响应字段为 `assignedWorkerCode`、`createdAt`、`errorCode`、`finishedAt`、`id`、`jobInstanceId`、`jobPartitionId`、`startedAt`、`taskSeq`、`taskStatus`、`taskType`、`updatedAt`。敏感字段缺席清单见[脱敏实测证据](./assets/worker-claimed-task-diagnostics-2026-10-26/real-evidence.json)。
- 首次夹具使用35秒SQL，超过Atomic SQL执行器30秒语句超时；该轮正确暴露了夹具超时，清理计数为0。将SQL缩短为24秒后重新执行，Chromium 1/1通过、0重试。
- 验收后独立核对临时租户、Worker、Job、活跃任务计数均为0。

## 验收边界

该结果关闭能力矩阵G10的本地真实联调。它证明当前WDI代码、真实Worker和本地认证Console之间的角色、租户隔离及安全响应边界；不等同于生产发布验收。
