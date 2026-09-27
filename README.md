# batch-console

> File Batch System 的自托管运维控制台：把「配置 → 编排 → 运行 → 观测 → 治理」统一成面向多租户批处理平台的桌面端与移动端操作界面。

[![PR Gate](https://github.com/pinpols/batch-console/actions/workflows/pr-gate.yml/badge.svg)](https://github.com/pinpols/batch-console/actions/workflows/pr-gate.yml)
[![Full CI](https://github.com/pinpols/batch-console/actions/workflows/full-ci-gate.yml/badge.svg)](https://github.com/pinpols/batch-console/actions/workflows/full-ci-gate.yml)
[![CodeQL](https://github.com/pinpols/batch-console/actions/workflows/codeql.yml/badge.svg)](https://github.com/pinpols/batch-console/actions/workflows/codeql.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-22%20%7C%2024-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

[快速开始](#快速开始) · [核心能力](#核心能力) · [工程结构](#工程结构) · [文档索引](docs/README.md) · [贡献指南](CONTRIBUTING.md) · [配对后端](https://github.com/pinpols/file-batch-system)

## 这是什么？

Batch Console（BC）是 [File Batch System](https://github.com/pinpols/file-batch-system) 的**控制面前端**。它通过 `batch-console-api` 管理平台配置与运行操作，不承担任务调度、Worker 执行或运行状态持久化：

- 面向作业、工作流、文件流水线和批次日提供配置、发布、重放与审批入口；
- 汇总实例、告警、Outbox、Worker、容量和审计信息，支持 Trace ID 跨页面排障；
- 以租户和权限为边界提供桌面端完整操作台与移动端轻量处置入口；
- 以后端 OpenAPI 为契约源，前端 API 类型、CI 漂移检查和联调流程保持同步。

## 核心能力

| 领域 | 能力 |
|---|---|
| 配置与编排 | 作业、DAG 工作流、管道、文件渠道、资源队列和租户配置包 |
| 运行与处置 | 实例查询、触发、重试、取消、批次日重放、审批和补偿 |
| 可观测性 | 运行总览、告警、Outbox、Trace ID、Worker 指纹、容量与文件到达进度 |
| 平台治理 | 多租户权限、审计、配置同步、Secret 管理、国际化和主题切换 |
| 工程交付 | OpenAPI 类型生成、Vitest、Playwright、视觉回归、Docker/Nginx 与分层 CI |

## 快速开始

### 环境要求

- Node.js 24；本地、CI 与镜像统一使用 `.node-version` / `.nvmrc` 指定的版本
- 后端联调仓库：`../file-batch-system`
- Console API 默认地址：`http://localhost:18080`

### 初始化与启动

```bash
npm ci
npm run dev
```

默认开发地址为 `http://localhost:5173`。本地开发通过 Vite 代理把 `/api` 转发到后端，目标地址可在 `.env.development` 中用 `VITE_DEV_PROXY_TARGET` 覆盖。日期时间默认按浏览器 IANA 时区展示，也可通过 `VITE_DISPLAY_TIMEZONE=Asia/Shanghai` 固定展示时区；用户偏好保存到浏览器后优先使用。

常用命令：

```bash
npm run gen:api        # 从后端 OpenAPI 重新生成 src/types/api.generated.ts
npm run typecheck      # vue-tsc 类型检查
npm run build          # 类型检查 + 生产构建
npm run build:fast     # 仅 Vite 构建
npm run test:unit      # Vitest
npm run test:e2e       # Playwright 常规套件，排除 @slow
npm run test:e2e:all   # 发布验收全量套件
npm run docs:serve     # 构建并预览内嵌文档中心
npm run check:health   # 联调健康检查(BE actuator + OpenAPI 漂移 + preview 端口),make health 别名
npm run check:architecture # API 分层与循环依赖
npm run check:docs     # 当前文档链接与本机路径漂移
npm run verify:local   # 无后端完整本地门禁
```

> **联调遇怪问题先 `make health`** — 协议层探测 BE console-api / trigger / orchestrator + API 漂移。
> Staging:覆盖 `BE_CONSOLE_URL` / `BE_TRIGGER_URL` / `BE_ORCH_URL` 指向远端。
> 详见 [`scripts/local/health-check.sh`](scripts/local/health-check.sh) 顶部注释。

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

更多跨仓协作规则见 [AGENTS.md](./AGENTS.md)。

## 文档

文档入口见 [docs/README.md](./docs/README.md)。新增或修订文档时优先确认它属于长期设计、阶段性报告还是归档材料，避免同一事实在多处重复维护。
