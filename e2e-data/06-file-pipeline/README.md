# 06 — 文件流水线

## 测的接口
- POST `/api/console/files/presign-upload` / `presign-download`
- POST `/api/console/files/redispatch`
- POST `/api/console/files/archive`
- PATCH `/api/console/files/{fileId}/confirm-arrival`
- POST `/api/console/files/arrival-groups/action`(批量分发)

## 数据准备
- `sample-small.csv` — 小文件,测正常上传(待补)
- `sample-empty.csv` — 0 字节,测空文件错误
- `sample-invalid-encoding.csv` — 非 UTF-8,测编码报错

## FE 触发路径
- `/files/list` — 行操作:重新分发 / 归档 / 确认到达
- `/files/templates` — 上传模板
- `/files/arrival-groups` — 到达组治理

## 状态依赖
对应 SQL seed(BE 出):
```sql
-- 1 个 ARRIVED 文件(测 confirm-arrival 是 noop)
-- 1 个 STUCK_DISPATCH 文件(测 redispatch)
-- 1 个 OLD 文件(测 archive)
-- 1 个 ArrivalGroup 含 2-3 文件(测批量 action)
```
