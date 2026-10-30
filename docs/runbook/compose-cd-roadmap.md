# 前端持续交付架构与剩余路线

> 文档职责：持续维护的发布架构与路线。2026-10-25 按 WDI 源码复核配置，未执行部署、生产审批或 staging 验收。已有脚本连接与目标环境通过分别记录。

## 当前已实现的连接

前端加入平台统一 release set，平台编排权威位于配对后端[Compose CD 路线](../../../file-batch-system/docs/runbook/compose-cd-roadmap.md)。

| 能力 | 当前实现 | 证据边界 |
|---|---|---|
| 固定双仓提交 | 后端 `compose-cd.yml` 固定可从 main 到达的后端/前端完整 SHA | 配置存在，不代表本地 WDI 未提交改动已发布 |
| 前端镜像 digest | `.github/workflows/build-image.yml` 的 `workflow_call` 接收 `source_ref/backend_ref` 并返回 `image_digest` | 构建与文档源固定；实际成功取决于 CI |
| 统一 Release Manifest | 后端组装前端及后端镜像集合，校验 digest 并生成 release bundle | 不用浮动 tag 猜测制品 |
| staging SSH / Compose | 后端可选 `deploy_staging`，使用严格主机指纹与站点配置部署 | 需要实际 secrets、网络、环境及授权 |
| 健康/版本/制品校验 | 平台脚本核对健康与 manifest 镜像；staging workflow 核对前端 `version.json`、提交与公网安全头 | 运行态必须提供真实证据 |
| 浏览器与性能连接 | 后端 workflow 已接 staging E2E、视觉、跨浏览器 smoke 与 Lighthouse；前端自身保留 `staging-gate` | 接线存在不证明环境变量、账号与每一场景均已通过 |
| 失败取证与恢复 | 平台部署脚本保存失败快照、审计和上一稳定 manifest，验证失败可恢复前一 set | 后续浏览器门禁失败后的晋级阻断与恢复策略仍需联合演练 |
| 并发、摘要与留存 | workflow concurrency、部署锁、Actions Summary、release bundle artifact 与 manifest 留存 | 实际保留策略以当前脚本和环境配置为准 |

前端 `docker-compose.deploy.yml` 只拉取显式标签、要求可达的后端地址，并加入站点受控网络。统一部署由额外生成的 manifest overlay 固定 digest；服务主机不安装 Node 或重建源码。

## 目标环境待验收

- [ ] 配置 staging 的 SSH、已知主机、env 文件、共享网络、URL 与测试账号，实际运行完整 release set。
- [ ] 核对前端/API origin、四角色准备、真实业务必验与跨浏览器配置，保存 PASS/FAIL/SKIP 明细。
- [ ] 演练 Nginx 启动失败、后端不可达、错误 digest、SSH 中断和浏览器门禁失败；确认恢复目标与晋级阻断。
- [ ] 验证前后端回滚兼容窗口、数据库迁移约束及业务副作用恢复。
- [ ] 核对 manifest、日志和制品留存满足该环境恢复窗口。

这些项目是实际环境证据缺口，不能重新记作全部代码尚待实施，也不能因存在 YAML 就关闭验收。

## 后续实施边界

- production 审批与仅允许晋级 staging 已通过 manifest 的完整平台链仍由后端路线推进；不宣称本仓已有生产自动发布。
- GitOps / Kubernetes / Helm / Argo CD 是后续平台路线，不能把规划图当作已部署架构。
- 部署基线为 Linux；Windows 本地开发使用 WSL2 / Docker Desktop。历史 Windows 原生部署试验只留归档。

## 前端所在边界

当前 Compose 阶段，浏览器经 Nginx 访问 SPA、统一文档站和 Console API；Trigger、Orchestrator、Worker、Kafka、PostgreSQL、Valkey 与对象存储的拓扑和规格以后端方案为准。浏览器不直接访问这些内部数据服务。

未来部署执行器从 SSH / Compose 切到 GitOps 时，保留固定 SHA/digest、`/healthz`、`/version.json`、目标环境验收和同一 release set 的契约。

操作步骤见[发布晋级](./release-promotion.md)、[Docker / Nginx 部署](../deploy/docker-nginx.md)和[回滚](./rollback.md)。
