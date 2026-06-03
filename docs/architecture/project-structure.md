# batch-console 项目结构

> 2026-06-03 整理。Vue 3 + TypeScript + Pinia + Element Plus 控制面前端,桌面 + 移动端双端。

## 顶层结构

```
batch-console/
├── src/                       源码(见下)
├── e2e/                       Playwright e2e 测试(~97 spec)
├── e2e-data/                  e2e 用 fixture
├── public/                    静态资源(favicon / robots / manifest)
├── nginx/                     prod Nginx 配置
├── docs/                      文档体系(见下)
├── scripts/                   工程脚本(见下)
├── tools/docs-bridge/         docs 跨仓桥接工具
├── dist/                      build 产物(.gitignore)
├── playwright-report/         e2e 报告(.gitignore)
│
├── index.html                 SPA 入口
├── package.json               依赖 + npm scripts
├── vite.config.ts             Vite 配置
├── tsconfig.json              TypeScript 配置
├── eslint.config.js           ESLint 9 配置
├── playwright.config.cjs      Playwright 配置
├── Dockerfile                 容器镜像
├── docker-compose.yml         本地编排
├── nginx/                     prod 反代配置
├── Makefile                   常用任务 alias
├── CLAUDE.md                  项目红线 + 关键路径(权威)
└── CHANGELOG.md               发布日志(release-please 维护)
```

## src/ 子目录

```
src/
├── api/              69  REST 客户端 + 类型(per-domain,如 alertsQuery / jobInstance)
├── stores/           11  Pinia stores(auth / theme / mobileBadges / ...)
├── router/            1  Vue Router 路由表
├── views/           103  桌面页面(L1 模块:job / workflow / alert / config / system / ...)
├── views-mobile/     11  移动端页面(/m/*)
├── layout/            5  桌面 layout(DefaultLayout / LayoutHeader / LayoutSidebar / ...)
├── layout-mobile/    11  移动端 layout(MobileLayout / MobileTabBar / MobileAppBar / ...)
├── components/       45  跨页通用组件(ProTable / DataState / TraceIdCell / ...)
├── composables/      47  Vue 3 组合式函数(useRouteFilters / useResponsive / useDirtyForm / ...)
├── locales/           4  i18n 文件(zh-CN / en-US 1:1 必须对齐)
├── styles/            5  全局样式 + tokens(z-index.css / dark theme / mobile-common)
├── charts/            1  ECharts 配色与封装
├── constants/        10  枚举常量(severity / status / role / ...)
├── directives/        7  自定义指令(v-permission / v-track / ...)
├── types/             6  共享 TypeScript 类型
└── utils/            43  纯函数工具(fmtRelative / clipboard / ...)
```

## 模块划分(views/)

| L1 模块 | 路由前缀 | 一句话职责 |
|---|---|---|
| `job` | `/job/*` | Job 定义 / Job 实例 / 历史 |
| `workflow` | `/workflow/*` | Workflow DAG 编排 / Run / 节点干预 |
| `observability` | `/obs/*` | Alert / Outbox / Trace / Metrics |
| `ops` | `/ops/*` | BatchDayReplay / 数据对账 / Forensic 导出 |
| `approvals` | `/approvals/*` | 审批列表 / 批量审批 / 历史 |
| `config` | `/config/*` | 配置发布 / Schema / 字典 |
| `system` | `/system/*` | 租户 / 用户 / RBAC / API Key / 通知通道 |
| `auth` | `/login` / `/init` | 登录 / 初始化 |
| `m/*` | `/m/*` | 移动端入口(双栈不共用 view) |

## 关键 composable / 基建

