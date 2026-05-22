# Rollback Runbook(batch-console FE)

> prod / staging 出问题时,**多久能恢复服务**比根因更重要。本 runbook 列出可执行的最短路径。

## TL;DR

```bash
# 一行 rollback(上一个绿 tag)
LAST_GOOD=v0.x.y BACKEND_UPSTREAM_HOST=$BACKEND_HOST docker compose -f docker-compose.yml up -d --no-build
# 30s 内健康检查
curl -fs http://localhost:8080/healthz
```

预期恢复时间(MTTR):**< 2 min**(已有 image)/< 5 min(需 pull image)。

---

## 何时该 rollback(不是修)

**先 rollback,再排查根因**。以下情况立即回退:

| 触发 | 阈值 | 操作 |
|---|---|---|
| prod 主页 5xx | > 30s 持续 | **立即 rollback** |
| 登录路径 404 / 白屏 | 任意持续时间 | **立即 rollback** |
| 静态资源 404(`index.html` 引用的 chunk 找不到) | 一例即触发 | **立即 rollback** + CDN 清缓存 |
| Lighthouse perf < 70 / a11y < 90(staging) | 任一不达标 | **不发 prod**(staging-gate 已拦) |
| 单业务页面报错(其他正常) | 影响 < 10% PV | 先看 backlog,可热修复就修 |
| 后端兼容性问题(BE API 变更但 FE 没同步) | 任意 | **rollback FE** + 通知 BE 暂停 deploy |

判定原则:**用户感知 > 自己解释**。SPA 白屏 ≠ 后端 500 那种"能 retry 修过来",一定先回退。

---

## 信息核对(rollback 前 30 秒)

```bash
# 1. 当前在跑哪个 tag
docker inspect batch-console --format '{{.Config.Image}} (started {{.State.StartedAt}})'

# 2. 最近合并到 main 的 release(release-please 自动打的 tag)
gh release list --limit 5

# 3. 上一个绿色 staging-gate 跑的 commit
gh run list --workflow=staging-gate.yml --status=success --limit 1 --json headSha,conclusion

# 4. 当前 BE 在哪个版本(确认 API 契约对得上)
curl -s $BACKEND_HOST/actuator/info | jq -r '.build.version'
```

---

## 操作 1:Docker image tag rollback(主要路径)

### 前提
- prod 用 docker-compose 部署(本仓 `docker-compose.yml`)
- registry 里仍保留上 N 个 tag(release-please 每次发布会 tag,默认保留)

### 步骤

```bash
# 1) 确定回退目标
PREV_TAG=v0.1.4                       # 上一个 staging-gate 绿的 tag
REGISTRY=your.registry.com            # 替换成你的 registry

# 2) Pull 旧 image(确保本机有)
docker pull $REGISTRY/batch-console:$PREV_TAG

# 3) 用 IMAGE_TAG env 切到旧 image,重启服务
#    docker-compose.yml 的 image 字段需支持 ${IMAGE_TAG:-latest} 引用
IMAGE_TAG=$PREV_TAG docker compose up -d --no-build

# 4) 健康检查(30s 内必返 200)
curl -fs --max-time 30 http://localhost:8080/healthz

# 5) 人眼复检关键路径
for path in /login / /m/ /ops/summary; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080$path")
  echo "  $path → $code"
done
```

**预期**:`/login` 200,`/` 302→`/login` 或 200(取决于是否带 cookie),`/healthz` 200。

### 如果当前 docker-compose 写死 `image: batch-console:latest`

补丁(改 docker-compose.yml):
```yaml
services:
  frontend:
    image: batch-console:${IMAGE_TAG:-latest}
```
然后再走上面 step 3。

---

## 操作 2:静态资源 404(chunk 哈希丢失)

**症状**:用户浏览器白屏,console 报 `Failed to load module: /assets/index-OLD.js`(404)。  
**根因**:用户缓存了旧 `index.html`,引用的旧 chunk 已被新 build 清掉。  
**正常**:nginx 已配 `/index.html` no-cache + `/assets/*` immutable,理论不会发生。  
**例外**:CDN/反代层有自己的缓存策略 → 用户拿到陈旧 HTML。

### 处理

```bash
# 1) 看 nginx 容器是否真按预期返头
curl -I http://localhost:8080/index.html | grep -i cache-control
# 期望:Cache-Control: no-cache, no-store, must-revalidate
curl -I http://localhost:8080/assets/index-XXX.js | grep -i cache-control
# 期望:Cache-Control: public, max-age=31536000, immutable

# 2) 若上层有 CDN(Cloudflare/CDN77/自建 Varnish),手动 purge:
#    - Cloudflare: Dashboard → Caching → Purge Everything
#    - 自建 Varnish: varnishadm "ban req.url ~ /"
#    - nginx 反代上层: 重启 nginx 释放 proxy_cache

# 3) 让旧 chunk 临时存活(灾备):上一版 dist/assets/ 临时回填到当前 dist/
#    (粗暴但能救命)
docker cp old-dist/assets/. $(docker ps -q -f name=batch-console):/usr/share/nginx/html/assets/
docker exec $(docker ps -q -f name=batch-console) nginx -s reload
```

