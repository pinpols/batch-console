# 前端发布回滚

本手册以当前不可变制品与部署脚本为准。先记录当前前端 SHA、镜像 digest、后端版本、环境及影响范围，再由当班发布负责人选择已验收且契约兼容的目标。历史绿色 tag 或前端单容器健康不能单独证明整个平台可回滚。

## 统一 Release Set 部署

平台使用 Release Manifest 部署时，优先按配对后端的[Compose CD 手册](../../../file-batch-system/docs/runbook/compose-cd-roadmap.md)回退同一 release set。实际命令入口是 `scripts/deploy/compose-release.sh`；前端不另造一份部署状态。

在已部署 release bundle 的后端根目录，确认站点实际使用的以下配置已恢复：

- `BATCH_RELEASE_ENV_FILE`：部署主机的 Compose env 文件；其中或当前环境必须提供实际站点使用的 `IMAGE_TAG`，满足基础 Compose 插值。最终运行 digest 仍由 manifest overlay 固定。
- `BATCH_RELEASE_FRONTEND_COMPOSE_FILE`、`BATCH_RELEASE_FRONTEND_DEPLOY_COMPOSE_FILE`：该 release bundle 内的前端 Compose 文件。
- `BATCH_RELEASE_STATE_DIR`、`BATCH_RELEASE_PROJECT_NAME`、`BATCH_RELEASE_COMPOSE_MODE`：与该环境原部署一致。
- 运行依赖、网络、凭据和前一稳定 manifest 已保留；当前 `previous.json` 确实是预定回退目标。

```bash
bash scripts/deploy/compose-release.sh --help
# 确认上一稳定 release set、环境及配置后执行：
bash scripts/deploy/compose-release.sh rollback staging
# production 仅由具备发布权限的负责人按生产处置流程执行：
# bash scripts/deploy/compose-release.sh rollback production
```

脚本使用上一稳定 manifest 中的固定 digest，校验健康与运行制品，保存状态和审计。版本文件比较由 staging workflow 或下面的人工恢复验收完成。它不撤销已经完成的业务数据变化；涉及不兼容数据库迁移时先遵守后端迁移与恢复方案。没有上一稳定记录时不能猜测目标，需要从正式发布记录恢复配置后再操作。

## 独立前端 Compose 部署

仅适用于该环境本来就独立部署前端，且已确认旧前端与当前后端契约兼容的情况。生产不可使用仅含本地构建配置的基础 Compose。

从发布记录取得已验收标签及其 digest，并使用该站点原有的 env 文件、项目名与网络：

```bash
PREV_TAG='replace-with-staging-verified-tag'
DEPLOY_ENV_FILE='/path/to/site.env'
DEPLOY_PROJECT='replace-with-existing-compose-project'
# site.env 必须包含可达的 BACKEND_UPSTREAM_HOST 和原 APP_EXTERNAL_NETWORK/HOST_PORT 等站点值。
IMAGE_TAG="$PREV_TAG" docker compose --project-name "$DEPLOY_PROJECT" --env-file "$DEPLOY_ENV_FILE" \
  -f docker-compose.yml -f docker-compose.deploy.yml config --quiet
IMAGE_TAG="$PREV_TAG" docker compose --project-name "$DEPLOY_PROJECT" --env-file "$DEPLOY_ENV_FILE" \
  -f docker-compose.yml -f docker-compose.deploy.yml pull frontend
IMAGE_TAG="$PREV_TAG" docker compose --project-name "$DEPLOY_PROJECT" --env-file "$DEPLOY_ENV_FILE" \
  -f docker-compose.yml -f docker-compose.deploy.yml up -d --no-build frontend
```

`docker-compose.deploy.yml` 当前接受显式 `IMAGE_TAG`；回退后必须把容器镜像的 RepoDigest 与发布记录比较。需要严格按 digest 部署时使用统一 Release Manifest 入口，不能把 `sha256:` 直接填到标签字段。不能通过重新 build 旧源码得到“同一个已验收制品”。

裸机静态部署按[Linux / Nginx 手册](../deploy/linux-nginx.md#回滚)原子切回完整旧发布目录，SPA 与统一文档站必须来自同一版本目录。

## 验收恢复

先使用站点实际 URL，核对以下证据：

| 检查 | 恢复标准 |
|---|---|
| 容器与镜像 | 原部署项目的服务 healthy，实际 RepoDigest 与目标发布记录一致 |
| `/healthz` | 200；只能证明前端存活 |
| `/version.json` | `gitSha` 等于目标前端提交 |
| `/login` 与静态资源 | 页面正常渲染，当前入口引用的 hash 资源全部可取 |
| 登录、租户与主要查询 | 真实会话可用、权限与后端契约一致 |
| `/docs/` | 未登录拒绝；登录后文档与后端鉴权可用 |
| API 与业务链 | 真实受控查询/操作正常，不能由 SPA fallback 返回200代替 |

若仍有 chunk 404，检查 HTML 缓存、CDN、Service Worker 与保留资源策略；优先恢复完整已验收制品。不要向运行容器临时复制旧 `dist` 或启动缺少 API、文档鉴权与安全头的临时 Nginx 作为正式恢复。

## 未恢复时与复盘

保存 Compose 状态、容器日志、版本信息和失败检查结果，按[前端事故手册](./frontend-incident.md)继续定位。重启、清缓存、替换配置和跨端回滚均需明确目标与影响，不能顺序盲试删除容器、未知 backup Compose 或不存在的占位页。

事故记录放 `docs/reports/` 的日期报告，至少包含开始/恢复时间、目标环境、影响范围、触发 SHA、回退 SHA/digest、后端兼容性、执行命令、恢复证据和后续负责人。历史恢复耗时只作为当次记录，不承诺未来固定 MTTR。
