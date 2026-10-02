# 贡献指南

## 开发流程

1. 从最新 `main` 创建短命分支：`feature/<topic>`（功能）、`fix/<topic>`（缺陷）、`chore/<topic>`（工程/依赖/脚本/CI）或 `docs/<topic>`（纯文档）。
2. 使用 Node 24 和锁文件安装依赖：`npm ci`。
3. 接口变更先更新配对后端 OpenAPI，再运行 `npm run gen:api`。
4. 用户可见文案同时维护 `zh-CN` 与 `en-US`；行为变化同步测试和长期文档。
5. 提交前运行 `npm run preflight:changed:all`；较大改动运行 `npm run verify:local`，需要真实业务验收时运行 `bash scripts/local/fe-acceptance.sh`。

## 变更边界

- 页面和组件通过 `src/api/*` 领域模块访问后端，不直接导入 `src/api/client.ts`。
- `src/types/api.generated.ts` 只能由生成脚本修改。
- 前端维护浏览器、交互、静态制品和契约消费；调度、数据库与服务端恢复语义引用后端权威文档。
- 不在提交中写入账号、token、DSN 私钥或环境专属地址。

## Pull Request

PR 描述必须列出变更范围、验证命令、未验证项、契约/权限/租户影响以及发布或回滚影响。合并以 required checks 的实际结果为准，SKIP 不等于通过。
