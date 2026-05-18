# 密码安全 — BE 改造 backlog

> 创建于 2026-05-18,触发于"租户能改自己密码吗?"评估
> 状态:**P0–P3 全部待 BE 实施**;FE 方案 A (随机生成 + 复制) 已落 commit 79d3f35

## 现状

| 项 | 状态 |
|---|---|
| 创建租户初始密码 | ✅ admin 输入 ≥12 位,FE 提供随机生成 |
| Argon2id 后端哈希 | ✅ 已在 ConsoleUserAccountService |
| HttpOnly cookie + JWT | ✅ ADR-030 §D7 Stage B |
| 用户**自己改密码** | ❌ **完全不支持**(BE 无端点) |
| 首次登录**强制改** | ❌ 文案有提示,无强制机制 |
| 密码过期策略 | ❌ 等保 2.0 三级要求 90 天换 |
| 密码历史不重用 | ❌ 等保要求 |
| reset 通知用户 | ❌ admin reset 后用户不知道 |

## 风险定级

| 风险 | P | 影响 |
|---|---|---|
| 租户无法自助改密码 | **P0** | 用户被锁在 admin 设的弱密码,密码泄露后只能等 admin |
| 批量创建共享密码 | **P0** | 一份泄露 = N 个租户失陷 |
| 首次未强制改 | P1 | admin 知初始密码,可冒充用户操作 |
| 无过期/历史 | P2-P3 | 不满足等保 2.0 |
| reset 后无通知 | P2 | 用户不知道密码已变 |

---

## P0 — 必补(MVP 上线前)

### P0.1 BE 加 POST /api/console/auth/change-password

**端点**:`POST /api/console/auth/change-password`

**权限**:`@PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_CONFIG_ADMIN','ROLE_AUDITOR','ROLE_TENANT_USER','ROLE_USER')")` — 5 角色全部可调

**Request body**:
```json
{
  "oldPassword": "current-password",
  "newPassword": "new-password-min-12-chars"
}
```

**行为**:
1. 从 SecurityContext 取当前 username + tenantId
2. 验证 oldPassword(Argon2id verify)
3. 校验 newPassword:`@NotBlank @Size(min=12, max=256)`
4. 拒绝 newPassword == oldPassword(防"改"成原密码)
5. Argon2id 哈希 + 更新 console_user_account.password_hash + updated_at + (新)password_changed_at
6. 清 password_must_change 标记(P1 字段)
7. 加 password 到 password_history(P3,可选)
8. **不强制 invalidate session** — 用户可继续用当前 cookie/token

**响应**:
```json
{ "code": "SUCCESS", "message": "Password changed", "data": null }
```

**错误码**:
- 400 INVALID_ARGUMENT — newPassword 不合规
- 401 INVALID_CREDENTIALS — oldPassword 错
- 409 STATE_CONFLICT — newPassword == oldPassword

**实现位置**:
- 新建 `ConsoleAuthChangePasswordController.java` 或合并到 `ConsoleAuthController`
- 复用 `ConsoleUserAccountService.changePassword(username, oldPassword, newPassword)`

**工时**:0.5 天(BE)

### P0.2 BE Excel/批量"每租户独立密码"模式(可选)

**当前**:批量创建时所有租户共享同一初始密码,**这是 P0 安全洞**。

**改造**:`BatchCreateTenantRequest` 加 `passwordMode: 'SHARED' | 'PER_TENANT_RANDOM'`
- SHARED:沿用 form.password(向后兼容)
- PER_TENANT_RANDOM:BE 用 SecureRandom 为每租户生成 16 位 + 返回明文一次

**响应** PER_TENANT_RANDOM 模式时,返回 `Map<tenantId, generatedPassword>`,FE 展示一次性下载/复制按钮:
```json
{
  "code": "SUCCESS",
  "data": {
    "tenants": [
      { "tenantId": "ta", "username": "op-ta", "initialPassword": "Xk7@..." },
      { "tenantId": "tb", "username": "op-tb", "initialPassword": "Yp3$..." }
    ],
    "downloadCsv": "/api/console/files/temp/{token}.csv"
  }
}
```

**工时**:1 天(BE + 数据导出)

---

## P1 — 强制首次改密码

### P1.1 BE schema 加 password_must_change BOOLEAN

```sql
ALTER TABLE batch.console_user_account
  ADD COLUMN password_must_change BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN password_changed_at TIMESTAMPTZ;

-- 历史用户认作"已改过"避免老用户被强制
UPDATE batch.console_user_account SET password_must_change = FALSE WHERE id > 0;
```

**触发置 TRUE 的位置**:
- `ConsoleUserAccountService.create()` — 新建即 TRUE
- `ConsoleUserAccountService.resetPassword()` — admin reset 后 TRUE
- `BatchCreateTenant` — 同样 TRUE

**清 FALSE 位置**:
- `ConsoleAuthService.changePassword()` — 用户自助改后 FALSE + 写 password_changed_at

### P1.2 login response 带 mustChangePassword

`ConsoleAuthLoginResponse` 加字段:
```java
public record ConsoleAuthLoginResponse(
    String accessToken,
    String tokenType,
    String expiresAt,
    boolean mustChangePassword,         // ★ 新增
    UserProfile userInfo
) {}
```

`/api/console/auth/me` 同步加 mustChangePassword 字段。

### P1.3 FE 路由 guard 强制改密码

`src/router/index.ts` `beforeEach`:
```ts
if (auth.userInfo?.mustChangePassword && to.path !== '/me/change-password') {
  return next('/me/change-password')
}
```

强制 modal 模式可选(不让用户绕过)。

**工时**:0.5 天(BE schema + service + login response)+ FE 已有 stub 翻 flag 即可

---

