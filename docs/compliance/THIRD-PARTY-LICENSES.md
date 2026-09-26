# 前端第三方软件使用声明

**Product**: `batch-console`
**Version**: `1.0.0`
**License**: `Apache-2.0`
**Generated**: `2026-09-26`
**Source**: `package.json` + `package-lock.json`

本文档是前端仓库第三方 npm 组件的人工可读快照。机器可读 SBOM 见 [sbom.json](./sbom.json)。

## 摘要

| Item | Count |
|---|---:|
| Runtime direct dependencies | 30 |
| Development direct dependencies | 34 |
| Resolved lockfile components | 937 |

## 许可证分布

| License | Component count |
|---|---:|
| (MIT OR CC0-1.0) | 1 |
| (MPL-2.0 OR Apache-2.0) | 1 |
| 0BSD | 1 |
| Apache-2.0 | 28 |
| Apache-2.0 WITH LLVM-exception | 1 |
| BlueOak-1.0.0 | 8 |
| BSD-2-Clause | 13 |
| BSD-3-Clause | 15 |
| CC-BY-4.0 | 1 |
| CC0-1.0 | 2 |
| ISC | 60 |
| MIT | 785 |
| MIT-0 | 2 |
| MPL-2.0 | 14 |
| NOASSERTION | 1 |
| OFL-1.1 | 2 |
| Python-2.0 | 1 |
| Unlicense | 1 |

## 运行时直接依赖

| Package | Version range |
|---|---|
| `@antv/x6` | `^3.1.7` |
| `@antv/x6-vue-shape` | `^3.0.2` |
| `@codemirror/autocomplete` | `^6.20.2` |
| `@codemirror/commands` | `^6.10.3` |
| `@codemirror/lang-json` | `^6.0.2` |
| `@codemirror/language` | `^6.12.3` |
| `@codemirror/lint` | `^6.9.6` |
| `@codemirror/search` | `^6.7.0` |
| `@codemirror/state` | `^6.6.0` |
| `@codemirror/view` | `^6.42.1` |
| `@fontsource/ibm-plex-mono` | `^5.2.7` |
| `@fontsource/ibm-plex-sans` | `^5.2.8` |
| `@sentry/vue` | `^10.52.0` |
| `@tanstack/vue-query` | `^5.96.1` |
| `axios` | `^1.16.1` |
| `codemirror` | `^6.0.2` |
| `cronstrue` | `^3.14.0` |
| `dompurify` | `^3.4.0` |
| `driver.js` | `^1.4.0` |
| `echarts` | `^6.0.0` |
| `element-plus` | `^2.14.6` |
| `json-bigint` | `^1.0.0` |
| `lucide-vue-next` | `^1.0.0` |
| `pinia` | `^3.0.4` |
| `svg-pan-zoom` | `^3.6.2` |
| `vue` | `^3.5.13` |
| `vue-echarts` | `^8.0.1` |
| `vue-i18n` | `^11.4.4` |
| `vue-router` | `^5.0.7` |
| `web-vitals` | `^5.2.0` |

## 开发期直接依赖

| Package | Version range |
|---|---|
| `@axe-core/playwright` | `^4.11.3` |
| `@element-plus/icons-vue` | `^2.3.2` |
| `@playwright/test` | `^1.60.0` |
| `@types/dagre` | `^0.7.54` |
| `@types/json-bigint` | `^1.0.4` |
| `@typescript-eslint/eslint-plugin` | `^8.18.0` |
| `@typescript-eslint/parser` | `^8.18.0` |
| `@vitejs/plugin-vue` | `^6.0.7` |
| `@vitest/coverage-v8` | `^4.1.7` |
| `@vue/test-utils` | `^2.4.10` |
| `@vue/tsconfig` | `^0.9.1` |
| `concurrently` | `^9.2.1` |
| `dagre` | `^0.8.5` |
| `esbuild` | `^0.28.0` |
| `eslint` | `^10.4.1` |
| `eslint-config-prettier` | `^10.1.8` |
| `eslint-plugin-vue` | `^10.9.1` |
| `globals` | `^17.6.0` |
| `husky` | `^9.1.7` |
| `jsdom` | `^29.1.1` |
| `lint-staged` | `^17.0.5` |
| `mermaid` | `^11.14.0` |
| `openapi-typescript` | `^7.4.4` |
| `prettier` | `^3.8.3` |
| `typescript` | `^6.0.3` |
| `unplugin-auto-import` | `^21.0.0` |
| `unplugin-vue-components` | `^32.1.0` |
| `vite` | `^8.0.14` |
| `vite-plugin-pwa` | `^1.3.0` |
| `vitepress` | `^1.6.4` |
| `vitepress-plugin-mermaid` | `^2.0.17` |
| `vitest` | `^4.1.7` |
| `vue-eslint-parser` | `^10.4.0` |
| `vue-tsc` | `^3.3.1` |

## 许可证风险说明

- 当前清单未发现 AGPL / GPL / SSPL / BUSL 等强 copyleft 或商业限制类红线许可证。
- `NOASSERTION` 表示 lockfile 中没有提供明确许可证字段，需在合规审计或发布前人工复核。
- 字体、测试工具、构建工具和运行时库均纳入 lockfile 级 SBOM；是否进入生产镜像取决于构建产物和 Dockerfile。

## 重新生成

```bash
npm run compliance:sbom
```

生成的 SBOM 使用 CycloneDX 1.6 JSON 格式,用于仓库合规审查和发布制品留档。修改 `package.json` 或 `package-lock.json` 后必须重新生成。
