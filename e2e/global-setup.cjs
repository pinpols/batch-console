// @ts-check
const { writeFileSync, mkdirSync, readFileSync, existsSync } = require('fs')
const path = require('path')
const crypto = require('crypto')

const API_BASE = 'http://localhost:18080'
const FIXTURE_TENANT = 'system'

// 超时常量（ms）
const T_SHORT = 8_000 // 登录、导出等轻量接口
const T_UPLOAD = 20_000 // 文件上传
const T_APPLY = 30_000 // 配置包应用（事务较重）

/**
 * 把 fetch 响应的 Set-Cookie 头解析成 Playwright storageState cookie 对象。
 * Playwright cookie schema: { name, value, domain, path, expires, httpOnly, secure, sameSite }
 *
 * 我们的 BE 通常下发的 cookie 是 SESSION / accessToken,带 HttpOnly + Path=/。
 * 这里做最小解析:取 first kv 作为 name=value,后续 attribute 解析 Path/Domain/HttpOnly/Secure/SameSite。
 * Max-Age / Expires 暂不处理(测试场景内不会过期)。
 */
function parseSetCookieForStorageState(raw, originUrl) {
  const segments = String(raw).split(';').map((s) => s.trim())
  const [first, ...attrs] = segments
  const eq = first.indexOf('=')
  const name = first.slice(0, eq).trim()
  const value = first.slice(eq + 1).trim()
  const url = new URL(originUrl)
  const cookie = {
    name,
    value,
    domain: url.hostname,
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }
  for (const a of attrs) {
    const [k, v = ''] = a.split('=').map((s) => s.trim())
    const lk = k.toLowerCase()
    if (lk === 'path') cookie.path = v
    else if (lk === 'domain') cookie.domain = v.startsWith('.') ? v.slice(1) : v
    else if (lk === 'httponly') cookie.httpOnly = true
    else if (lk === 'secure') cookie.secure = true
    else if (lk === 'samesite') {
      const normalized = v.toLowerCase()
      cookie.sameSite =
        normalized === 'strict' ? 'Strict' : normalized === 'none' ? 'None' : 'Lax'
    }
  }
  return cookie
}

/** 幂等 key */
function idempotencyKey() {
  return crypto.randomUUID()
}

/**
 * Seed / fixture endpoints run from Node fetch, not the browser context.
 * Newer console-api builds issue auth only through HttpOnly cookies, so the
 * setup must replay those cookies instead of relying on a response-body token.
 */
function buildAuthHeaders(token, cookies) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (Array.isArray(cookies) && cookies.length > 0) {
    headers.Cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  }
  return headers
}

/**
 * 带超时的 fetch 封装（AbortController + setTimeout，兼容所有环境）。
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number }} opts
 */
async function fetchWithTimeout(url, opts = {}) {
  const { timeoutMs = T_SHORT, ...rest } = opts
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new Error(`fetch timeout ${timeoutMs}ms: ${url}`)),
    timeoutMs,
  )
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

/**
 * 向指定租户上传并应用租户配置包 Excel。
 */