## P2 — reset 通知

### P2.1 admin reset-password 触发通知

`ConsoleUserAccountService.resetPassword()`:
```java
notificationDispatcher.send(NotificationEvent.builder()
    .tenantId(target.tenantId)
    .toUser(target.username)
    .channelType("EMAIL")  // 或 SMS
    .templateCode("PASSWORD_RESET_BY_ADMIN")
    .data(Map.of(
        "username", target.username,
        "operatorUsername", currentAdmin.username,
        "resetAt", Instant.now().toString(),
        "loginUrl", consoleBaseUrl
    ))
    .build());
```

**复用现有 NotificationChannel + Webhook 通知基建**(本项目已有 console_notification_channel 表)。

### P2.2 通知模板

新建 NotificationTemplate `PASSWORD_RESET_BY_ADMIN`:
```
您的账号 {{username}} 密码已被 {{operatorUsername}} 重置(时间:{{resetAt}})。
请尽快登录 {{loginUrl}} 修改新密码并妥善保管。
若非本人操作,请立即联系系统管理员。
```

**工时**:0.5 天(BE 触发 + 模板配置)

---

## P3 — 过期策略 + 历史不重用

### P3.1 password_expires_at

```sql
ALTER TABLE batch.console_user_account
  ADD COLUMN password_expires_at TIMESTAMPTZ;

-- 计算规则:password_changed_at + INTERVAL '90 days'
-- 触发器或应用层维护
```

login 时 BE 检查:
- `now > password_expires_at` → 强制改密码(同 P1.3 must_change=TRUE 路径)
- `now > password_expires_at - 7 days` → login response 带 `passwordExpiringIn: 5` 字段,FE banner 提示

### P3.2 password_history 防重用

新建表:
```sql
CREATE TABLE batch.console_user_password_history (
  id BIGSERIAL PRIMARY KEY,
  user_account_id BIGINT NOT NULL REFERENCES batch.console_user_account(id),
  password_hash VARCHAR(512) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_password_history_user_created ON batch.console_user_password_history(user_account_id, created_at DESC);
```

`changePassword()` 行为:
1. 取最近 5 条 history hash
2. Argon2id verify 新密码不在 history 里
3. 验过后写入新 hash 到 history
4. 防表无限增长:定期清理 > 5 条的老记录

### P3.3 FE 过期 banner

`DefaultLayout.vue` 加:
```vue
<el-alert
  v-if="auth.userInfo?.passwordExpiringIn != null && auth.userInfo.passwordExpiringIn <= 7"
  type="warning"
  :title="t('passwordSecurity.expiringBanner', { days: auth.userInfo.passwordExpiringIn })"
  show-icon
  closable
>
  <el-link @click="$router.push('/me/change-password')">{{ t('passwordSecurity.expiringAction') }}</el-link>
</el-alert>
```

**工时**:1 天(BE schema + service + history + 触发器或定时任务)

---

## 实施顺序建议

```
Day 1  P0.1 (BE change-password endpoint) + FE /me 自助改密码页(已 stub,等 BE 翻 flag)
Day 2  P1   (BE must_change flag + login response) + FE 路由 guard 翻 flag
Day 2.5 P0.2 (批量独立密码,可选)
Day 3  P2   (BE reset 通知)
Day 4  P3   (BE 过期 + history + FE banner)
─────────────────────────
合计 ~4 天 BE + 0.5 天 FE 联调
```

## FE 已就位的 stub(等 BE 实现即用)

| FE 改动 | 状态 |
|---|---|
| `src/utils/passwordGenerator.ts` | ✅ 已落(方案 A) |
| `TenantFormDialog` 生成 + 复制 | ✅ 已落 |
| `TenantBatchCreateDialog` 生成 + 复制 | ✅ 已落 |
| `UserAccountList` create/reset 生成 + 复制 | ✅ 已落 |
| **`/system/me` 自助改密码页 UI** | 🔵 下次 commit 加 stub |
| **`changePassword()` API client** | 🔵 下次 commit 加 |
| **`UserInfo.mustChangePassword?: boolean` 类型扩展** | 🔵 下次 commit 加 |
| **路由 guard 检测 mustChangePassword** | 🔵 下次 commit 加(BE 字段缺失时 nop) |
| **过期 banner** | 🔵 下次 commit 加(BE 字段缺失时 nop) |

## 验收清单(每项实施后跑)

### P0.1 验收
- [ ] POST /auth/change-password 5 角色全部可调(扩 RBAC matrix spec)
- [ ] oldPassword 错返 401 + 友好提示
- [ ] newPassword 不合规返 400
- [ ] newPassword == oldPassword 返 409
- [ ] Argon2id 哈希正确写库
- [ ] 不强制 invalidate session

### P1 验收
- [ ] 新建用户 / admin reset → must_change = TRUE
- [ ] login response 带 mustChangePassword
- [ ] FE 路由 guard 拦截到 /me/change-password
- [ ] 改完 must_change = FALSE,下次 login 不再拦截

### P2 验收
- [ ] admin reset 触发邮件/短信
- [ ] 模板渲染 {{username}}/{{operatorUsername}}/{{resetAt}} 正确
- [ ] 通知失败不阻塞 reset 操作(降级)

### P3 验收
- [ ] 90 天后 must_change = TRUE
- [ ] 7 天前 login response 带 passwordExpiringIn
- [ ] FE banner 显示
- [ ] history 5 条不重用

---

## 关联文档

- ADR-030 §D7 — HttpOnly cookie JWT 演进
- `docs/runbook/fe-be-joint-test-report-bplus-cplus.md` — 联调报告
- `src/utils/passwordGenerator.ts` — 方案 A FE 工具
- [rbac_5roles_only](memory) — BE 真实 5 角色
