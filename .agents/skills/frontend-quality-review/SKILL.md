---
name: frontend-quality-review
description: 对 Vue 控制台做跨领域深度审查时使用，覆盖 UI 审美与交互、代码质量和可读性、可访问性及浏览器端安全；普通单点实现优先使用对应专项 skill。
---

# 前端综合质量审查

## 适用范围

用户要求整体审查、上线前审查、对抗式审查，或同时检查视觉/交互、可维护性、安全时使用。单个页面设计、API 契约、国际化、CI、安全漏洞修复等单点任务，优先使用对应专项 skill；需要跨领域时再组合本技能。

这是审查与修复工作流，不是新的设计系统或安全认证。仓库的 `AGENTS.md`、现有组件、design token、OpenAPI、权限模型和 CI 是最终约束；外部设计系统只提供原则，不覆盖本项目约定。

## 工作方式

1. **确定审查边界**：先识别用户指定的页面、角色、关键流程和运行环境；检查路由、导航、布局、共享组件、API 边界及对应测试。范围很大时先列出页面/流程覆盖矩阵，优先处理高风险与高频区域，不把抽样说成全量。
2. **收集证据**：检查真实源码、可复现路径、测试和运行配置。区分代码可确认的问题、需要真实服务/账户验证的问题和纯建议；记录文件与行号。浏览器证据要注明 viewport、角色、数据来源（真实后端或 mock/fixture）及主题/状态。
3. **按下面维度审查**，优先报告具体缺陷和用户影响，不以个人偏好代替问题证据。用户要求修复时，按风险和范围直接修并验证；若仅要求审查，先给出 findings，不擅自扩大改动。
4. **复核影响面**：共享组件改动要检查其所有调用方式或至少代表性调用方；页面改动检查桌面常见宽度、窄屏、长文本、空/错/加载态及明暗主题中与变更相关的状态。
5. **验证并报告**：运行与改动匹配的仓库门禁。将 PASS、FAIL、SKIP、未运行分开写；不以本地 mock、静态检查或 CI 的部分绿灯声称真实端到端验收或安全认证完成。

## 审查维度

### UI 审美与交互

- 先确认页面任务、主要对象、角色和操作顺序，再评估视觉；运维控制台优先清晰、可扫描、信息密度合理，不套用营销页式大 Hero、装饰卡片或无意义留白。
- 遵循现有设计 token、Element Plus 和共用组件。检查字体层级、控件高度、圆角、边距、边框、阴影、颜色语义、浅/暗主题和过渡是否一致；避免局部裸值与同一页面多套风格。
- 表单字段应按任务分组并保持可预测顺序；标签、说明、必填/限制、错误、禁用/提交中状态清楚；相邻字段和附加操作不重叠、不造成不必要宽度差。长表单渐进披露，不为装饰拆成多张卡片。
- 检查按钮主次、危险操作确认、重复提交防护、撤销/保存边界、空态/加载态/错误态、筛选与内容区域的空间比例。状态不能只靠颜色表达。
- 检查键盘可达、焦点可见、标签与错误关联、放大/长文案/窄屏可用性；必要时使用浏览器和辅助功能检查，不把截图像素相似度当成唯一验收标准。
- 区分桌面控制台与 `/m/*` 移动流程；不要把桌面路由缩窄后渲染正常，误报为移动端体验已验收。

### 代码质量与可读性

- 追踪用户操作到组件、composable/store、API 客户端和后端契约；确认状态来源唯一、错误处理可见、租户切换/异步迟到响应不会覆盖新状态。
- 优先复用本仓库 API、permission、表单、日期、异步动作和展示工具；不重复造基础设施，也不为了“抽象”引入没有实际收益的层。
- 评估 SFC/函数是否承担过多职责、分支/副作用是否难以推理、命名是否表达业务意图、类型是否与 OpenAPI 对齐、注释是否解释原因而非复述代码。长文件阈值是调查信号，不是必须机械拆分的缺陷。
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
