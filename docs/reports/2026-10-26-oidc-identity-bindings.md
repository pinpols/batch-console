# OIDC 身份绑定真实联调

## 范围与基线

- 前端与后端均使用 WDI `fix/wdi-current` 工作树，基线分别为 `662d254e2f8b97f93021de548815470d2291c997` 与 `f3d5e400d3b5bd737124b57cf0a38e685432aab2`；既有并行改动均予保留。
- 本次关闭能力矩阵 G08 的管理页面、绑定持久化、角色、审计和租户范围验收。本地 Console 使用启用态单租户 OIDC 配置；测试没有调用外部 IdP 登录，不证明外部 IdP 握手或生产密钥部署。
- Console `18181`、Vite `5181` 为本轮独立服务；匿名 `/api/console/auth/me` 返回 401。共享 Console `18080` 与 Orchestrator 未重启或修改。

## 验收结果

- 真实认证 Chromium 用例 1/1 通过、0 次重试。启用态 Provider API 返回 `enabled=true`，用户账户页的 OIDC 身份绑定抽屉可用。
- ADMIN 在页面将一个已存在的 TENANT_ADMIN 本地账号绑定到精确的 issuer/subject，并在列表中读回；解绑经二次确认后，页面重新读取为空。数据库独立查询核对账号、issuer、subject、绑定人，账号角色始终为 `ROLE_TENANT_ADMIN`，没有新建账号或角色授予。
- TENANT_ADMIN 的身份列表、绑定和解绑均返回 403；ADMIN 查询非配置租户返回 404；同一本地账号重复绑定返回 409，仍只有一条身份记录。
- PostgreSQL 审计读回绑定 SUCCESS、重复绑定 FAILED、解绑 SUCCESS 三条事件。唯一测试租户、临时账号、身份和对应审计全部清理，所有父夹具计数为 0。

## 证据

脱敏机器结果：[真实验收摘要](assets/oidc-identity-2026-10-26/real-evidence.json)；页面截图：[绑定记录](assets/oidc-identity-2026-10-26/identity-bound.png)。证据不包含临时租户、用户名、subject、凭据或 Cookie。

## 验证命令与边界

- `E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:oidc-bindings:real`；验收时 Console 通过本地环境参数启用 OIDC，`E2E_OIDC_TENANT_ID` 与 Console 配置租户一致。
- `npm run typecheck`、`npm run check:test-fixture-sources`（381个测试文件）和新增代码 Prettier 检查通过。
- 本次证明身份管理使用真实认证 Console 和 PostgreSQL；没有重定向至外部 IdP，因此不作为 OIDC 登录协议或外部身份提供方的验收。
