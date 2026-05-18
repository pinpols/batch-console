# 前端深度扫描报告 V2 — 2026-05-16

**触发**:V1 报告(2026-05-15)交付后用户要求"再做一轮深度扫描分析问题修复"。
**范围**:ESLint / 死代码 / a11y / 生命周期泄漏 / 代码坏味 / 重复 import / 大文件 / unhandled rejection。

---

## 一、修复清单(本轮已做)

| # | 问题 | 修法 | 文件 |
|---|---|---|---|
| 1 | DefaultLayout 退出全屏 icon-only 按钮无 aria-label,tooltip 文案硬中文 | 改 `t()` + 加 `aria-label` + 新 i18n key `layoutHeader.exitFullscreenTooltip` | [src/layout/DefaultLayout.vue](src/layout/DefaultLayout.vue#L11) |
| 2 | LayoutHeader 折叠按钮 icon-only 无 aria-label(screen reader 不读 tooltip) | 加 `:aria-label="..."`,与 tooltip 内容同步 | [src/layout/components/LayoutHeader.vue](src/layout/components/LayoutHeader.vue#L9) |
| 3 | JobInstanceDetail.vue `void load().then(...)` 无 `.catch`,load reject 会触发 unhandled rejection | 改用 `load().then(...).catch(() => {})`,内部已 toast | [src/views/monitor/JobInstanceDetail.vue:497](src/views/monitor/JobInstanceDetail.vue#L497) |

i18n 新增 keys: `layoutHeader.exitFullscreenTooltip`(zh+en)。

---

## 二、扫描结果分类

### ESLint(src/)

```
✅ 0 errors, 0 warnings
```

`docs-site/` 下有 1 error + 15 warnings,**全部在 vitepress 缓存的第三方 chunk 里**(`docs-site/.vitepress/cache/deps/*`),不属于本项目代码,忽略。

### TypeScript

未重测(V1 已确认 useI18n shim 后 0 关键错误,80 个预存非阻塞错误未做)。

### 死代码(knip 扫描)

```
24 unused exports + 13 unused exported types
```

分布:
- **API 方法 18 个**(`api/system.ts`、`api/observabilityQueries.ts` 等):大概率是 codegen 模板留的未来端点;**删除有风险**(下次 regen 又被加回)
- **`utils/logger.ts: reinitLogger`**:knip 误判,实际挂 `window.__reinitLogger` 给 devtools 用 — **保留**
- **`useChartOptions.ts` 7 个 helper export**:真死代码(仅同文件内部使用),改为非 export 可减少 API 面 — 工时 < 10min 但**优先级低,放下迭代**
- **类型导出 13 个**:多数是 `console-api.ts` / `types/index.ts` 的 facade 类型,删除影响下游 — **保留**

**结论**:不在本轮处理,作为 backlog。

### 可访问性 a11y

```
扫描:60+ .vue 文件的 <button> / <img> / <input>
issues 发现:2 处(均已修)
```

| 文件 | 问题 |
|---|---|
| `DefaultLayout.vue:13` | 退出全屏按钮 icon-only 无 aria-label;tooltip 文案硬编码中文 |
| `LayoutHeader.vue:9` | 侧边栏折叠按钮 icon-only 无 aria-label |

其它 60+ 文件:所有 icon-only 按钮都已加 `aria-label` 或 `title`,通过 ✅。

### 生命周期泄漏(addEventListener / setInterval cleanup)

```
扫描:全部 .vue + .ts
发现:0 真问题
```

3 个 addEventListener 出现处:
- `main.ts` × 3 全局 error/unhandledrejection/visibilitychange — app 生命周期常驻,**正确**
- `api/stream.ts:99` EventSource listener — `es.close()` 自动释放,**正确**
- `WorkflowMermaidViewer.vue:242` 节点 click — DOM 节点 GC 时释放,有 `onBeforeUnmount`,**正确**

### 代码坏味

| 类别 | 命中 | 真问题 |
|---|---|---|
| `await` in for-of loop | 3 处 | **0**(全部有明确注释"BE 没批量端点,顺序串行避免压垮") |
| `console.log` 残留 | 0 | 0 |
| `TODO / FIXME / XXX` | 1 | 0(假阳性,字符串里出现 `"POST /api/xxx → 500"` 的 `xxx` 占位符) |
| `unhandled .then` | 15 个 .then 无 .catch | **1 真问题**(JobInstanceDetail:497,已修) |
|        | 其余 14 都是 `api(...).then(normalize)` 模式,返回 Promise 给调用方 await,**不是 fire-and-forget** | |

### 重复 import 同模块

```
25 个文件 element-plus / vue / api 重复 import
```

全部模式:`import { value }` + `import type { type }` 拆分。**TS verbatimModuleSyntax 推荐写法,不动**。

### 大文件(LOC)

```
QueueConfig.vue          1208
JobDefinitionList.vue    1003
FileTemplateList.vue      874
TenantPackageImportWizard 800
```

存量 4 个文件超 800 行,历史拆分债务。**不在本轮范围**,优化模式参考 ADR-30 (workspace decomposition)。

### v-for 缺 `:key`

```
扫描:全部 .vue template
发现:0
```

✅ Vue 3 最佳实践全部满足。

---

## 三、本轮 + V1 累计已修复

| 类别 | 数量 |
|---|---|
| TS errors useI18n | 112 → 0 |
| i18n missing page keys | 4 → 0 |
| i18n 裸中文(模板) | 2 → 0 |
| 路由 redirect any 入参 | 1 → 0 |
| a11y icon-only 无 aria-label | 2 → 0 |
| unhandled rejection | 1 → 0 |
| ESLint warnings (src) | 0 |
| v-for 缺 key | 0 |
| 生命周期泄漏 | 0 |
| 真坏味 | 0 |

---

## 四、剩余 backlog(无阻塞,可选)

### 🟡 中

1. **F-1 后端 Set-Cookie 未实现** — 阻 SPA 实际登录(V1 已升级)
2. **80 个预存 TS 错误**(ProTable / VirtualProTable / WorkerManagement / X6 / 测试) — 独立 PR
3. **死代码 knip 标记 37 项** — 单独"清理 PR",但有 codegen 风险

### 🟢 低

4. **大文件拆分**(QueueConfig 1208 / JobDefinitionList 1003 等) — 仿照 TenantList 845→375 拆分模式,工时大
5. **useChartOptions 内部 helper 改非 export** — 10min 小事,可顺手做

### 🔵 不建议本轮做

- 测试代码 TS 类型(25+ 错误) — 测试改 import 即可,工时长不阻塞
- @antv/x6 dual-package 类型问题(useWorkflowGraph 3 处) — 需库升级或 shim

---

## 五、文件改动汇总(本轮)

| 文件 | 改动 |
|---|---|
| `src/layout/DefaultLayout.vue` | tooltip 硬中文 → `t()`、按钮加 `aria-label`、引入 useI18n |
| `src/layout/components/LayoutHeader.vue` | 折叠按钮加 `aria-label` |
| `src/views/monitor/JobInstanceDetail.vue` | `void load().then(...)` → `.then(...).catch(noop)` 防 unhandled rejection |
| `src/locales/zh-CN.ts` | 加 `layoutHeader.exitFullscreenTooltip` |
| `src/locales/en-US.ts` | 同步 |

---

## 六、交付结论

**整体质量**:
- ✅ Lint 0 problem(src/)
- ✅ 模板裸中文 0 残留
- ✅ a11y 主交互按钮全有 aria-label
- ✅ 无 unhandled rejection / 资源泄漏
- ✅ i18n key 双语对称 2850/2850
- 🔴 后端 Cookie 未对接(阻塞 SPA 登录,前端不应单独修)

**距 "production-ready" 还差**:F-1 后端联调。其它都是边缘改进。
