# 浏览器支持策略

## 支持范围

- 桌面：最近两个稳定版本的 Chrome、Edge、Firefox，以及当前和前一主要版本 Safari。
- 移动：当前和前一主要版本 iOS Safari；Android 以最近两个稳定版本 Chrome 为基线。
- 不支持 Internet Explorer、内嵌旧 WebView 和关闭必要 JavaScript/Cookie 能力的环境。

常规 CI 使用 Chromium。`staging-gate` 在 Chromium 全量验收后，还会将 `e2e/smoke.spec.ts` 中标记为 `@cross-browser` 的路由冒烟覆盖 Chromium、Firefox、WebKit 和 Pixel 5（移动 Chrome）配置；它不是全量业务套件的多浏览器运行。移动端触控交互仍需真实 iOS/Android 抽检。

新增语法、Web API、PWA 或加密能力时，必须提供 feature detection 或明确降级，不以浏览器 UA 字符串代替能力判断。
