# 08 — 系统级 CRUD

只在 **system 租户** + admin 用户下测。

## 测的接口

| 域 | 接口 |
|---|---|
| APIKey | POST `/api/console/api-keys` / DELETE `/{id}` / POST `/config/secrets/rotate` |
| Webhook | POST `/api/console/webhooks` / PUT/DELETE `/{id}` |
| Tag | POST `/api/console/tags` / DELETE `/{id}` / DELETE `/all` |
| NotificationChannel | POST `/api/console/notifications/channels` / PUT `/{code}` |
| NotificationRule | POST `/api/console/notifications/rules` / PUT/DELETE `/{id}` |
| User | POST `/api/console/users` / PUT/DELETE `/{id}` / `enable` / `disable` / `reset-password` |
| SystemParameter | PUT `/api/console/system-parameters` / DELETE |
| ArchivePolicy | PUT `/api/console/ops/archive-policies` |

## payload 样本(待补)
- `api-key-create.json`
- `webhook-create.json`
- `notification-channel-email.json`
- `notification-channel-feishu.json`
- `notification-rule-job-failed.json`
- `tag-batch-create.json`(5 个 tag)

## FE 触发路径
- `/system/api-keys` / `/system/webhooks` / `/system/tags`
- `/system/notifications/channels` / `/system/notifications/rules`
- `/system/users` / `/system/parameters`
- `/system/archive-policies`
