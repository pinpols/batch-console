# WDI 批次日治理实施与真实联调 — 2026-10-25

## 基线和范围

两仓 `fix/wdi-current` 当前工作区，FE HEAD `662d254`、BE HEAD `f3d5e400d`；保留已有和并行改动，不提交或推送。本批对应17项计划的G01，不缩减G02–G12、B01与P00–P03范围。

前端在现有批次日列表/窗口复用治理抽屉；后端窗口查询补充持久化 `frozen`（无记录时为null），同步OpenAPI和生成类型。RELEASE保持后端人工放行语义，不包装成简单解冻。历史缺口为候选，不假定漏跑；结束日期受当前日历业务日期限制，最多90个自然日。

## 恢复和权限

写入要求管理员和原因；请求不传伪造operatorId。未知命令按当前用户、租户和日历保存在标签页，写入前先保存请求身份；刷新后恢复原键和请求。服务端幂等保留24小时，前端23小时后停止自动重试。损坏/过期/不可用记录阻止替代请求，旧确认按原键比较后才清除对应记录。服务端授权、状态机、等待与乐观锁仍为最终裁决。

## 当前验证证据

- 后端8项通过：ConsoleOpsQueryServiceTest 3、BatchDayMapperXmlTest 2、BatchDayMapperIntegrationTest 3（真实PG）。窗口和列表投影实际读取冻结字段；纯XML构造列顺序与Job汇总保持独立。
- 前端15项定向通过：API契约2、合法动作/日期3、窗口3、抽屉范围隔离2、未知命令恢复4、持久化键1。包含迟到响应、清空租户、损坏/过期/不可用恢复和旧确认不删除新命令。
- 已通过真实浏览器版本：六种动作、补扫暂停/恢复、历史缺口候选与深链、四角色、终态冲突，服务端成功后丢响应并刷新页面恢复原键，数据库独立回读7条治理审计和2条补扫事件，10次浏览器写入包含同键重试，无重复冻结审计，零残留。
- 用户身份隔离的最终副本复核通过：前端15项、构建、真实浏览器1项（38.4秒）均通过；最终日志归属配对后端 `build/acceptance-artifacts/console-g01-2026-10-25/`，不依赖临时目录日志。之前临时日志已不可用，后端结果由当前Surefire XML回读保存。

安全证据：[状态与权限](assets/batch-day-governance-2026-10-25/verified-state.json)、[清理](assets/batch-day-governance-2026-10-25/cleanup.json)、[1440×1100真实页面](assets/batch-day-governance-2026-10-25/admin-governance.png)。测试关闭trace，不保存Cookie、密码和票据。

## 实际入口与验收边界

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:batch-day:real`（另需显式E2E_BASE_URL及共享PG容器/用户/数据库环境，详见[夹具](../../e2e/fixtures/runtime-progress/README.md)）。同版后端通过本地build-apps构建并按生命周期锁重启orchestrator/console；浏览器使用WDI 5178固定preview，真实认证开启（匿名auth/me=401）。Worker和Trigger未在本批重启。

初始SQL只建立前置状态，核心动作通过真实API执行。这里没有验证依赖等待被释放后的Worker执行、真实Quartz日计划或完整前后端发布门禁；其它16项不能据本批通过关闭。整仓空值治理仍有前批/并行来源待收口，不称完整CI全绿。
