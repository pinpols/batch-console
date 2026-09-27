# 前端事故处理

## 首轮判定

1. 记录 URL、时间、租户、浏览器、前端 `version.json`、TraceId 和首次错误。
2. 检查 `/healthz`、静态资源状态、API 状态和浏览器控制台 CSP/网络错误。
3. 区分静态制品、API 反代、认证/权限、Service Worker 缓存和后端业务错误。

## 常见处置

- 白屏或 chunk 404：确认 HTML 未缓存、hash 资源可用；必要时回滚到上一 digest。
- 大量 401/403：不要前端绕过，核对 cookie、租户和后端权限配置。
- API 502：检查 Nginx upstream 与后端健康，不修改页面吞掉错误。
- 旧版本长期驻留：先停止发布，核对 PWA 更新；紧急时发布禁用 Service Worker 的修复版本并清理旧 cache。
- CSP 阻断：保留浏览器报告，确认是否为允许的 Sentry/API 域名；不得直接放宽为 `*`。

事故结束后记录根因、影响版本、回滚 digest、监控缺口和防复发门禁。
