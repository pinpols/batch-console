# batch-console（前端）

Vue 3 + TypeScript + Vite + Element Plus + Pinia + Vue Router。

## 环境要求

- Node.js 18+（建议 20+）

## 初始化与启动

安装依赖：

```bash
npm install
```

本地开发启动（默认 `http://localhost:5173`）：

```bash
npm run dev
```

构建：

```bash
npm run build
```

预览构建产物：

```bash
npm run preview
```

## 接口联调

本地默认通过 Vite 代理把 `/api` 转发到后端：

- 后端地址：`http://localhost:8080`
- 代理配置：`vite.config.ts`

环境变量：

- 开发：`.env.development`
- 生产：`.env.production`

## 工程结构

当前代码骨架按设计文档收敛为：

```text
src/
├── api/
├── components/
│   ├── common/
│   └── table/
├── composables/
├── constants/
├── directives/
├── layout/
├── router/
├── stores/
├── styles/
├── types/
├── utils/
└── views/
    ├── alert/
    ├── file-center/
    ├── job/
    ├── log/
    ├── monitor/
    ├── system/
    ├── worker/
    └── workflow/
```

## 初始化骨架

- `main.ts` 负责注册 Pinia、Vue Router、Element Plus、全局图标和权限指令
- `layout/DefaultLayout.vue` 负责应用壳、侧边栏和顶栏
- `styles/` 负责设计令牌、重置样式和 Element Plus 覆盖
- `components/common/` 提供页面容器、标题、卡片、空态、状态标签等基础组件
- `views/` 先以页面骨架为主，后续逐步替换为完整业务页面
