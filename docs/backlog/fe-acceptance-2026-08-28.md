# FE 验收 backlog(2026-08-28)

## 汇总

| Step | 状态 | 耗时(s) |
|---|---|---|
| 0 前置条件检查 | SKIP |  |
| 1 依赖刷新 | SKIP |  |
| 2 typecheck | SKIP |  |
| 3 lint:check | SKIP |  |
| 4 check:i18n | SKIP |  |
| 5 gen:api:check | SKIP |  |
| 6 test:unit | SKIP |  |
| 7 build | SKIP |  |
| 8 e2e smoke | SKIP |  |
| 9 e2e full | SKIP |  |
| 10 preview 冒烟 | PASS | 4 |
| 13 真实使用审计 | PASS | 328 |
| 11 近 3 天违约扫描 | PASS | 0 |
| 12 backlog 归档 | N/A |  |

## 工具链 / 环境
- [x] 本轮复用本地已启动前后端，后端基础依赖来自 Docker，本地应用进程直接访问已有服务。
- [x] 验收前已清理 BFS 本地脏数据：批运行表、文件表、业务库、MinIO bucket、Redis 均清空。
- [x] `npm run gen:api:check`、`lint:check`、`typecheck`、`check:i18n`、`build`、`test:unit`、`test:e2e:smoke` 已单独跑通。
- [x] `scripts/local/fe-acceptance.sh --steps=10,13,11,12` 已跑通，覆盖 preview 冒烟、真实使用审计、近 3 天违约扫描和 backlog 归档。

## 代码 bug
- [x] `smoke:endpoints` 原先对 OpenAPI `format: date` 参数采样为 `1`，导致后端返回 500；已改为采样合法日期。
- [x] 本轮发现后端对请求参数类型转换异常未映射为 400；已在 BFS 后端 PR 中补 `MethodArgumentTypeMismatchException` 处理。

## flaky / 性能(独立 PR)
- [ ] `build` 仍有既有 large chunk 警告，当前不阻塞功能验收。
- [ ] `test:unit` 仍有既有 `--localstorage-file` Node/Vitest 警告，当前不影响测试结果。
