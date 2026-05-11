# batch-console 前端写接口测试数据

> 路径:`batch-console/e2e-data/`(已纳入 git 管理,与 `e2e/` 平级)

按"测试场景"分目录,每目录一个 README 说明它专测哪些写接口、依赖什么前置数据、怎么用。

## 目录约定

| 目录 | 测什么 | 数据形式 |
|---|---|---|
| **00-tenant-lifecycle** | 租户单/批新增、tenant-init、tenant-copy、激活/暂停/删除、配额申请 — **第一步,跑通才有 ta/td/te... 后续场景** | payload `.json` + `seed-tenants.sh` 一键造 |
| 01-tenant-config-import | 租户配置整包导入向导(JobDef/Queue/Calendar/FileTpl 等批量) | `.xlsx`(已纳 git;源自 file-batch-system/docs/test-data,如更新需手动同步) |
| 02-excel-edge-cases | Excel 导入错误回显、超大行、缺列 | 故意构造的坏 `.xlsx` |
| 03-job-instance-states | cancel / terminate / partition retry / 自助 rerun & compensation | SQL 种子(BE 写入)+ trigger 脚本 |
| 04-approvals-pending | approve / reject(通用 + Catch-up + 配置审批) | trigger 脚本 + SQL |
| 05-config-release-flow | submit-approval / gray / publish / rollback | API payload `.json` + 步骤脚本 |
| 06-file-pipeline | 文件 redispatch/archive/confirm-arrival、ArrivalGroup action | sample 数据文件 + presign 脚本 |
| 07-outbox-stuck | outbox republish / cleanup | SQL seed |
| 08-system-level | APIKey / Webhook / Tag / Notification CRUD | API payload `.json` |
| 09-self-service | rerun-request / compensation-request | API payload `.json` |
| 10-rbac-users | RBAC 拒绝、用户 enable/disable/reset | 创建脚本 + 4 个角色样本 |

## 跑测惯例

- 主登录:`admin / admin123`(ROLE_ADMIN @ system 租户)
- 业务测试租户:`ta` / `tb` / `tc`(配置已从 01- 包里导入)
- BE 端:`http://localhost:18080`
- FE 端:`http://localhost:5173`(dev) / `http://localhost:15173`(docker)

## 怎么用

```bash
# 进入对应场景目录
cd 04-approvals-pending
cat README.md   # 看专项说明
```

各目录脚本统一假定:
1. BE & FE 已起
2. 环境变量 `BC_API_BASE`(默认 http://localhost:18080)
3. `BC_TOKEN` 自动从 admin 登录拿

公共工具脚本放 `_lib/`(后续添加)。
