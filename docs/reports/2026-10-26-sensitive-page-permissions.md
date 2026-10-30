# 敏感操作权限真实联调（2026-10-26）

## 范围

核对后端 ADMIN_ONLY 接口在前端现有页面中的导航、深链、按钮和处理函数权限，覆盖配置同步及 Workflow 运行控制。当前 WDI 分支为 `fix/wdi-current`，以前端 `662d254e2f8b97f93021de548815470d2291c997`、后端 `f3d5e400d3b5bd737124b57cf0a38e685432aab2` 为工作区基线，包含既有未提交更改。

后端权威检查确认 `ConsoleConfigSyncController` 与 `ConsoleWorkflowRunController` 类级别均使用 `ADMIN_ONLY`。前端保留运行详情和普通配置日志的读取能力，仅隐藏或阻止敏感操作。

## 页面约束

- 配置管理页为 ADMIN、TENANT_ADMIN、AUDITOR 提供各自可读内容；只有 ADMIN 可见“配置同步”和“同步日志”。TENANT_ADMIN、AUDITOR 直接打开 `?tab=sync` 或 `?tab=syncLogs` 时，选中内容及地址均回到普通变更日志；TENANT_USER 被路由权限拒绝。
- 配置同步组件的导出、预览处理函数再次检查 ADMIN。导入按钮及处理函数同时检查 `canWriteSystem`，即管理员身份和全局写入未冻结；危险确认结束后再次核对当前租户及写权限。
- 同步日志的核对动作仅 ADMIN 可见，写冻结时禁用；处理函数再次核对角色、冻结状态、租户、导入方向和 RUNNING 状态。
- Workflow 运行详情的暂停、恢复、取消、终止和节点跳过由 ADMIN 当前写权限及后端合法状态共同控制。确认框返回后会重新核对租户、运行状态、权限和目标节点状态，避免租户切换或推送状态变化后复用旧确认。只读运行详情继续可见。

## 验收

- 两组前端定向单测共 12/12 通过，覆盖管理员合法前态、只读/写冻结隐藏控制、日志核对写冻结及租户迟到响应隔离。WDI `typecheck`、ESLint、Prettier 均通过。
- 真实认证 Chromium 配置页场景 1/1 通过：ADMIN 能看到两个管理页签；TENANT_ADMIN、AUDITOR 与 TENANT_USER 直达敏感页签都没有入口；三类非 ADMIN 对 ADMIN_ONLY 配置同步导出请求均返回 403。真实等待夹具的精确清理断言为零。
- 真实认证 Chromium Workflow 场景 1/1 通过：TENANT_ADMIN 能读运行详情，但在运行中的 Workflow 页面看不到暂停、恢复、取消或终止按钮；其暂停 API 返回 403。ADMIN 页面实际完成 RUNNING→PAUSED→RUNNING→SUCCESS，冻结 DAG 与数据库状态读回一致；精确清理断言通过。
- 配置页首轮真实联调发现非 ADMIN 的内容已回退，但地址栏仍保留 `tab=sync`；现将页签规范化监听设为初始化立即执行，最终复跑确认地址和内容都回到普通变更日志。
- 两个浏览器场景都使用独立的 WDI Console `18181`、Orchestrator `18182` 和 Vite `5181`，没有重启共享 `18080` 或 `18082`。临时进程退出且端口释放。

此结论关闭本地 WDI G05 页面权限承接，不代表生产环境发布验收。后端仍是最终授权裁决；本报告不将按钮隐藏当作安全边界。