async function seedTenant(authHeaders, tenantId, filePath) {
  if (!existsSync(filePath)) {
    console.warn(`[seed] 文件不存在，跳过 ${tenantId}: ${filePath}`)
    return
  }

  const commonHeaders = {
    ...authHeaders,
    'X-Tenant-Id': tenantId,
  }

  const fileBuffer = readFileSync(filePath)

  // ── ① 上传 ──────────────────────────────────────────────────────
  let uploadToken
  try {
    const formData = new FormData()
    formData.append(
      'file',
      new Blob([fileBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      path.basename(filePath),
    )

    // 全局角色（admin）需显式带上 tenantId 给 ConsoleTenantGuard 解析
    const uploadRes = await fetchWithTimeout(
      `${API_BASE}/api/console/config/tenant-package/excel/upload?tenantId=${encodeURIComponent(tenantId)}`,
      {
        method: 'POST',
        headers: {
          ...commonHeaders,
          'Idempotency-Key': idempotencyKey(),
        },
        body: formData,
        timeoutMs: T_UPLOAD,
      },
    )

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '')
      console.warn(`[seed] 上传失败 tenant=${tenantId} status=${uploadRes.status} ${text}`)
      return
    }

    const uploadJson = await uploadRes.json()
    uploadToken = uploadJson?.data?.uploadToken ?? uploadJson?.uploadToken
    if (!uploadToken) {
      console.warn(`[seed] 响应中无 uploadToken，跳过 tenant=${tenantId}`)
      return
    }
    console.log(`[seed] 上传成功 tenant=${tenantId} token=${uploadToken}`)
  } catch (err) {
    console.warn(`[seed] 上传异常 tenant=${tenantId}: ${err.message}`)
    return
  }

  // ── ② 预览校验 ──────────────────────────────────────────────────
  // 当前 11-sheet 权威样本包含 pipeline_step_definition；如果本地只启动 console-api、
  // 未启动 worker 注册 step_registry，后端会判定 impl_code 未注册。此时继续 apply
  // 只会得到 400，且污染 e2e 日志。先 preview，发现漂移就显式跳过。
  try {
    const previewRes = await fetchWithTimeout(
      `${API_BASE}/api/console/config/tenant-package/excel/preview/${encodeURIComponent(uploadToken)}?tenantId=${encodeURIComponent(tenantId)}`,
      {
        headers: commonHeaders,
        timeoutMs: T_SHORT,
      },
    )
    if (!previewRes.ok) {
      const text = await previewRes.text().catch(() => '')
      console.warn(`[seed] 预览失败 tenant=${tenantId} status=${previewRes.status} ${text}`)
      return
    }
    const previewJson = await previewRes.json()
    const data = previewJson?.data ?? previewJson
    if ((data?.invalidRows ?? 0) > 0) {
      const issues = Array.isArray(data?.issues) ? data.issues.slice(0, 5) : []
      const summary = issues
        .map((x) => `${x.sheetName ?? '?'}#${x.rowNo ?? '?'} ${x.message ?? ''}`.trim())
        .join(' | ')
      console.warn(
        `[seed] 预览存在无效行，跳过 apply tenant=${tenantId} invalidRows=${data.invalidRows}${summary ? `: ${summary}` : ''}`,
      )
      return
    }
  } catch (err) {
    console.warn(`[seed] 预览异常 tenant=${tenantId}: ${err.message}`)
    return
  }

  // ── ③ 应用 ──────────────────────────────────────────────────────
  try {
    const applyRes = await fetchWithTimeout(
      `${API_BASE}/api/console/config/tenant-package/excel/apply/${encodeURIComponent(uploadToken)}`,
      {
        method: 'POST',
        headers: {
          ...commonHeaders,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({}),
        timeoutMs: T_APPLY,
      },
    )

    if (!applyRes.ok) {
      const text = await applyRes.text().catch(() => '')
      console.warn(`[seed] 应用失败 tenant=${tenantId} status=${applyRes.status} ${text}`)
    } else {
      console.log(`[seed] ✓ tenant=${tenantId} 配置包导入完成`)
    }
  } catch (err) {
    console.warn(`[seed] 应用异常 tenant=${tenantId}: ${err.message}`)
  }
}

/**
 * 导出租户配置包作为 UI 上传测试的 fixture 文件。
 */
async function exportTenantPackageFixture(authHeaders) {
  const outPath = path.resolve(__dirname, '../test-excel-abc/tenant-package-export.xlsx')
  if (existsSync(outPath)) {
    console.log('[fixture] 已存在，跳过租户包导出')
    return
  }
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/console/config/tenant-package/excel/export?tenantId=${encodeURIComponent(FIXTURE_TENANT)}`,
      { headers: { ...authHeaders, 'X-Tenant-Id': FIXTURE_TENANT } },
    )
    if (!res.ok) {
      console.warn(`[fixture] 租户包导出失败 status=${res.status}`)
      return
    }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(outPath, buf)
    console.log(`[fixture] ✓ 导出租户包 → ${outPath}`)
  } catch (err) {
    console.warn(`[fixture] 租户包导出异常: ${err.message}`)
  }
}

/**
 * 租户配置包 seed xlsx 的源在后端仓库下，前端仅引用不再保存副本，
 * 防止两份文件漂移（权威源：
 * file-batch-system/docs/test-data/test-full-coverage-import-suite/README.md）。
 * 相对路径规则：batch-console 与 file-batch-system 同级目录。
 */
const SEED_SUITE_DIR = path.resolve(
  __dirname,
  '../../file-batch-system/docs/test-data/test-full-coverage-import-suite',
)

const TENANT_EXCELS = [
  { tenantId: 'ta', file: path.join(SEED_SUITE_DIR, 'ta-tenant-config-package-test.xlsx') },
  { tenantId: 'tb', file: path.join(SEED_SUITE_DIR, 'tb-tenant-config-package-test.xlsx') },
  { tenantId: 'tc', file: path.join(SEED_SUITE_DIR, 'tc-tenant-config-package-test.xlsx') },
]

/**
 * 全局 Setup：
 *   1. 登录获取 JWT
 *   2. 为 ta / tb / tc 三个租户导入配置包 Excel（超时即跳过，不阻断测试）
 *   3. 导出 fixture 文件供 UI 上传链路测试使用
 *   4. 写入 storageState（默认测试租户为 ta）
 *
 * @param {import('@playwright/test').FullConfig} config
 */
async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:5173'

  // ── 登录 ────────────────────────────────────────────────────────
  // D7 Stage B(commit 6405b5a):token 已迁到 HttpOnly cookie,localStorage 不再存。
  // 2026-05-18 后续 BE 进一步把 accessToken 从响应 body 也移除 — 仅靠 Set-Cookie 下发。
  // 所以 seed 路径若需要 Authorization header 应改用 cookie jar 调,不再走 Bearer。
  // 当前 setup:
  //   1) 解析响应 Set-Cookie,后面写进 storageState.cookies 让浏览器自动携带
  //   2) 若 body 仍带 accessToken 兼容旧版,作为可选 seed token 使用
  let token
  let authCookies = []
  try {
    const loginRes = await fetchWithTimeout(`${API_BASE}/api/console/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'system' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    if (!loginRes.ok) throw new Error(`HTTP ${loginRes.status}`)
    const loginJson = await loginRes.json()
    token = loginJson?.data?.accessToken // 可空(2026-05 后 BE 不再回写 body)
    // Node 18+: Headers.getSetCookie() 返回 string[];老节点 fallback 到 raw Set-Cookie
    const setCookies =
      typeof loginRes.headers.getSetCookie === 'function'
        ? loginRes.headers.getSetCookie()
        : [loginRes.headers.get('set-cookie')].filter(Boolean)
    authCookies = setCookies.map((raw) => parseSetCookieForStorageState(raw, baseURL))
    if (authCookies.length === 0) {
      throw new Error('响应中既无 accessToken 也无 Set-Cookie,登录可能未成功')
    }
    console.log(
      `[global-setup] 登录成功,expires: ${loginJson?.data?.expiresAt},cookies: ${authCookies.length}${token ? ',token: 有(body)' : ',token: 仅 cookie'}`,
    )
  } catch (err) {
    console.warn(`[global-setup] 登录失败（${err.message}），跳过 seed,仅写入 storageState`)
  }

  // ── 导入测试数据 ─────────────────────────────────────────────────
  const seedAuthHeaders = buildAuthHeaders(token, authCookies)
  if (Object.keys(seedAuthHeaders).length > 0) {
    for (const { tenantId, file } of TENANT_EXCELS) {
      await seedTenant(seedAuthHeaders, tenantId, file)
    }
    await exportTenantPackageFixture(seedAuthHeaders)
  }

  // ── 写 storageState（默认测试租户 ta，与 seedTenant 目标一致）──────
  const authDir = path.resolve('e2e/.auth')
  mkdirSync(authDir, { recursive: true })

  const storageState = {
    cookies: authCookies,
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: 'batch-console-tenant-id', value: 'ta' },
          // FE 的 router beforeEach 检查这个 flag 决定 isLoggedIn(见 stores/auth.ts SESSION_FLAG_KEY)
          // 必须设,否则即使 HttpOnly cookie 有效,FE 也会直接 redirect 到 /login。
          { name: 'batch-console-session', value: '1' },
          // D7 Stage B 后 FE 不再读这个 key,保留是为兼容旧 spec 里可能的引用;真正的鉴权走 cookie。
          { name: 'token', value: token ?? '' },
          // 强制中文 locale,避免某些 spec 没走 enterDemoApp 时 i18n 拿到浏览器默认 en-US
          // 见 src/constants/locale.ts:1 (LOCALE_STORAGE_KEY)
          { name: 'batch-console:locale', value: 'zh-CN' },
          // 关掉首次登录引导(driver.js tour),避免 overlay 拦截点击
          // 见 src/composables/useOnboardingTour.ts:14
          { name: 'batch-console-onboarding-done', value: '1' },
        ],
      },
    ],
  }

  writeFileSync(path.join(authDir, 'user.json'), JSON.stringify(storageState, null, 2))
  console.log('[global-setup] storageState 已写入，默认测试租户: ta')

  // ── 刷新分角色 storageState(role-*.json) ─────────────────────────
  // scenarios-business / multi-tenant-and-stream / c-plus-coverage / rbac-matrix /
  // flows/_watchdog 都直接读这些文件做 APIRequestContext。
  // 旧版只生成 user.json,role-*.json 的 token 容易过期导致 401。
  // 这里按已知账号矩阵重新登录刷新。
  // !!! BE 对同一 username 只保留最近一次 login 的 token,后登录的 token 会让之前的失效。
  //     所以 admin 这一项必须复用上面写到 user.json 的同一份 cookies,不能再 login 一次,
  //     否则会反过来把 user.json 的 token 作废,导致全量 e2e 集体 401。
  const ROLE_LOGINS = [
    { file: 'role-tenantUser.json', username: 'op-tx', password: 'admin123', tenantId: 'tx', defaultTenant: 'tx' },
    { file: 'role-auditor.json', username: 'auditor', password: 'admin123', tenantId: 'system', defaultTenant: 'ta' },
    // 2026-05 ADR-032:CONFIG_ADMIN 已合并 ADMIN;改为登录 TENANT_ADMIN(ta 租户管理员)。
    // tadmin-ta 由 admin 通过 POST /api/console/users 显式创建(密码 Admin@123abc),首次跑前手工种入。
    { file: 'role-tenantAdmin.json', username: 'tadmin-ta', password: 'Admin@123abc', tenantId: 'ta', defaultTenant: 'ta' },
    { file: 'role-user.json', username: 'user-tx', password: 'admin123', tenantId: 'tx', defaultTenant: 'tx' },
  ]
  // role-admin.json 直接复用 user.json 的 cookies(同 username,避免互踩 session)
  writeFileSync(path.join(authDir, 'role-admin.json'), JSON.stringify(storageState, null, 2))
  for (const role of ROLE_LOGINS) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/console/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': role.tenantId },
        body: JSON.stringify({ username: role.username, password: role.password }),
      })
      if (!res.ok) {
        console.warn(`[global-setup] role 登录失败 ${role.username}: HTTP ${res.status},跳过 ${role.file}`)
        continue
      }
      const body = await res.json()
      const setCookies =
        typeof res.headers.getSetCookie === 'function'
          ? res.headers.getSetCookie()
          : [res.headers.get('set-cookie')].filter(Boolean)
      const cookies = setCookies.map((raw) => parseSetCookieForStorageState(raw, baseURL))
      const roleState = {
        cookies,
        origins: [
          {
            origin: baseURL,
            localStorage: [
              { name: 'batch-console-tenant-id', value: role.defaultTenant },
              { name: 'batch-console-session', value: '1' },
              { name: 'token', value: body?.data?.accessToken ?? '' },
              { name: 'batch-console:locale', value: 'zh-CN' },
              { name: 'batch-console-onboarding-done', value: '1' },
            ],
          },
        ],
      }
      writeFileSync(path.join(authDir, role.file), JSON.stringify(roleState, null, 2))
    } catch (err) {
      console.warn(`[global-setup] role 登录异常 ${role.username}: ${err.message},跳过 ${role.file}`)
    }
  }
  console.log('[global-setup] role-*.json 已刷新')
}

module.exports = globalSetup
