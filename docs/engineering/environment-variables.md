# 前端环境变量

机器可读注册表为 [`config/frontend-env.json`](../../config/frontend-env.json)，CI 通过 `npm run check:env` 校验代码使用与登记一致。

`VITE_*` 会在构建时写入公开静态资源，不能存放服务端密钥。`VITE_SENTRY_DSN` 虽标记为敏感配置，但浏览器 DSN 本身可见；真正的 Sentry auth token 不得使用 `VITE_*`，只允许存在于 CI secret。

开发代理变量只在本地生效；生产 API 默认使用同源 `/api`。新增变量必须声明阶段、默认值、敏感性和 owner，并同步 `.env` 示例、Docker 构建参数和运行手册。

`VITE_GIT_SHA` 由 CI 注入，用于生成 `/version.json` 并验证 staging 部署版本；本地默认值为 `local`。
