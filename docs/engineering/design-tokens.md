# 设计 Token 治理

`src/styles/tokens-handoff.css` 是应用运行时设计 token 的唯一权威源。`design/tokens-handoff.css` 是 2026-07 初始视觉交付快照，只用于追溯，不复制回运行时。

新增颜色、间距、字号、圆角或阴影时优先使用已有语义变量；确需新增时同时检查浅色、深色、Element Plus 映射和三档内容密度。页面代码不得直接从 `design/` 导入样式，也不得用裸色值建立平行 token 体系。

视觉变更至少运行 `npm run test:e2e:visual`，并按影响范围检查列表工具栏、空/错/加载状态、对话框和移动端布局。
