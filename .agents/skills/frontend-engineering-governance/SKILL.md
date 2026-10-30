---
name: frontend-engineering-governance
description: 修改或审查前端架构、完整代码规约与可维护性、环境变量、GitHub Actions、供应链和治理门禁时使用。代码Bug使用frontend-quality-review，UI/交互/视觉使用frontend-ui-ia-review；明确双仓周期/全域任务才使用cross-repo-governance-review。
---

# 前端工程治理

## 适用边界

- 本技能处理跨模块工程约束和可重复门禁；业务测试走 `frontend-testing-ci`，部署运行时走 `frontend-deploy-runtime`，文档内容治理走 `frontend-docs-release-governance`。
- 仅前端的架构/规约、存量维护性及门禁治理由本技能承接；明确双仓周期/全域治理时使用 `cross-repo-governance-review` 汇总。代码Bug由 `frontend-quality-review` 定位，UI/交互/视觉由 `frontend-ui-ia-review` 检查；同基线证据复用。
- 仓库脚本和 `package.json` 是执行口径，技能文件只记录选择规则，不复制检查实现或瞬时统计。

## 规约与结构的人工检查

以 `AGENTS.md`、`docs/engineering/code-readability-governance.md`、测试/状态/接口规范为准，检查组件/composable/store/API职责、类型与固定Map边界、判别联合、参数/对象引用、嵌套调用/独立条件、稳定key/常量、集合/策略/工厂和专业中文注释。保持短路、响应式依赖、求值时机、引用身份及异步副作用；简单调用/声明式组合不机械拆分。

全量任务记录源码/脚本/测试与文档的实际分母、条款、合法保留和未核对项；守卫绿灯不代表全部语义规约已检查。测试健壮性、i18n key与环境事实来源依已有测试规范核对；行为Bug候选交质量审查，不以统一风格关闭。

## 变更前判断

按改动范围选择最小但完整的检查：

| 改动 | 必查项 |
|---|---|
| `src/**` | `check:comments`、`check:architecture`、`check:maintainability` |
| `.env*`、Docker、Compose、workflow | `check:env` |
| `.github/workflows/**` | `check:workflows`，可用时再跑 `actionlint` |
| `package.json`、`package-lock.json` | `check:version`、`compliance:check` |
| 当前文档或索引 | `check:docs`；上线准入/成熟度入口变更跑 `check:go-live-readiness`；文档站入口变化再跑 `docs:build` |
| 用户、契约或部署影响变更 | `check:changelog` |

不要为绕过检查添加宽泛例外。确需例外时，限定到最小文件或依赖边，并用中文说明删除条件。

## 三层入口

1. 日常提交前运行 `npm run preflight:changed`；需要覆盖未暂存和未跟踪文件时运行 `npm run preflight:changed:all`。
2. 无后端的完整本地门禁运行 `npm run verify:local`。它不修改源码，也不代表真实业务验收。
3. 需要真实浏览器和后端证据时运行 `bash scripts/local/fe-acceptance.sh`。后端、preview 或真实审计缺失必须失败或明确 SKIP，不能记成通过。

## 结果处理

- 错误必须修复后重跑；维护性观察项是非阻断警告，但新增超限文件或继续扩大既有大文件时应优先拆分。
- `check:comments` 只要求解释性注释使用中文；API 路径、类型字段、命令、代码示例和工具指令保持权威原文。
- `compliance:check` 发现漂移时运行 `npm run compliance:sbom` 并提交确定性生成结果，不手工编辑 SBOM 或许可证清单。
- 报告区分 PASS、FAIL、SKIP 和未运行，并写明真实后端、mock、preview 或 staging 的证据边界。
- 新增或修改门禁时，用 `scripts/ci/run-gate.sh` / `scripts/lib/gate-result.sh` 输出统一状态行，并给门禁分配稳定 `group`；同步 `docs/runbook/ci.md` 的触发与分组矩阵。脚本自测应覆盖会拦截和应放行的案例。

## 脚本与守卫归属

- 脚本登记和总路由见 `docs/engineering/script-skill-routing.md`。治理脚本由本 Skill 主责：编码/注释、架构/环境、维护性/UI 复杂度、调用现场可读性、基线扩张审批、Shell、Workflow、SBOM 与 Changelog；领域脚本仍路由到 API、测试、部署和文档 Skill。
- `check:readability-calls` 与 `test:readability-calls`、`check:baseline-expansion` 与 `test:baseline-expansion` 是规则/反例组合；不要只运行报告而漏掉守卫自测，也不把修改基线当整改。
- `scripts/local/preflight-changed.mjs` 区分暂存与 `--all`；`verify-governance.sh`、`ci.sh` 和 `ci/run-gate.sh` 是聚合入口；`lib/gate-result.sh` 与 `lib/readability-callsite.mjs` 是支撑库，不重复造同义入口。
- `check:shell` 覆盖实际存在的 tracked/未跟踪 Shell 与两个 Husky hook；明确排除已退役的 `scripts/archive/`、`e2e-data/archive/`、`e2e/archive/` 历史原件。新增入口必须进入检查，而非仅依赖文件已被暂存。
- `tools/download-list-manager.ps1` 是独立的 Windows 下载清单工具，保留其旁置说明；不属于 Console 业务、部署或验收流程，不为它新建前端 Skill。
