# E2E 剩余失败根因排查(给后端)— 2026-06-22

> 结论先行:**用实跑后端复现,列出的“写接口 403 / SSE 401-403”当前一个都复现不出来**。
> 这批失败最吻合的解释是 **e2e 跑到一半 console-api 掉线/重启(当时 `console=000`)的环境抖动**,不是真的 RBAC/契约缺陷。
> 真正需要后端动的不是“放开 403”,而是 ①测试环境 console-api 跑不满全程的稳定性,②`admin` 种子账号的两颗地雷(见 §3)。

## 0. 后端日志核查(2026-06-22)

- **失败那一轮的后端日志已不可考**:`logs/app/console.log` 当前只覆盖 **09:21:24→09:37:18**(单次启动,~10KB,起于 `start-all` 重启),里面只有启动日志 + 我做的探测请求;`batch-backend` screen scrollback 为空。**e2e 跑(及当时 `console=000`)是更早那个实例,日志在 09:21 重启时被覆盖、不可恢复。** 当前进程 `console` PID 47587 全是 09:21 新起的。
- **当前实例健康**:`console.log` 除我探测的校验 WARN 外**无 ERROR / 无 AccessDenied / 无 403 / 无崩溃**。并确认两条配置事实:
  - `WARN ... bypass-mode=true — 全链路安全旁路已启用`(印证 bypass 开)。
  - `WARN ConsoleDefaultPasswordGuard ... 内置账号 [admin,auditor,config-admin] 仍用默认密码 admin123,首次登录会被强制改密` —— **印证 §3 的改密地雷真实存在**。
- **决定性反证(合法写直接成功)**:用 admin(tenant=system)合法 body 写 `POST /quota-policies?tenantId=ta` → **200 SUCCESS**(建出 id=1103, tenant_id=ta;事后已 toggle 关闭清理)。**这一刀切断了所有 403 假设**:平台 `ROLE_ADMIN` 跨租户写 `ta` 成功 = 角色没问题、租户作用域没拦、改密守护没拦(bypass 旁路)。

> 行动:要拿到失败那轮的真实证据,只能**对当前健康后端重跑一轮**并同时 `tail -f logs/app/console.log`。现状证据指向环境抖动而非 RBAC。

## 1. 复现方法(实跑,非推断)

后端在线:`console=18080`(`/api/console/auth/me` 200)。用 e2e 同一套真实凭据 `admin/admin123` 登录后逐个打写接口。

```
# 登录
POST /api/console/auth/login {"username":"admin","password":"admin123"}
→ 200  data.tenantId="system"  authorities=["ROLE_ADMIN"]  mustChangePassword=true
```

| 探测 | 结果 | 含义 |
|---|---|---|
| `POST /quota-policies?tenantId=ta`(admin cookie) | **400 VALIDATION_ERROR**（"code is required"） | 过了鉴权/租户/改密守护,到了参数校验 |
| `POST /quota-policies?tenantId=system` | **400 VALIDATION_ERROR** | 同上,租户=system 也只是校验失败 |
| `POST /alert-routings?tenantId=ta` | **400 VALIDATION_ERROR** | 同上 |
| `POST /quota-policies`(**完全不带 cookie**) | **400**(不是 401) | **关键证据:bypass-mode 当前是开的**——鉴权过滤器放行未认证请求 |
| `POST /auth/stream/ticket?tenantId=system / =ta` | **200**(签出 ticket) | SSE ticket 当前不 401/403 |

> 即:当前后端 `batch.security.bypass-mode=true`,@PreAuthorize 与改密守护都被旁路,
> 任意写请求(带不带 cookie)都能走到参数校验;SSE ticket 正常签发。**没有 403。**

## 2. 那 e2e 的 403 / 401 从哪来

- 你自己也观测到:完整 `test:e2e` 跑到中途 **console-api 掉线(健康检查 `console=000`)**,后半段 369 did-not-run + 51 failed 多为此期间产物;事后单独复跑导航/监控/通知/可观测性**已恢复通过**。
- 后端 down/重启期间,前端对受保护接口的请求会拿到非 2xx(网关/重置/重启窗口里短暂 401/403/000),被 e2e 记成“写接口 403 / SSE 401-403”。
- **本质是环境抖动,不是 RBAC 判定**。佐证:稳态下用 admin 实跑,这些接口全是 400(校验)或 200,无一 403。

