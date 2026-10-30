---
name: frontend-testing-ci
description: 规划、执行或修复前端 lint、typecheck、i18n、Vitest、Playwright、bundle size、API drift、CI workflow 和 PR/full gate 时使用。
---

# 前端测试与 CI 门禁

## 测试分层

- `npm run lint:check` 检查代码风格；`npm run typecheck` 检查类型；`npm run check:i18n` 检查多语言 key；`npm run gen:api:check` 检查 OpenAPI 漂移。
- 测试持久化键和平台服务地址由 `npm run check:test-fixture-sources` 守护，覆盖 Vitest、Playwright 和 storage-state 脚本；场景输入和独立契约预期不机械抽成全局常量。
- `npm run test:unit` 覆盖 util、API、store 和 composable；SFC 测试只在收益明确时使用。
- Playwright 主要覆盖桌面关键用户路径；移动端默认不写自动化，除非新增独立业务逻辑或修复移动端独有回归。
- `npm run test:e2e` 是排除 `@slow` 的常规套件；`npm run test:e2e:all` 才是包含慢场景的发布验收全量套件；视觉基线单独运行 `npm run test:e2e:visual`。
- `npm run build` 是类型、i18n 和 Vite 构建的组合验证，不等于真实后端联调。

## 写测试

- 行为变更先明确用户可观察结果和关键失败路径，优先写目标测试并在可行时确认其先失败，再实现；纯逻辑用单测，组件状态/交互用适当的组件或浏览器路径，真实后端契约和关键业务流用 Playwright/真实环境。不要把 mock 结果写成真实联调证据；文档、格式和机械变更不强制测试先行。
- Vitest 文件与被测文件同目录，命名 `xxx.test.ts`；`describe` 用被测对象短名，`it` 描述行为，不用 `should` 前缀。
- mock 使用 `vi.mock` + `vi.mocked`，每个用例前 `mockReset()`；不要引入 jest/chai/sinon。
- Playwright 要使用稳定选择器和业务结果断言，不依赖脆弱延时或截图偶然一致。
- 普通 E2E 的语言来自 `e2e/test-config.json` 的 `defaultLocale`；用户可见文案优先用 `i18nKey()` / `e2eText()` 按生产 locale key 断言，不写中英文二选一表达式。双语覆盖放在 i18n 专项中；API 契约、枚举 code 和外部兼容值保留独立预期。
- 持久化键、浏览器 storage 桩和平台服务 origin 使用权威来源或共享 helper；不要把环境地址复制到测试里。用 `npm run check:test-fixture-sources` 检查回归。

## CI 处理

- PR gate、full-ci-gate、staging-gate 角色不同；skipped/cancelled/timed_out 不能报告为通过。
- Staging gate 必须连接真实环境并运行 `test:e2e:all`、安全响应头检查及标记的跨浏览器路由冒烟；URL、账号、健康检查或版本证据不足时失败，不降级为成功的空跑。
- 失败先读对应 job 日志和真实退出码；不要只因为本地构建通过就认定线上失败是环境问题。
- workflow 或门禁变更要同步 `docs/runbook/ci.md`，并考虑 API drift、i18n、audit、Lighthouse、Docker/Trivy 的触发范围。
- 本地 `preflight:changed` 对选中的增量检查快速失败；PR/Full Gate 通过 `run-gate.sh` 汇总独立检查，`verify-governance.sh` 在聚合模式下记录子门禁失败并继续，末尾统一报告。依赖安装、运行环境和步骤间产物等基础前置失败仍会阻断后续依赖步骤。
- CI 状态行由 `scripts/lib/gate-result.sh` 统一生成，字段顺序为状态、`code`、`gate`、`group`、`mode`、`exit_code`、`action`；locale 门禁归 `localization`，测试事实来源归 `testing`。检查器诊断可保持详细，但最终状态行必须使用该格式。

## 本地入口

- 快速按变更检查使用 `npm run preflight:changed`；跨领域治理细节加载 `frontend-engineering-governance`。
- 不依赖后端的完整检查使用 `npm run verify:local`。
- 真实业务验收使用 `bash scripts/local/fe-acceptance.sh`；缺少后端或 preview 时不能宣称全流程通过。

## UI与交互审查的验证