| 名字 | 用途 |
|---|---|
| `useRouteFilters` | List 页 filters + page + pageSize 写入 URL query |
| `useResponsive` | `matchMedia` 响应式断点(mobile / tablet / desktop) |
| `useDirtyForm` | Form 改动追踪 + `beforeunload` + Dialog before-close 弹 confirm |
| `useFormFocus` | Dialog/Drawer open autofocus 第一字段;validate fail focus 第一 error |
| `useFormValidate` | 统一 form 校验(收集错误 → useFormFocus 接力) |
| `useDangerConfirm` | 高危 ops 二次确认(打字校验 / 长按) |
| `useWebPush` | Web Push 注册 / 解绑(VAPID) |
| `useOpsSummary` | 运营总览数据聚合 |
| `useAsyncAction` | 异步动作 loading / error / retry 包装 |

## docs/ 体系

```
docs/
├── README.md                  文档入口
├── changelog.md               重要架构 / 约定变更日志
├── 批量调度系统前端方案设计说明书_开发落地版_V3.md  最早设计稿(归 design/)
├── fe-wrapper-migration-plan.md                  wrapper 迁移计划(归 design/)
│
├── api/                       OpenAPI 同步 / API 漂移检查
├── archive/                   历史归档(4 月旧 audit / 已失效方案)
├── backlog/                   待办 / acceptance
├── deploy/                    部署文档(docker-nginx)
├── design/                    设计文档(meta-enum / mobile-refresh / 可观测性 / 文档中心)
├── qa/                        QA 阶段总评(D 档等)
├── reports/                   评审 / 扫描历史报告
├── runbook/                   运维手册(ci / dev-workflow / rollback / 联测)
├── ui/                        UI / UX audit
└── verifications/             验证记录(CD / e2e)
```

## scripts/ 体系

```
scripts/
├── check-api-drift.sh      检查 BE OpenAPI 与 FE 类型漂移
├── check-i18n-messages.mjs  zh-CN / en-US 1:1 对齐校验
├── ci.sh                   CI 入口(lint + type-check + test + build)
├── dev-server.sh           本地 dev 启动
├── docs-prepare.mjs        docs 跨仓 sync 预处理
├── gen-pwa-icons.mjs       PWA 图标生成
├── prepare.mjs             postinstall 钩子(husky / 等)
├── test-e2e.sh             Playwright e2e 入口
├── test-unit.sh            Vitest 单测入口
└── local/                  本地特定
    ├── fe-acceptance.sh    本地 acceptance 入口
    ├── health-check.sh     dev server 健康检查
    └── sync-from-main.sh / sync-main.sh    跨仓 main 同步
```

## 关键约束(详 [`../../CLAUDE.md`](../../CLAUDE.md))

- **i18n 强制双语**:zh-CN / en-US `messages.ts` 1:1;`check-i18n-messages.mjs` 守护
- **禁硬编码中文**:UI 文本走 `t('key')`(JobDefinitionList 历史违例已修)
- **桌面 / 移动双栈**:`/m/*` 路径独立 view,不与桌面 view 共用(避免响应式条件分支地狱)
- **Pinia store**:只放跨页状态(auth / theme / mobileBadges);页内状态用 ref / composable
- **API 错误处理**:`api/interceptors.ts` 统一 401 三态 / 404 BizException / 409 IDEMPOTENT_REPLAY 静默
- **OpenAPI 同步**:BE 改 controller 必须同 PR 改 `docs/api/console-api.openapi.yaml`,FE 端 `check-api-drift.sh` 兜底

## 构建命令

| npm script | 用途 |
|---|---|
| `npm run dev` | Vite dev server(默认 http://localhost:5173) |
| `npm run build` | 生产打包 → `dist/` |
| `npm run preview` | 本地预览 build 产物 |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run type-check` | tsc 类型检查 |
| `npm run test:unit` | Vitest 单测 |
| `npm run test:e2e` | Playwright e2e |
| `npm run test:e2e:smoke` | 冒烟子集 |

## 分支策略(与 BE 一致)

| 分支 | 用途 |
|---|---|
| `main` | 唯一发布分支 |
| `feature/<topic>` | 业务 / bug fix(PR → main) |
| `fix/<topic>` | bug 修复(PR → main) |
| `docs/<topic>` | 纯文档(PR → main) |
| `cleanup/<topic>` | 规范化清理(PR → main) |
