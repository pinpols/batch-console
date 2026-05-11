# 10 — RBAC 用户矩阵

## 目的
测每个角色访问系统时该有的可见性 + 拒绝行为(403 toast、按钮禁用、列表空过滤)。

## 用户矩阵(待 BE 同事建)

| 用户名 | 密码 | 角色 | 租户 | 用途 |
|---|---|---|---|---|
| `admin` | `admin123` | ROLE_ADMIN | system | 全量验证(已存在) |
| `op-ta` | `Op@2026` | ROLE_OPERATOR | ta | 测自助 + 写操作能否触发 |
| `viewer-ta` | `Vi@2026` | ROLE_VIEWER | ta | 测只读 + 写按钮被禁 |
| `tu-ta` | `Tu@2026` | ROLE_TENANT_USER | ta | 测最弱权限,业务用户视角 |
| `auditor` | `Au@2026` | ROLE_AUDITOR | system | 测审计页可见 + 写操作禁 |
| `cfg-admin` | `Cfg@2026` | ROLE_CONFIG_ADMIN | system | 测配置发布审批权 |

## 创建脚本(待写)
```bash
./create-test-users.sh
```
Admin token + POST `/api/console/users` 批量建。

## 测试用例
- 用 viewer 登录,/jobs/definitions 行操作"编辑"按钮应**禁用 + tooltip 提示**
- 用 op-ta 登录,/system/users 应**整个菜单不可见**
- 用 tu-ta 登录,只能看到 `/self-service` + `/files/list`(自己的文件)
- 角色越权调写接口 → 401 → toast 提示而非踢出登录(回归 5/10 修的 bug)

## FE 触发路径
任何菜单/按钮——核心是验证 nav menus 按 role 过滤 + 写按钮 disabled 状态