按 `frontend-ui-ia-review` 选择受影响页面/共享组件及正常、加载、空、错、提交/权限状态，覆盖实际相关视口、主题与语言。复用已有视觉/交互套件，不为文档或技能调整启动真实环境；视觉/页面实现修改按现行规范执行相应验证。

截图对比固定构建、角色、数据和视口；不盲目更新视觉基线接受退化。布局截图、axe、手工键盘、浏览器console/network及最终业务结果分别报告；组件存在或点击成功不能代替提交/下载/状态推进成功。条件不可用、样本ID无效或用例跳过不能记为该交互通过。

## 报告

报告要列出实际运行命令、结果、未运行项和原因。不要在长期文档固化测试数量；涉及真实用户路径时说明是否连到真实后端或仅使用 mock/fixture。

## 脚本选择与真实写入边界

- 以 `scripts/run-playwright.mjs` 和 package.json 的当前别名启动浏览器测试；`scripts/test-unit.sh`、`scripts/test-e2e.sh` 是参数包装。`scripts/report-playwright-release.mjs` 对 `@release-required` 的跳过会失败，必跑场景不能折算为通过。
- `e2e/config.cjs` 从 `e2e/test-config.json` 解析地址；staging 需显式 URL 与凭据。`global-setup.cjs` 统一准备租户、账号、密码状态、配置包与 storageState；`global-teardown.cjs` 可按 prefix 删除测试数据。两者含真实写入，认证状态文件不得提交，清理 warn/SKIP 不等于业务通过。
- `scripts/local/fe-acceptance.sh --list` 用于查看真实步骤；`--steps`、`--skip`、`--resume` 的结果只代表所选范围。验收可能刷新依赖、启动 preview 并写测试数据，先确认隔离环境与租户。
- `smoke:endpoints` 的 `--list` 离线，默认 GET 运行只证明路由/状态分类；`AUTH`、条件 404 和缺资源警告不等于授权/业务已验收。`--writes`、真实使用审计和完整 E2E 有写入副作用，按任务授权选择，不能为文档核查自动执行。
- 历史 `e2e-data/archive/` 和 `e2e/archive/` 不属于当前验收入口；数据文件完整性、mock/fixture 和真实业务闭环分别记录。脚本及配置角色见 `docs/engineering/script-skill-routing.md`。

## 当前真实验收 SQL 夹具

- `e2e/fixtures/closure-recovery/sql/` 与 `e2e/fixtures/workflow-bulk/sql/` 是当前真实验收支撑 SQL，由各自 `fixture.ts` 和 `*-real.spec.ts` 调用；它们也要进入脚本覆盖清单，不能因放在测试目录而排除，也不能与 `e2e-data/archive/` 的退役 SQL 混为一类。
- 两套用例均由 `E2E_CLOSURE_RECOVERY_REAL=1` 显式启用，要求 `E2E_SKIP_GLOBAL_SETUP=1`、独占真实验收时段、同版后端与迁移，以及显式 `E2E_CLOSURE_PG_CONTAINER/USER/DATABASE` 和测试凭据。关闭全局准备后由用例负责登录和清理；不能以设置开关代替环境写入或故障注入授权。
- SQL 通过 `execFileSync` 的 stdin 交给 `psql -X -v ON_ERROR_STOP=1`，变量使用 psql 引用，不拼接 Shell。保留每例 UUID 租户、故障对象名和已保存数字身份；不要替换成共享 `ta/tb` 或全局 prefix 清理。
- ConfigSync 故障 trigger 只命中本例审计租户，安装和移除都在事务内；必须保留 `finally` 移除及外层清理。通知冷热历史是直接准备的 fixture，渠道/规则停用；不能据此声称生产归档器或真实外部投递已验证。
- Workflow 批量清理遇到活跃运行或意外 Job 副作用会拒绝删除，清理后按预先保存的定义/运行/请求 ID 独立检查残留为零。受理响应、父记录消失和全局 teardown 警告都不能代替这些闭环证据。

## 运行进度真实验收

涉及真实控制图、Job／Pipeline进度、Worker中断恢复、审批重放或Quartz日统计时，按场景读取[运行进度真实验收方法](references/runtime-progress-acceptance.md)。其中区分控制图、SQL投影与真实Worker证据，保留各入口环境、权限和精确清理边界；普通测试不加载整份参考。
