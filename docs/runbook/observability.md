# 前端可观测性运行手册

## 启用条件

- `VITE_SENTRY_DSN` 只通过受控构建环境注入；DSN 为空时 Sentry 关闭。
- `VITE_TELEMETRY_ENABLED=true` 才启用遥测，上报端点由 `VITE_TELEMETRY_ENDPOINT` 指定。
- 发布版本以 `/version.json` 的 `version` 和 `gitSha` 为准，Sentry release 必须与其关联。

## 数据边界

不得采集密码、token、Secret、完整请求体或用户上传文件内容。租户、路由、TraceId 和错误码只按排障所需保留；采样率、保留期和访问权限由运维负责人批准。

## 告警建议

按版本观察白屏、未捕获异常、API 5xx/网络失败、LCP/INP/CLS 和登录失败突增。告警必须链接到前端事故手册，并能定位版本、路由和 TraceId。没有 sourcemap 或 release 对齐时不得将堆栈视为可定位证据。
