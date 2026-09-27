# 安全策略

## 报告方式

不要通过公开 Issue 提交未修复漏洞、凭据或可复现攻击数据。请使用仓库的 GitHub Private Vulnerability Reporting；若该入口不可用，联系仓库维护者并仅提供最小必要信息。

报告应包含受影响版本、入口、权限前提、影响范围、复现步骤和建议缓解措施。不得在生产环境执行破坏性验证。

## 项目安全边界

- 浏览器不保存认证 token；会话由后端 HttpOnly cookie 管理。
- 前端不承担服务端授权，所有写操作和租户隔离必须由后端再次校验。
- API 契约以后端 OpenAPI、Controller 和权限配置为权威。
- 依赖漏洞、SBOM、CSP、安全头和静态分析由 CI 门禁持续检查。

支持范围和修复发布流程见 [发布晋级](./docs/runbook/release-promotion.md) 与 [浏览器支持](./docs/engineering/browser-support.md)。
