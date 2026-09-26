---
name: frontend-i18n-accessibility
description: 修改或审查前端用户文案、国际化词条、表单提示、可访问性、键盘交互、安全 HTML 渲染和用户友好错误展示时使用。
---

# i18n 与可访问性治理

## 国际化

- 所有用户可见文本走 `t('namespace.key')`，不要在 `.vue` 或业务 `.ts` 中硬编码中文/英文。
- zh-CN 和 en-US key 必须一一对齐；新增页面优先用页面级 namespace，公共动作和状态放 `common.*`。
- 后端枚举、状态、错误码和配置说明要通过统一映射展示，不在多个页面重复写文案。

## 可访问性与交互

- 表单字段要有 label、placeholder、帮助说明、必填/默认值/限制提示和可操作错误。
- 图标按钮要提供可理解名称或 tooltip；不要只靠颜色表达状态。
- 弹窗、抽屉、下拉、表格、分页和上传优先使用 Element Plus 组件，保持键盘焦点和 ARIA 行为。
- 移动端独有交互遵守既有 iOS 风格边界，但业务逻辑尽量复用桌面 API、store 和 composable。

## 安全渲染

- `v-html` 被禁用；HTML 内容使用 `v-safe-html`，手动 `innerHTML` 前必须经 `purifyHtml()`。
- 不信任后端已转义；错误详情、日志片段、SQL/JSON 预览和文档片段都按不可信内容处理。

## 验证

- 文案或 key 变化运行 `npm run check:i18n`，复杂页面再跑 `npm run typecheck`。
- 用户路径变化要检查空态、加载态、错误态、权限不足、移动端窄屏和长文本换行。
