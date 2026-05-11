# 00 — 租户生命周期(写接口测试的"第一步")

任何业务测试前,**先**把租户和它的初始配置准备好。这一步覆盖租户自身 CRUD + 配置初始化 + 跨租户复制——后续场景才能在 ta/tb/tc 里跑。

## 测的接口

| 阶段 | 方法 | 路径 | FE 入口 |
|---|---|---|---|
| **单个新增** | POST | `/api/console/tenants` | 租户管理 → 新增 |
| **批量新增** | POST | `/api/console/tenants/batch` | 租户管理 → 批量新增 |
| **初始化配置**(从 default 模板复制) | POST | `/api/console/config/tenant-init` | 租户详情 → 初始化配置 |
| **批量初始化** | POST | `/api/console/config/batchInitTenantConfig` | 租户管理 → 批量初始化 |
| **跨租户复制** | POST | `/api/console/config/tenant-copy` | 配置管理 → 跨租户复制 |
| **整包导入**(Excel) | POST | `/api/console/config/tenant-package/excel/upload` | 配置管理 → 配置批量导入(详见 `01-tenant-config-import/`) |
| **激活** | POST | `/api/console/tenants/{tenantId}/activate` | 租户行操作 |
| **暂停** | POST | `/api/console/tenants/{tenantId}/suspend` | 租户行操作 |
| **删除** | DELETE | `/api/console/tenants/{tenantId}` | 租户行操作 |
| **配额申请**(普通用户) | POST | `/api/console/tenants/quota/request` | 自助服务 |

## 测试矩阵(端到端 4 路径)

### A. 单个新增 + 默认初始化(最快进 ta)
```
POST /tenants                    →  ta(空配置)
POST /config/tenant-init         →  ta(从 default 复制 queue/calendar/file-tpl 等基础配置)
后续:在 /jobs/definitions 手工建几条 jobDef 验证
```
payload:`payloads/single-create-ta.json` + `payloads/tenant-init.json`

### B. 单个新增 + Excel 整包导入(完整一步到位)
```
POST /tenants                                        →  td 空壳
POST /config/tenant-package/excel/upload (td.xlsx)   →  td 全套配置一次到位
```
Excel 见 `../01-tenant-config-import/`

### C. 批量新增 + 批量初始化(规模化)
```
POST /tenants/batch    body=[te, tf, tg]              →  3 个空壳
POST /config/batchInitTenantConfig body=[te, tf, tg]  →  并发初始化
```
payload:`payloads/batch-create.json` + `payloads/batch-init.json`

### D. 跨租户复制(已有租户克隆)
```
POST /config/tenant-copy  src=ta dst=th(预先建)
```
payload:`payloads/tenant-copy.json`

## 验证点

| 用例 | 期望 |
|---|---|
| 重复 tenantId 新增 | 409 + 友好提示 |
| 批量新增遇重复 | 部分成功,失败行高亮 |
| init 时 default 模板为空 | 提示并阻断 |
| copy src 不存在 | 404 + toast(不踢登录,回归 5/10 修的 bug) |
| 暂停后 → ta 用户登录 | 拒绝 + 跳"租户不可用"页 |
| 删除非空租户 | 二次确认 modal + 销毁确认 composable(已 P0 上线) |
| 创建后引导 | useCreateSuccess 弹"下一步建议"(已 P2 上线) |

## 角色矩阵

- **admin/system** ⇒ 全部可写
- **OPERATOR/ta** ⇒ 不能 create/delete tenant,但能 init/copy 自己租户配置
- **VIEWER** ⇒ 全部 disabled,只读
- **TENANT_USER** ⇒ 只能配额申请

## 文件
- `payloads/` — 各 API 的请求体样本(待补)
- `seed-tenants.sh` — 一键造 ta/tb/tc/td/te/tf 等用于测试(待写)
