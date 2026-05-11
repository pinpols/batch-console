# 05 — 配置发布流

## 测的接口(完整链路)
1. POST `/api/console/config/releases` — 创建草稿
2. POST `/api/console/config/releases/{id}/submit-approval` — 提审
3. POST `/api/console/config/approvals/{id}/approve` — 通过(系统级用户)
4. POST `/api/console/config/releases/{id}/gray` — 灰度
5. POST `/api/console/config/releases/{id}/publish` — 全量
6. POST `/api/console/config/releases/{id}/rollback` — 回滚

## 数据
- `release-create.json` — POST 创建发布的 payload(待补)
- `release-rollback.json` — 回滚 payload

## FE 触发路径
**配置管理 → 发布管理** (`/config/releases`)

## 验证点
- 状态机推进:DRAFT → SUBMITTED → APPROVED → GRAY → PUBLISHED → (rollback)
- 每步按钮按 status 显示/隐藏
- 灰度比例输入校验
- rollback 后版本号对齐
