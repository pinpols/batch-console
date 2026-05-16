# batch-console

Batch Console 是批量调度系统的前端控制台，基于 Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router 与 TanStack Query 构建。当前仓库已经不是页面骨架，而是覆盖桌面端、移动端、文档中心与端到端测试支撑的完整业务前端。

## 环境要求

- Node.js 18+，建议 20+
- 后端联调仓库：`../file-batch-system`
- Console API 默认地址：`http://localhost:18080`

## 初始化与启动

```bash
npm install
npm run dev
```

默认开发地址为 `http://localhost:5173`。本地开发通过 Vite 代理把 `/api` 转发到后端，目标地址可在 `.env.development` 中用 `VITE_DEV_PROXY_TARGET` 覆盖。

常用命令：

```bash
npm run gen:api        # 从后端 OpenAPI 重新生成 src/types/api.generated.ts
npm run typecheck      # vue-tsc 类型检查
npm run build          # 类型检查 + 生产构建
npm run build:fast     # 仅 Vite 构建
npm run test:unit      # Vitest
npm run test:e2e       # Playwright
npm run docs:serve     # 构建并预览内嵌文档中心
```

## 接口与契约

- OpenAPI 权威源在后端仓库：`../file-batch-system/docs/api/console-api.openapi.yaml`
- 前端生成类型：`src/types/api.generated.ts`
- 业务类型出口：`src/types/console-api.ts`
- 认证接口在后端 `../file-batch-system/batch-console-api` 的 `/api/console/auth/*`

调整接口时先改后端契约并重新生成前端类型，不在前端手写与 OpenAPI 分叉的 DTO。

## 工程结构

```text
src/
├── api/                 # Console API 薄封装、拦截器、查询适配
├── charts/              # ECharts 注册入口
├── components/
│   ├── common/          # PageHeader、SectionCard、StatusTag、CommandPalette 等
│   └── table/           # ProTable、ListPageQueryBar、分页与骨架屏
├── composables/         # 租户重载、自动刷新、路由筛选、确认弹窗等复用逻辑
├── constants/           # 导航、页面元信息、状态、主题与密度常量
├── directives/          # 权限、hover-tab、safe-html 等指令
├── layout/              # 桌面端应用壳、侧边栏、顶栏、页签
├── layout-mobile/       # 移动端应用壳与通用样式
├── locales/             # zh-CN / en-US 文案
├── router/              # 桌面端与 /m/* 移动端路由
├── stores/              # auth、tenant、permission、tabs、app 等 Pinia store
├── styles/              # design tokens、reset、Element Plus 覆盖
├── types/               # OpenAPI 生成类型与业务类型出口
├── utils/               # request、安全 HTML、日志、时间、格式化工具
├── views/               # 桌面端业务页面
└── views-mobile/        # 移动端业务页面
```

桌面端页面按业务域分布在 `views/` 下；移动端使用独立 `/m/*` 路由，共享 API、stores 与 composables。

## 前端约定

- 依赖 `tenant.tenantId` 的桌面视图使用 `useTenantReload(loadFn)`；TanStack Query 场景把 `tenant.tenantId` 放进 `queryKey`。
- 任何 HTML 字符串渲染必须走 `v-safe-html` 或 `purifyHtml()`，不要使用原生 `v-html` 或未净化的 `innerHTML`。
- 页面标题、描述和导航文案统一维护在 `pageMeta.ts` 与 `locales/`，新增页面时同步补齐。
- 侧边栏产品文案、图标和顺序以前端 `navigationGroups` 为准；后端 `/auth/me` 菜单只作为可见性来源。
- 移动端 `/m/*` 不默认补自动化测试，除非新增独立业务逻辑或固化桌面未覆盖的回归。

更多跨仓协作规则见 [AGENTS.md](/Users/dengchao/Downloads/batch-console/AGENTS.md)。

## 文档

文档入口见 [docs/README.md](/Users/dengchao/Downloads/batch-console/docs/README.md)。新增或修订文档时优先确认它属于长期设计、阶段性报告还是归档材料，避免同一事实在多处重复维护。
