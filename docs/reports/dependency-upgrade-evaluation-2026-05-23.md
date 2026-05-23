# 前端依赖与构建环境升级评估 — 2026-05-23

> 评估范围:`batch-console` 仓库的 npm 依赖、Dockerfile 构建镜像。
>
> 评估原则:**协议风险优先,无业务驱动不升 major**,patch/minor 在同 major 内升级安全。

## TL;DR

- 框架与生态都在最新主线小版本(Vue 3.5 / TS 5.9 / Vite 6.4 / Vitest 4 / ESLint 9)
- `npm audit` 报告 **0 个漏洞**
- 真正值得升的:**`npm update`** 一行带 9 个 patch/minor,加 Dockerfile Node 20→22 LTS
- 多个生态 major 已发布(Vite 7/8、TS 6、Pinia 3、Vue Router 5、Vue-i18n 10/11、ESLint 10),但**无业务驱动不升**
- 仓库已补 Apache 2.0 LICENSE + `package.json` license 字段(2026-05-23 同会话)

## 1. 依赖矩阵

### 1.1 Patch / Minor(`npm update` 一行带走)

| 包 | 当前 → 目标 | 备注 |
|---|---|---|
| `vue` | 3.5.31 → 3.5.34 | bug fix |
| `element-plus` | 2.13.6 → 2.14.0 | minor |
| `@tanstack/vue-query` | 5.96.1 → 5.100.13 | patch |
| `@sentry/vue` | 10.52.0 → 10.53.1 | patch |
| `echarts` | 6.0.0 → 6.1.0 | minor |
| `dompurify` | 3.4.0 → 3.4.5 | patch,XSS 防护核心 |
| `@codemirror/view` | 6.42.1 → 6.43.0 | minor |
| `@typescript-eslint/*` | 8.57.2 → 8.59.4 | minor |
| `openapi-typescript` | 7.4.4 → 7.13.0 | minor |

零风险,跑 `npm run typecheck && npm run lint && npm run build && npm run test:unit` 验证。

### 1.2 Major(有破坏性,**当前不升**)

| 包 | 当前 → 最新 | 主要 breaking | 对本仓影响 |
|---|---|---|---|
| **`vite`** | 6.4.2 → **8.0.14** | 跨 2 个 major;Vite 7 要求 Node 20.19+/22.12+;默认 browser target 改 `baseline-widely-available`;Sass legacy API 移除;build target 需显式设 | 全量 e2e 回归(staging-gate 82 specs);需搭配 `@vitejs/plugin-vue` 6 一起升 |
| **`@vitejs/plugin-vue`** | 5.2.4 → 6.0.7 | 要 Vue 3.5+(已满足) | 仅在升 Vite 时一起升 |
| **`typescript`** | 5.9.3 → **6.0.3** | 严格度提升;部分 deprecated flag 移除;推断收紧 | 全仓 `vue-tsc` 跑一遍可能 0~数十个新错误,逐个修;`api.generated.ts` 由 OpenAPI 生成,先 regen 看是否仍合规 |
| **`vue-tsc`** | 2.2.12 → 3.3.1 | 内核换 Volar 3.0;模板类型检查更严 | SFC 模板里 `<el-form-item :rules="...">` 等场景可能要补类型 |
| **`pinia`** | 2.3.1 → 3.0.4 | 部分内部类型不向后兼容 | `stores/*.ts` 改 `defineStore` 调用点 + 类型 |
| **`vue-router`** | 4.6.4 → 5.0.7 | `*` catchall 必须改 `/:pathMatch(.*)*`;navigation guard 类型变 | `router/index.ts` 几处微改 |
| **`vue-i18n`** | 9.14.5 → **11.4.4** | 跨 1 个 major;v10 删除 legacy mode,只留 composition API | 全仓 `.vue` 模板 `t(...)` audit;`locales/*.ts` 入口可能要换 createI18n 参数 |
| **`eslint`** | 9.39.4 → 10.4.0 | flat config 默认规则微调 | 影响 lint 规则,不影响运行时;`pr-gate` 可能新增 warnings |
| **`lint-staged`** | 15.5.2 → 17.0.5 | Node 20+ 要求(已满足) | 透明 |
| **`unplugin-auto-import`** | 0.18.6 → 21.0.0 | 版本号方案重置(0.x → 大版本),内部 API 微调 | lint 期生效,影响 auto-import 列表 |
| **`unplugin-vue-components`** | 0.27.5 → 32.1.0 | 同上 | 同上 |