---

## 操作 3:BE API 契约不兼容

**症状**:页面打开正常,但所有 API 调用 400/422,响应体 schema 跟 FE 期望对不上。  
**根因**:BE 改了 OpenAPI 但 FE 没跟上(或反过来)。  
**预防**:`pr-gate.yml` 跑 `npm run gen:api:check` 拦,通常不会漏到 prod。

### 处理

1. **rollback FE 到上一版**(BE 不动),恢复服务
2. 通知 BE 团队:暂停下一次 deploy
3. 拉一个 hotfix 分支,`npm run gen:api` 同步类型,改受影响代码,跑 `pr-gate + staging-gate`
4. 串行 release(BE 改 → FE 跟随)

---

## 验证 rollback 成功

```bash
# 五件套
echo "[1/5] container running"
docker ps --filter "name=batch-console" --format "table {{.Names}}\t{{.Status}}"

echo "[2/5] /healthz"
curl -fs http://localhost:8080/healthz

echo "[3/5] /login 渲染"
curl -s http://localhost:8080/login | grep -q '<title>' && echo "  OK" || echo "  FAIL"

echo "[4/5] /api 反代通"
curl -s -o /dev/null -w "  /api/console/auth/check → %{http_code}\n" http://localhost:8080/api/console/auth/check

echo "[5/5] 静态资源 hash 匹配"
HASH=$(curl -s http://localhost:8080/ | grep -oE 'index-[A-Za-z0-9]+\.js' | head -1)
curl -s -o /dev/null -w "  $HASH → %{http_code}\n" http://localhost:8080/assets/$HASH
```

五项全过 → rollback 成功。任一不过 → 看下一节灾备。

---

## 灾备:rollback 也失败时

按"破坏性递增"顺序尝试:

```bash
# A) 重启容器
docker restart batch-console

# B) 重新 pull 上一版 image(本地缓存可能损坏)
docker rm -f batch-console
docker pull $REGISTRY/batch-console:$PREV_TAG
docker compose up -d --force-recreate

# C) 切换到 docker-compose backup(若有 prod-backup.yml)
docker compose -f docker-compose.prod-backup.yml up -d

# D) 起一个临时 nginx,挂载本机 dist 应急
docker run -d --name batch-console-emergency \
  -p 8080:80 \
  -v $(pwd)/dist:/usr/share/nginx/html:ro \
  -v $(pwd)/nginx/default.conf.template:/etc/nginx/templates/default.conf.template:ro \
  -e BACKEND_UPSTREAM_HOST=$BACKEND_HOST \
  nginx:1.27-alpine

# E) 终极:404 静态页占位
docker run -d -p 8080:80 \
  -v $(pwd)/docs/runbook/maintenance.html:/usr/share/nginx/html/index.html:ro \
  nginx:1.27-alpine
```

A → E 试,中间任何一步通了就停。

---

## Post-mortem 模板(rollback 后必做)

```markdown
## YYYY-MM-DD batch-console rollback

- **触发时间**:HH:MM
- **检测来源**:Lighthouse alert / 用户反馈 / 监控告警 / oncall 巡检
- **症状**:(一句话,如"prod /login 白屏,console 报 chunk 404")
- **影响范围**:全量 / X% 用户 / 某 tenant
- **触发 commit**:`abc1234` "<commit msg>"
- **rollback 到**:tag `vX.Y.Z`
- **MTTR**:X 分钟(检测到 → 完全恢复)

### 根因
(技术细节,3-5 行)

### 为什么 CI 没拦住
(staging-gate 跑了吗?哪一项漏了?)

### Action items
- [ ] 补 CI gate:...
- [ ] 修复 bug:...
- [ ] 更新本 runbook:...
```

落到 `docs/runbook/postmortems/YYYY-MM-DD-<short-desc>.md`。

---

## 关联文件

- `docker-compose.yml` — prod 部署入口
- `Dockerfile` + `nginx/default.conf.template` — image 构建 + nginx 配置(已含 SPA cache header)
- `.github/workflows/staging-gate.yml` — prod 前最后一关(Playwright + Lighthouse)
- `.github/workflows/release-please.yml` — release tag 自动化(2026-05-22 引入)
- `.release-please-manifest.json` — 当前版本号源
