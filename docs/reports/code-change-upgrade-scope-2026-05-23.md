# 需要改主代码的升级范围评估 — 2026-05-23

> 配套 [`dependency-upgrade-evaluation-2026-05-23.md`](./dependency-upgrade-evaluation-2026-05-23.md) §6.3 "跳过项" 的二次评估。
>
> 评估目的:为每项"需要改主代码"的升级给出**具体文件清单 / 风险评级 / 工程量预估**。
>
> 评估口径:数据基于 2026-05-23 当日仓库扫描。

## TL;DR

| 项 | 影响文件数 | 风险 | 工程量 | 推荐 |
|---|---|---|---|---|
| **Pinia 2 → 3** | 7 store + 4 test | 低 | 半天 | 🟢 可做 |
| **Vue Router 4 → 5** | 1 文件(`router/index.ts`,829 行) | 低 | 1-2 小时 | 🟢 可做 |
| **Vue-i18n 9 → 11** | 0 配置改 + 模板 audit | 低-中 | 半天-1 天 | 🟢 比预期简单(已 `legacy: false`) |
| **TypeScript 5 → 6 + vue-tsc 3** | 154 .vue + ~200 .ts | 中-高 | 1-2 天 | 🟡 先 dry-run 看错误数 |
| **Vite 7 → 8** | `vite.config.ts` + 插件兼容性 | 高 | 等生态 | 🔴 暂不做(vite-plugin-pwa 未适配) |

跨仓相关项(BE okhttp / jsqlparser / Spring AI)详见 [`../../../file-batch-system/docs/analysis/code-change-upgrade-scope-2026-05-23.md`](../../../file-batch-system/docs/analysis/code-change-upgrade-scope-2026-05-23.md)。

---

## 1. Pinia 2 → 3

| 文件 | 类型 |
|---|---|
| `src/stores/app.ts` `auth.ts` `mobileBadges.ts` `permission.ts` `routeProgress.ts` `tabs.ts` `tenant.ts` | 主代码 7 个 |
| `src/stores/auth.test.ts` `permission.test.ts` `tabs.test.ts` `tenant.test.ts` | 测试 4 个 |

**Breaking 摘要**:
- Vue 2 支持移除(你纯 Vue 3.5 → 零影响)
- `defineStore` 类型推断更严
- HMR 内部重构(对业务无影响)
- SSR 部分 API 微调(不用 SSR → 免疫)

**风险**:低。你已用现代 setup-store 写法,Pinia 2→3 主体兼容。

**工程量**:install + typecheck + 跑 11 store 测试,半天。

**推荐**:🟢 **可做**

---

## 2. Vue Router 4 → 5

| 项 | 现状 |
|---|---|
| 文件 | `src/router/index.ts`(单文件,829 行) |
| catchall | 已是 `path: '/:pathMatch(.*)*'`(v4 写法,v5 直接兼容) |

**Breaking 摘要**:
- `*` 通配 → 已经是 v5 兼容写法
- Navigation guard 类型签名收紧
- `useRoute()` 返回类型微调
- Vue 2 移除(免疫)

**风险**:低。

**工程量**:install + typecheck + 修少量 guard 类型,1-2 小时。

**推荐**:🟢 **可做**

---

## 3. Vue-i18n 9 → 11

| 项 | 现状 |
|---|---|
| `createI18n` 配置 | 已 `legacy: false`(composition API mode) |
| `.vue` 文件 | 154 |
| `t(...)` 调用 | 3169 处 |

**关键发现**:你已经用 composition API,**v10 删除 legacy mode 对你零影响**。

**Breaking 摘要**:
- legacy mode 删除 → 已 `legacy: false`,免疫
- `t()` 返回类型收紧(`string` 替代联合类型)
- 数字/日期 format API 调整(不用就免疫)
- 复数规则微调

**风险**:**比预期低**。3169 处 `t()` 大部分零影响,可能少数 TS 类型不匹配要修。

**工程量**:install + typecheck + 修少量 type 错误,半天到 1 天。

**推荐**:🟢 **可做** — "全仓 audit"的担心因 composition API 已用而消解

---

## 4. TypeScript 5 → 6 + vue-tsc 2 → 3

| 项 | 规模 |
|---|---|
| `.vue` 文件 | 154 |
| `.ts` 文件(src/) | ~200 |
| 当前 `tsc --version` | 5.9.3 |

**Breaking 摘要**:
- TS 6 默认更严:`noImplicitOverride` / `useUnknownInCatchVariables` / `exactOptionalPropertyTypes` 部分场景
- 部分 deprecated flag 移除
- `vue-tsc` 3 用 Volar 3.0,SFC 模板类型推断更严

**风险**:**中-高,但完全可控**。typecheck 报新错不影响运行;大部分加显式类型/`as` 即可,< 5% 要重构。

**工程量**:**1-2 天**(具体看实际错误条数)

**评估方法**:
```bash
# 临时试装,不写入 package.json
npm i typescript@6 vue-tsc@3 --no-save
npm run typecheck 2>&1 | grep -c "error TS"
# 然后 git restore package.json package-lock.json && npm ci 撤回
```

**推荐**:🟡 **先 dry-run 数错误**,基于实际数字再决定是否排期

---

## 5. Vite 7 → 8

**已知阻塞**(2026-05-23 当日实测):
1. Rolldown bundler 成默认 → `manualChunks` API 微调(本会话已处理为 function 形式)
2. `esbuild` 不再 bundled → 需显式 `npm i esbuild`
3. `transformWithEsbuild` deprecated → `vite-plugin-pwa` 等第三方插件**仍依赖该 API**

**关键插件适配状态**(2026-05-23 快照):

| 插件 | Vite 8 适配? |
|---|---|
| `vite-plugin-pwa` 1.3.0 | ❌ 用 deprecated `transformWithEsbuild` |
| `@vitejs/plugin-vue` 6.0.7 | ✅(但要配套 Vite 8) |
| `vitest` 4.1.7 | ✅ |
| `unplugin-vue-components` 32.x / `unplugin-auto-import` 21.x | ✅ |

**风险**:**高** — PWA(离线缓存 + SW 推送)是核心,不能因升 Vite 8 牺牲

**推荐**:🔴 **暂不做** — 等 `vite-plugin-pwa` 适配(预计 1-3 个月再 review)

---

## 综合排期建议(FE 视角)

### Phase A:1-2 天内可单独 PR(低风险,推荐近期做)
- 🟢 **Pinia 2 → 3**(半天)
- 🟢 **Vue Router 4 → 5**(1-2 小时)
- 🟢 **Vue-i18n 9 → 11**(半天)

3 个一起做 ~1 天,FE 主框架生态对齐 Vue 3.5+ 主流。

### Phase B:有专门时间窗口
- 🟡 **TypeScript 5 → 6 + vue-tsc 3**(先 dry-run 数错误条数)

### Phase C:等生态适配
- 🔴 **Vite 7 → 8**(等 vite-plugin-pwa 适配)