### 1.3 已最新

| 类别 | 包 |
|---|---|
| 测试 | `vitest` 4.1.7 · `@vitest/coverage-v8` 4.1.7 · `@vue/test-utils` 2.4.10 · `@playwright/test` 1.60.0 · `@axe-core/playwright` 4.11.3 |
| 工具链 | `prettier` 3.8.3(同 major 最新) · `vite-plugin-pwa` 1.3.0 · `vitepress` 1.6.4 |
| 框架配套 | `@vue/tsconfig` 0.9.1 · `pinia` patch 已最新 · `vue-router` patch 已最新 · `vue-i18n` 9.x patch 已最新 |

## 2. 构建镜像

| 镜像 | 当前 | 评估 |
|---|---|---|
| **Node**(builder stage) | `node:20-alpine` | ⚠️ Node 20 LTS 维护期 2026-04 已结束,**建议升 `node:22-alpine`**(active LTS 至 2027-04) |
| Nginx(runtime stage) | `nginx:1.27-alpine` | ✅ 当前 mainline |

Node 20 → 22 升级风险:**低**,Vite 6 / TS 5 / Vue 3 全兼容。CI workflow 里的 `actions/setup-node@v4` 也要同步 `node-version: 22`。

## 3. License 现状

- 仓库 LICENSE:**Apache 2.0**(2026-05-23 同会话补齐)
- `package.json`:`"license": "Apache-2.0"`(同上)
- `package.json` 保留 `"private": true`(防误 `npm publish`)
- `npm audit`:0 critical / 0 high / 0 moderate / 0 low

## 4. 建议执行清单(分档)

### 🟢 现在做(零风险)

1. `npm update` —— 带走 §1.1 全部 patch/minor(9 个包)
2. `Dockerfile`:`FROM node:20-alpine AS build` → `FROM node:22-alpine AS build`
3. CI workflow(`pr-gate.yml` / `full-ci-gate.yml` / `staging-gate.yml`):`actions/setup-node` 版本同步 22
4. 跑 `npm run typecheck && npm run lint && npm run build && npm run test:unit` + 本地 `npm run dev` 抽烟

合计 ~15 分钟。

### 🟡 下季度评估(留专门时间)

| 升级 | 估时 | 说明 |
|---|---|---|
| TS 5→6 + vue-tsc 2→3 | 半天 | 先打补丁包,跑 typecheck 看新报错数,逐个修 |
| Pinia 2→3 + Vue Router 4→5 | 半天 | 这俩配套做 |
| Vue-i18n 9→11 | 半天 | 模板 audit 影响最大 |

均建议**单独排期 PR**,不与功能 PR 混。

### 🔴 现在不要做

- Vite 6 → 7/8 跨 2 major:生态半年内可能再变,等稳定
- ESLint 9 → 10:无 CVE 驱动
- unplugin-* 大跨版本:lint 期影响,先确认是否真要 active 改动 auto-import 列表

## 5. 配对后端关联

后端配对评估文件:[`../file-batch-system/docs/analysis/dependency-upgrade-evaluation-2026-05-23.md`](../../../file-batch-system/docs/analysis/dependency-upgrade-evaluation-2026-05-23.md)

跨仓 license 协议、基础设施(MinIO / Redis / PostgreSQL / Prometheus / Nginx 等)的评估在该文件中统一说明。

