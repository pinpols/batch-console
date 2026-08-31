# FE 验收 backlog(2026-08-31)

## 汇总

| Step | 状态 | 耗时(s) |
|---|---|---|
| 0 前置条件检查 | PASS | 1 |
| 1 依赖刷新 | PASS | 1 |
| 2 typecheck | PASS | 1 |
| 3 lint:check | PASS | 10 |
| 4 check:i18n | PASS | 1 |
| 5 gen:api:check | PASS | 5 |
| 6 test:unit | PASS | 27 |
| 7 build | PASS | 15 |
| 8 e2e smoke | PASS | 120 |
| 9 e2e full | PASS | 1544 |
| 10 preview 冒烟 | PASS | 3 |
| 13 真实使用审计 | PASS | 365 |
| 11 近 3 天违约扫描 | PASS | 2 |
| 12 backlog 归档 | N/A |  |

## 工具链 / 环境(不修主代码)
- [ ] Node 当前为 v25.4.0,项目 engine 约束为 `>=22 <23`;本轮可运行,但建议本地与 CI 统一到 Node 22 LTS,避免依赖解析和构建告警漂移。
- [ ] 本地验收依赖 Docker 基础环境(PG/Kafka/MinIO/Valkey/mockserver/sftp),应用后端本地启动;`restart.sh console` 在自动化 shell 中会随会话退出被清理,长验收需使用持久会话启动 console。
- [ ] 构建仍有第三方 `@vueuse/core` pure annotation 与 chunk 大小告警;不影响本轮业务验收,后续可按打包拆分专项处理。

## 代码 bug
- [x] 已修:无租户上下文时 worker / file-center / notification 页面不再主动请求租户 API,避免管理员或空租户状态下噪声报错。
- [x] 已修:Alert Routing 当前后端预留,前端改为只读预留态,不再暴露空转写操作。
- [x] 已修:Excel 配置包上传等待超时从 20s 放宽到 45s,匹配真实后端解析耗时。
- [x] 已修:文件模板/渠道页 403 或权限不足时不再抛出未处理 Promise,模板 tab 保留错误态,渠道 tab 清空列表并交由请求拦截器提示。

## flaky / 性能(独立 PR)
- [ ] Outbox 页面全量拉取曾达到 4000 条,当前测试可通过,但真实环境应继续收敛分页/筛选默认值,避免运维页面长列表拖慢。
- [ ] Smoke 中审批卡片跳转出现一次重试通过的导航 flake;建议后续改为等待路由和目标卡片双条件,降低 CI 噪声。
- [ ] 仍有 45 个前端 E2E skip,集中在 Compensation UI 表单、日志自动刷新、Notification/Webhook 真写、Workflow designer 长链路、Mobile 运维写操作等;不是本轮上线阻塞,但不能等同于生产全场景语义已完全验证。
