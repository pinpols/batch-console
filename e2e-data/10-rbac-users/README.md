# 10 — RBAC 用户矩阵

## 目的
测每个角色访问系统时该有的可见性 + 拒绝行为(403 toast、按钮禁用、列表空过滤)。

## 用户矩阵(待 BE 同事建)

| 用户名 | 密码 | 角色 | 租户 | 用途 |
|---|---|---|---|---|
| `admin` | `admin123` | ROLE_ADMIN | system | 全量验证(已存在) |
| `tadmin-ta` | `Admin@123abc` | ROLE_TENANT_ADMIN | ta | 测本租户管理与跨租户拒绝 |
| `op-ta` | `Op@2026` | ROLE_TENANT_USER | ta | 测只读与受控自助操作 |
| `auditor` | `Au@2026` | ROLE_AUDITOR | system | 测审计页可见 + 写操作禁 |

## 创建脚本(待写)
```bash
./create-test-users.sh
```
Admin token + POST `/api/console/users` 批量建。

## 测试用例
- 用租户用户登录，定义页写操作应隐藏或禁用
- 用租户用户登录，`/system/users` 权限自查可访问，管理页不可达
- 用租户用户登录，可看到 `/self-service` 与本租户只读页面
- 角色越权调写接口 → 401 → toast 提示而非踢出登录(回归 5/10 修的 bug)

## FE 触发路径
任何菜单/按钮——核心是验证 nav menus 按 role 过滤 + 写按钮 disabled 状态