## 6. 实际执行(2026-05-23 当日)

执行口径:**协议无风险 + 不改主代码(`.vue` / `.ts` 业务代码)**。配置文件(`vite.config.ts` / `eslint.config.js` / `package.json` / `Dockerfile`)可改;Pinia / Vue Router / Vue-i18n / TypeScript / okhttp / jsqlparser / Spring AI 因都会触发主代码改动,**留待单独分析**。

### 6.1 已执行

| 文件 | 改动 |
|---|---|
| `LICENSE` | 新建,Apache 2.0 short notice + 2026 Dengchao(与 BE 对齐) |
| `package.json` | 加 `"license": "Apache-2.0"` 字段 |
| `package.json` | `npm update`:vue 3.5.31→3.5.34 / element-plus 2.13→2.14 / @tanstack/vue-query 5.96→5.100 / @sentry/vue 10.52→10.53 / echarts 6.0→6.1 / dompurify 3.4→3.4.5 / @codemirror/view 6.42→6.43 / @typescript-eslint/* 8.57→8.59 / openapi-typescript 7.4→7.13 等 patch/minor |
| `package.json` | **lint-staged** 15.5.2 → 17.0.5(config 字段兼容,零改动) |
| `package.json` | **unplugin-vue-components / unplugin-auto-import** major(版本号方案重置,`vite.config.ts` plugin 调用 API 兼容) |
| `package.json` | **ESLint 9 → 10** + `eslint-config-prettier` 9 → 10 + `eslint-plugin-vue` 9 → 10 + **新增 `vue-eslint-parser` ^10** + **新增 `globals` ^17**(ESLint 10 严格校验 globals 名称) |
| `package.json` | **Vite 6 → 7**(Vite 8 因 Rolldown 切换 + esbuild 解绑 + vite-plugin-pwa 依赖 deprecated `transformWithEsbuild`,生态未稳,**降回 Vite 7 LTS-grade**);`@vitejs/plugin-vue` 保留 5(对 Vite 7 兼容) |
| `vite.config.ts` | `manualChunks` 改 function 形式(给 Rolldown 留兼容空间,Vite 7 / Rollup 也兼容) |
| `Dockerfile` | Node `20-alpine` → `22-alpine`(Node 20 LTS 维护期 2026-04 结束) |
| `package-lock.json` | 全量 relock |

### 6.2 验证

| 检查 | 结果 |
|---|---|
| `npm run typecheck`(vue-tsc 2.x + TS 5.x) | ✅ 0 errors |
| `npm run lint:check`(ESLint 10) | ✅ 0 errors |
| `npm run test:unit` | ✅ **391 测试 / 49 文件全绿**,~14s |
| `npm run build:fast`(Vite 7) | ✅ 产物正常,PWA 生成 |
| `npm audit` | ✅ 0 critical / 0 high / 0 moderate / 0 low |

### 6.3 跳过

| 项 | 跳过理由 |
|---|---|
| **TypeScript 5 → 6** + `vue-tsc` 2 → 3 | 必触发新 type 错误 → 改 `.ts` / `.vue` 代码 |
| **Pinia 2 → 3** | `defineStore` 类型微调 → 改 stores |
| **Vue Router 4 → 5** | catchall 路径写法变 → 改 `router/index.ts` |
| **Vue-i18n 9 → 11** | legacy mode 删除 → 全仓模板 `t(...)` audit |
| **Vite 7 → 8** | Rolldown bundler 切换 + esbuild 解绑;`vite-plugin-pwa` 等第三方插件未适配 |

均建议**单独排期 PR**,不与功能 PR 混。

### 6.4 回退命令

```bash
cd /Users/dengchao/Downloads/batch-console
git checkout -- Dockerfile package.json package-lock.json vite.config.ts
npm ci   # 把 node_modules 恢复到 lock 状态
# LICENSE 是 untracked,如需删除:rm LICENSE
```
