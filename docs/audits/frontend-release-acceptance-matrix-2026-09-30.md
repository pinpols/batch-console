# 前端发布验收矩阵（2026-09-30）

## 目的

本矩阵把“代码已实现”“自动化通过”“真实后端联调”和“人工真机验收”分开记录。任何一列没有
证据时，不使用“全场景验收完成”表述。自动化数量以命令实际收集结果为准，不在长期规范中固化。

## 自动化矩阵

| 场景                               | 权威测试入口                                                                                 | 后端要求                | 发布结论口径                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------- |
| 四角色菜单与接口拒绝               | `e2e/rbac-matrix.spec.ts`、`e2e/rbac-denial.spec.ts`                                         | 真实后端与四角色账号    | 角色可见性和服务端授权均通过       |
| 调度快照空态、403、超时与恢复      | `e2e/error-states.spec.ts`、`e2e/error-recovery.spec.ts`                                     | 注入测试 + 真实后端恢复 | 不出现空白页且可恢复               |
| 失败运行重试与文件/实例/Trace 深链 | `e2e/flows-ui/03-job-fail-rerun-ui.spec.ts`、`e2e/page-polish-deeplinks.spec.ts`             | 真实失败实例            | 三类来源均回到对应业务对象         |
| 隐藏页、二级页、返回链路           | `e2e/smoke.spec.ts`、`e2e/cross-navigation.spec.ts`、`e2e/navigation.spec.ts`                | 真实后端                | 路由可达、权限正确、返回上下文不丢 |
| 维护写冻结与恢复                   | `src/api/interceptors.maintenance.test.ts` + `npm run test:e2e:maintenance` 独占真实后端切换 | 后端维护端点            | 前端不发写请求，后端仍为最终防线   |
| 空态、错误态、加载态               | `e2e/all-pages-zero-error.spec.ts`、`e2e/error-states.spec.ts`                               | 真实或明确注入          | 空数据不伪装成接口失败             |
| 键盘与可访问性                     | `e2e/keyboard-flow.spec.ts`、`e2e/a11y.spec.ts`                                              | staging                 | 无阻断级 axe 违规，焦点可达        |
| 深浅主题与桌面视口                 | `e2e/ui-style-consistency.spec.ts`、视觉回归套件                                             | preview/staging         | 无溢出、遮挡和不可读状态           |

## 必须人工保留的边界

- iOS/Android 真机触控、系统字号放大、软键盘遮挡和弱网切换。
- 屏幕阅读器连续朗读顺序，不由 axe 静态扫描替代。
- 生产级全冻结维护只能在受控窗口验证；PR 环境不自动切换共享后端状态。
- 审批、重放、停用、删除等破坏性动作使用隔离的 `e2e-*` 数据，并由 teardown 清理。

## 本轮执行记录

执行命令、结果和环境证据在本次 PR 描述及 CI 中记录。`npm run verify:local` 只证明无后端门禁；
`bash scripts/local/fe-acceptance.sh` 或 staging gate 才能证明真实业务链路。
