# 调度依赖等待真实联调（2026-10-26）

## 范围

本报告记录 WDI `fix/wdi-current` 前后端工作区内 G02 跨日历等待与作业依赖等待的真实验收。当前代码基线为前端 `662d254e2f8b97f93021de548815470d2291c997`、后端 `f3d5e400d3b5bd737124b57cf0a38e685432aab2`，包含未提交工作区。隔离启动当前构建包的 Console `18181`、Orchestrator `18182` 和 Vite `5181`；未操作共享 Console `18080` 或 Orchestrator `18082`。

## 真实路径与结果

- Playwright Chromium：1 项通过、0 重试。用真实 API 建立上游/下游作业与 Workflow，触发作业依赖等待；日历等待和作业等待都经 PostgreSQL 持久化并由 Console API 读回。
- 调度快照页显示两类记录。作业等待默认查询不带 `jobCode`，仍能读到本例请求。响应与页面均未泄漏启动载荷标记。
- ADMIN 在页面提交带理由的日历 `SKIP` 决策，HTTP 返回 200；数据库读回 `manualAction=SKIP`、操作者及理由。记录仍为 `WAITING`，因为夹具把下次日历检查时间安排在未来；本次没有声称调度器已消费该决定或等待已终态。
- TENANT_ADMIN 与 AUDITOR 可查询等待但页面无写操作按钮；TENANT_USER 查询及三种非 ADMIN 写操作均被拒绝；跨租户读取为 403，匿名读取为 401。
- 同一隔离浏览器批次补核配置同步权限：ADMIN 可见同步及日志页签；TENANT_ADMIN、AUDITOR、TENANT_USER 对 `tab=sync`/`syncLogs` 深链均无管理员入口，三种角色的配置同步导出请求均为 403。首轮发现选中内容虽回退但地址仍保留敏感 `tab`，现已修复为初始页签规范化 URL，最终复跑通过。
- E2E `finally` 对等待行、Job 定义、依赖、角色账号与业务夹具执行精确清理断言，所有剩余计数为 0。临时服务退出，未留下目标端口监听。

## 修复的契约问题

真实联调暴露两个此前静态检查无法发现的问题：

1. 配置编码按规范存为小写，但日历等待治理服务的列表查询和人工操作把编码转为大写，导致合法的小写日历记录查不到。后端改为用配置编码规范化器处理 `calendarCode`，等待状态仍按枚举大写处理。
2. 作业等待页面的默认查询不提供 `jobCode`。MyBatis 查询直接对未定型空参数使用 `? is null`，PostgreSQL 报 `could not determine data type of parameter` 并返回 500。Mapper 现在将可空字符串参数显式转换为 `text`；真实 E2E 增加了无 `jobCode` 的 API 回归断言。

## 验证边界

当前后端运行包的本地构建成功，8 个运行包已生成。真实 Chromium 联验覆盖页面、真实认证、API、数据库回读、角色/租户边界和清理。后端相关 Maven 集成类没有得到可用结果：一次运行在测试基类加载时报 `NoClassDefFoundError`；禁用 fork 的尝试则被工作区其他测试源码缺少类型阻断。因此不把 Maven 集成测试记为通过。

## 调度器消费补充验收

后续使用当前 WDI 构建包再次执行真实认证 Chromium，1/1通过、0重试。验收夹具将日历检查日放在独立于作业依赖业务日的日期；此前把两种等待放在同一天时，调度器按设计因存在已接受的Workflow触发请求而延迟跳过，本次不把该保护行为当作产品缺陷。

调度器日志确认消费 `MANUAL_CALENDAR_DEPENDENCY_SKIP`；脱敏机器证据见[调度器消费验收 JSON](assets/scheduler-dependency-waits-2026-10-26/consumption-evidence.json)。真实 PostgreSQL 读回跨日历等待和其对应批次日的状态均为 `SKIPPED`，操作理由存在，E2E精确清理断言中的等待、批次日、作业定义、依赖、Workflow记录、账号和租户残留均为0；三份失败运行产生的隔离数据库也已删除并复核无残留。服务使用隔离 Console `18181`、Orchestrator `18182` 和 Vite `5181`，未操作共享端口。

## 人工 RELEASE 消费补充验收

在另一个独立业务日写入带理由的管理员 `RELEASE` 决策，再将等待设为可检查，确认真实调度器消费决策。Chromium 1/1通过、0重试；PostgreSQL读回等待为 `OPENED`，创建唯一批次日且状态为 `OPEN`，`operation_reason`保留人工放行原因，`operated_by`已记录。脱敏机器证据见[RELEASE消费验收 JSON](assets/scheduler-dependency-waits-2026-10-26/release-consumption-evidence.json)。精确清理回读的等待、批次日、操作审计、作业定义、依赖、运行、账号和租户残留均为0；隔离数据库由验收脚本成功删除，独占端口已释放。

这使人工日历 `SKIP` 与 `RELEASE` 两种决定的调度器消费均得到本地真实证据。作业依赖保持只读；其他日历协调组合、P00/P01/P02列出的DAG与真实Pipeline Worker场景仍在实施计划中。后端 Maven 集成类此前未得到有效结果，该限制仍然成立；Chromium验收不替代Maven集成测试或生产验收。图表继续放在既有运维总览、作业详情、Workflow DAG/运行详情与Pipeline观测页面，不新增重复看板。
