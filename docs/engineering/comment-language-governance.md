# 前端注释语言治理

## 目标

手写代码中的解释性注释统一使用中文，降低业务规则、异常处理和兼容边界的理解成本。技术标识保持权威原文，避免翻译后与代码、协议或工具行为脱节。

## 适用范围

门禁检查以下手写代码：

- `src/` 下的 TypeScript、Vue 和 CSS。
- `e2e/` 下的 Playwright 测试与辅助代码。
- `scripts/` 下的 JavaScript、TypeScript 和 Shell 脚本。
- 根目录的 ESLint、Vite 和 Playwright 配置。

OpenAPI 生成类型、自动导入声明和组件声明属于生成文件，不在检查范围内。

## 语言规则

以下内容必须用中文说明：

- 业务意图、设计原因和数据边界。
- 异常处理、降级、兼容和回退逻辑。
- 测试场景、断言目的和夹具约束。
- 布局分区、操作流程和维护提示。

以下内容可以保留原文：

- API 路径、类型名、字段名、枚举值和协议名。
- 命令、环境变量、代码示例和文件路径。
- `@ts-check`、ESLint、Prettier、Vitest、ShellCheck 等工具指令。
- JSDoc 标签和生成文件中的固定声明。

推荐采用中文解释加原始技术标识，例如：

```ts
// 优先使用 Clipboard API，失败时回退到旧版 execCommand。
```

## 门禁入口

| 入口                        | 行为                         |
| --------------------------- | ---------------------------- |
| `npm run check:comments`    | 全量检查手写代码注释         |
| `.husky/pre-commit`         | 提交时自动执行 staged 预检   |
| `npm run preflight:changed` | 变更涉及代码或脚本时自动执行 |
| `npm run verify:governance` | 与其他工程治理检查一起执行   |
| PR Gate / Full Gate         | CI 阻断新增英文解释性注释    |

检查器使用 TypeScript AST 获取真实注释，Vue 文件分别处理脚本、模板和样式，避免把字符串、正则表达式或 URL 中的 `//` 误判为注释。门禁同时校验 `.husky/pre-commit → preflight:changed → check:comments` 接线，防止本地提交钩子被静默移除。

## 维护原则

- 不为单个业务注释增加文件级白名单，应直接改为中文。
- 新增技术语法豁免时，必须限定结构并补充反例验证，不能用宽泛关键词绕过。
- 注释应解释代码无法直接表达的原因和边界，避免逐行复述实现。
- 用户可见文案仍必须走 i18n；中文注释不能替代国际化资源。