**给后端的第一行动项(最重要):** 排查 console-api 为何撑不满一轮完整 e2e(15–20 分钟)——OOM?自重启?(参考本机已知:JDK25 下 Spring Boot 嵌套 jar loader / Spring AI Anthropic 缺 okhttp 起不来等)。**先让 console-api 全程不掉,再跑一轮干净的全量 e2e**,大部分“失败”预计自动消失。

## 3. `admin` 种子账号的两颗地雷(bypass 关掉就会真 403)

当前 bypass 开着掩盖了这两点。一旦 e2e 改用更接近生产的 profile(bypass 关),它们会变成**真 403**:

1. **`admin` 的 `mustChangePassword=true`** — 改密守护过滤器(onboarding,console_user_account.must_change_password)会**拦截 must-change 账号的写操作**(白名单除外)直到改密。bypass 关时,admin 所有写 → 403。
   - **修法(择一):** 种子里给 e2e 用的 admin 置 `must_change_password=false`;或 e2e `global-setup` 登录后先调 `POST /auth/change-password` 再跑用例。

2. **`admin` 属租户 `system`,而 e2e 全程硬编码 `tenantId=ta`** — 租户作用域校验**即使 bypass 开也始终生效**(本次没拦是因为 admin 是平台 ROLE_ADMIN、当前判定允许跨租;但如果后端对租户作用域收紧/配 `allowed-tenants` 白名单,system≠ta 会 403)。
   - **修法:** 要么确认平台 ROLE_ADMIN 设计上可跨租写(那就没问题、文档化);要么 e2e 改用一个**归属 `ta` 租户**的写权限账号;要么给 system 租户也建对应测试数据。

## 4. RBAC/契约参考(若将来 bypass 关,这些是真实门槛)

各写接口的 `@PreAuthorize`(后端实测/读码):

| 接口 | 写权限要求 | admin 是否满足 |
|---|---|---|
| `/alert-routings` POST/PUT/DELETE | `ROLE_ADMIN` | ✅ |
| `/quota-policies` | `ROLE_ADMIN` | ✅ |
| `/job-definitions` POST/PUT/DELETE | `ROLE_ADMIN`(GET 放宽到 4 角色) | ✅ |
| trigger / rerun / compensation 写 | `ROLE_ADMIN` | ✅ |
| outbox cleanup/republish | `ROLE_ADMIN`(经 orchestrator proxy) | ✅ |
| config release publish/rollback、审批 | `ROLE_ADMIN` | ✅ |
| 手动 trigger `/jobs/trigger` | `ROLE_ADMIN` 或 `ROLE_TENANT_USER` | ✅ |
| `POST /auth/stream/ticket` | `isAuthenticated()`(需有效 JWT) | ✅(登录后) |

→ **admin 角色本身满足所有写接口**,所以“403 因缺角色”这一假设不成立。真正会卡 admin 的只有 §3 的改密守护 + 租户作用域。

- **security headers:** 后端无条件下发 CSP / HSTS / X-Frame-Options / X-Content-Type-Options,bypass 不削弱;e2e 里的 header 断言失败同样指向 down 窗口(down 时无响应头)。
- **multi-tenant 契约:** tenantId 走 **query 参数**(非 header);租户作用域始终校验。e2e 的 multi-tenant 用例失败建议在稳态重跑确认。

## 5. 建议给后端的话术(一句话)

> “列的写接口 403 / SSE 401-403,在稳态后端用 admin 实跑复现不出来(全是 400 校验或 200);最可能是 e2e 跑途中 console-api 掉线(console=000)的抖动。请先解决 console-api 撑不满整轮 e2e 的稳定性再复跑;另外 `admin` 种子账号 `mustChangePassword=true` 且属 `system` 租户,bypass 一旦关闭会真 403,建议种子置 must_change=false 或 e2e 账号归属 `ta`。”
