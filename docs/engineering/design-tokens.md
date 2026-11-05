# 设计 Token 治理

`src/styles/tokens-handoff.css` 是应用运行时设计 token 的唯一权威源。`design/tokens-handoff.css` 是 2026-07 初始视觉交付快照，只用于追溯，不复制回运行时。

新增颜色、间距、字号、圆角或阴影时优先使用已有语义变量；确需新增时同时检查浅色、深色、Element Plus 映射和三档内容密度。页面代码不得直接从 `design/` 导入样式，也不得用裸色值建立平行 token 体系。

当前视觉方向为 2026-11-03 选定的[时刻表方向](console-visual-redesign-timetable-2026-11-03.md)：状态色只表达状态，分类信息用中性标签，Element Plus 派生色由语义 token 推导。

视觉变更至少运行 `npm run test:e2e:visual`，并按影响范围检查列表工具栏、空/错/加载状态、对话框和移动端布局。

## 表单操作区

- 页面内嵌编辑表单的操作区使用 `.form-actions`（`el-form-item`）或 `.form-action-bar`（普通容器），统一采用顶部弱分隔线、右对齐和 `--space-sm` 间距。
- 次操作（取消、重置、返回）排列在前，主操作（保存、提交、创建）排列在后并使用 `primary`；只有删除、停用等不可逆动作使用危险色。
- 弹窗和抽屉优先使用组件的 `footer` 插槽，依赖全局 footer 样式处理对齐、间距和窄屏换行，不在页面重复声明按钮间距。
- 保存、提交、取消等文字明确的表单动作默认不附加图标；图标保留给刷新、下载、复制等可稳定识别的工具动作，纯图标按钮必须提供可访问名称或 tooltip。
- 提交按钮提供 loading 状态，执行期间禁用可能丢失输入或重复触发的次操作；表单绑定 `submit` 事件并为表单内主按钮使用原生 submit 语义，保证键盘可操作。

## Element Plus 样式加载顺序

`main.ts` 整包引入 `element-plus/dist/index.css`，之后加载 `src/styles/` 的覆盖规则；`vite.config.ts` 的 `ElementPlusResolver` 必须保持 `importStyle: false`。若开启按需样式，组件 CSS 会在运行时排到覆盖规则之后，同优先级下覆盖主题（2026-11-04 抽屉头部、底色失效即此原因）。

## 品牌标志、加载动画与提示图标

三者使用同一套扁平视觉，不再各自带渐变、高光或卡通造型（2026-11-05 统一）。

- **品牌标志**：`public/icons/batch-mark.svg`（完整图标）与 `batch-mark-foreground.svg`（白色前景，叠在 `--brand-mark-fill` 上）。造型是三条错开起止的泳道，对应控制面板“业务日时刻轨道”。`--brand-mark-fill` 为 `--color-brand-mark-bg` 的纯色，明暗主题各一值。改动标志后用 `scripts/gen-pwa-icons.mjs` 重新生成 favicon、PWA 图标和 iOS 启动图（需临时准备 `sharp`，不加入依赖），并同步 `index.html` 与 `manifest.webmanifest` 的 `theme-color`。SVG 注释中不得出现 `--`，否则浏览器整张丢弃。
- **加载动画**：`v-loading` 遮罩不再显示品牌标志，改为同一泳道意象的四段条依次铺满（`element-override.css` 的 `lane-loader-fill`）；遮罩高度不足 90px 时整体缩小。启动页（`public/app-startup.css`）的品牌方块内泳道依次绘出。两者都尊重 `prefers-reduced-motion`。按钮内的 loading 保留 Element Plus 原生图标。
- **提示块图标**：`el-alert` 的实心图标替换为与 lucide 一致的线性图标（CSS mask），只给图标上色；标题用正文色、说明用次级色，底色用 `--color-*-light` 状态浅底，随主题变化。

## 中文界面的大小写

描述列表标签与表格表头不做 `text-transform: uppercase`（2026-11-05 移除）。界面以中文为主，大写转换只会把混排的英文变成“WORKER 分组”“JOB CODE”这类写法；英文缩写按词条原样展示。
