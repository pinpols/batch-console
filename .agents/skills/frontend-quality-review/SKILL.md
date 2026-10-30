---
name: frontend-quality-review
description: 用户要求前端代码Bug、变更或跨领域质量审查时使用，确认错误行为、用户影响和验证证据。UI/交互/视觉细项由frontend-ui-ia-review负责，规约与工程门禁由frontend-engineering-governance负责；按需组合现有专项。
---

# 前端Bug与综合质量审查

## 适用范围

用户要求前端代码Bug或普通变更审查时进入代码专项模式；要求整体质量或同时检查UI、交互、安全/数据流时进入综合模式。只做UI/视觉使用 `frontend-ui-ia-review`，只做代码规约/工程控制使用 `frontend-engineering-governance`，明确单点API/状态/i18n任务直接进入所属专项。

代码Bug必须给出输入/操作、预期与实际、错误目标/状态/副作用及根因；沿用户目标→请求目标→页面结果/后端结果取证。纯视觉偏好、长文件或规约不符不能直接计Bug。综合审查分别记录功能Bug、可用性/可访问性、规范偏差与建议，不要求几个skill对同一范围各跑一轮。

这是审查与修复工作流，不是新的设计系统或安全认证。仓库的 `AGENTS.md`、现有组件、design token、OpenAPI、权限模型和 CI 是最终约束；外部设计系统只提供原则，不覆盖本项目约定。

## 工作方式

1. **确定审查边界**：先识别用户指定的页面、角色、关键流程和运行环境；检查路由、导航、布局、共享组件、API 边界及对应测试。范围很大时先列出页面/流程覆盖矩阵，优先处理高风险与高频区域，不把抽样说成全量。
2. **收集证据**：检查真实源码、可复现路径、测试和运行配置。区分代码可确认的问题、需要真实服务/账户验证的问题和纯建议；记录文件与行号。浏览器证据要注明 viewport、角色、数据来源（真实后端或 mock/fixture）及主题/状态。
3. **按所选模式取证**：Bug专项沿实际错误及其必要消费者确认根因，不附带完整UI/规约清单；综合模式按实际涉及维度进入专项并复用证据。优先报告用户影响，不以个人偏好定缺陷。授权修复时按范围整改验证；仅审查时交付发现与建议。
4. **复核影响面**：共享组件改动要检查其所有调用方式或至少代表性调用方；页面改动检查桌面常见宽度、窄屏、长文本、空/错/加载态及明暗主题中与变更相关的状态。
5. **验证并报告**：运行与改动匹配的仓库门禁。将 PASS、FAIL、SKIP、未运行分开写；不以本地 mock、静态检查或 CI 的部分绿灯声称真实端到端验收或安全认证完成。

## 审查维度

### UI 审美与交互

具体步骤与常见问题由 [frontend-ui-ia-review](../frontend-ui-ia-review/SKILL.md) 及其[检查表](../frontend-ui-ia-review/references/common-ui-checks.md)统一维护。综合审查按页面任务、视觉一致性和操作链路收取该专项证据，不复制另一套检查清单。

UI实际审查包含适用的布局/密度、表格/表单/弹层、状态反馈、危险/批量动作、长数据、中英文/主题/窄屏、键盘及图表/DAG。只做Bug或静态文档任务时不宣称完成浏览器视觉验收。

### 代码质量与可读性

- 追踪用户操作到组件、composable/store、API 客户端和后端契约；确认状态来源唯一、错误处理可见、租户切换/异步迟到响应不会覆盖新状态。
- 优先复用本仓库 API、permission、表单、日期、异步动作和展示工具；不重复造基础设施，也不为了“抽象”引入没有实际收益的层。
- 代码规约、结构/可读性细项由 `frontend-engineering-governance` 按现行可读性文档维护；变更综合审查只核对实际触及项，Bug专项不强制跑完整规约。长文件或嵌套命中先判断语义，不直接列为功能缺陷。
- 检查 API/租户/权限/配置责任是否越界；前端权限控制仅改善可见性和体验，授权裁决必须由后端完成。生成 API 类型不可手改。
- 检查测试是否断言用户可观察行为和关键边界，而非仅断言实现细节；共享逻辑、异步状态、权限与安全边界的测试优先级高于纯样式快照。

### 浏览器端安全

- 把 URL、API 响应、日志、文件内容、Markdown/HTML、剪贴板和浏览器存储都视为不可信输入；追踪输入到 DOM、属性、URL、样式、脚本和导航等 sink。
- 严格遵守仓库红线：禁止 `v-html`；富文本使用 `v-safe-html` / `purifyHtml()`；检查链接 scheme、DOM 注入、动态模板、Markdown 渲染和 Mermaid/图表标签中的不安全处理。
- 认证遵循后端 HttpOnly Cookie 契约；不在 `localStorage`、`sessionStorage`、Pinia 持久化、URL、日志或错误提示中存令牌、密码和秘密。前端不得复制 token 到 Authorization header，也不得弱化 CSRF/认证校验来修 UI 测试。
- 检查权限/租户边界仅被当作 UI 提示还是被误当成安全边界；敏感操作必须调用后端受保护接口，不能用隐藏按钮代替授权。
- 文件导入、预览、下载和 clipboard 流程检查类型/大小限制、恶意内容安全呈现、对象 URL 清理、权限失败反馈及秘密的一次性显示/清理。
- 外链新窗口、跳转参数、返回路径、错误/调试信息、浏览器控制台和遥测不得导致开放重定向或敏感信息泄漏；CSP 是纵深防御，不替代安全渲染和输入/输出处理。
- 只有涉及部署头、CSP、Cookie、Nginx 或环境配置时，才加载 `frontend-deploy-runtime`；前端发现后端需要改变的安全契约，记录为后端待办，不在前端伪造兜底。

## 专项技能路由

- UI/信息架构、页面和表单：`frontend-ui-ia-review`
- 用户文案、i18n、ARIA、键盘和安全 HTML：`frontend-i18n-accessibility`
- API、OpenAPI、认证 payload、权限契约：`frontend-api-contract`
- 页面状态、租户重载、分页和异步竞争：`frontend-state-data-flow`
- 单测、Playwright、门禁及验证策略：`frontend-testing-ci`
- 架构、维护性、依赖和本地治理门禁：`frontend-engineering-governance`
- Nginx、CSP、安全头、Cookie 和部署运行时：`frontend-deploy-runtime`
- 提交和 PR 流程：`git-pr-workflow`

需要展开某一领域时读取对应 skill，不复制或维护第二套相同规则。

## 结果格式

- 审查发现优先，按严重性排序；每项给出位置、触发条件、用户/安全影响、证据和修复建议。确认不了的内容标为待验证，不写成确定缺陷。
- 修复任务报告改了什么、哪些门禁通过、哪些未运行，以及 mock 和真实环境的界限。
- 无发现时明确说明审查覆盖边界、实际证据和残余风险；不把静态抽查称为“全页面/全角色/全场景审查”。

## 参考原则

- [Vue Style Guide](https://vuejs.org/style-guide/)：吸收错误预防和可读性规则，并允许结合团队上下文裁剪。
- [Carbon Forms Pattern](https://www.carbondesignsystem.com/building-blocks/core/patterns/forms)：参考企业产品表单的信息分组、顺序、简洁和交互连续性；不复制 Carbon 视觉样式。
- [W3C WCAG 2.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)：表单标签与说明原则。
- [OWASP Cross Site Scripting Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)、[DOM based XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)、[HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)：浏览器渲染、DOM sink 和存储安全参考。
