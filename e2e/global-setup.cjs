// @ts-check
const storageKeys = require('../src/constants/storageKeys.json')
const { writeFileSync, mkdirSync, readFileSync, existsSync } = require('fs')
const path = require('path')
const crypto = require('crypto')
const { API_BASE_URL, DEFAULT_LOCALE, FRONTEND_BASE_URL } = require('./config.cjs')

const API_BASE = API_BASE_URL
const FIXTURE_TENANT = 'system'

// 超时常量（ms）
const T_SHORT = 8_000 // 登录、导出等轻量接口
const T_UPLOAD = 20_000 // 文件上传
const T_APPLY = 30_000 // 配置包应用（事务较重）
const RATE_LIMIT_RETRY_DELAYS_MS = [1_500, 3_000, 5_000]
const FORCE_SEED = process.env.E2E_FORCE_SEED === '1'
const REQUIRE_CONFIG_SEED = process.env.E2E_REQUIRE_CONFIG_SEED === '1'
const IS_STAGING_TARGET = process.env.E2E_TARGET_ENV === 'staging'

/**
 * 把 fetch 响应的 Set-Cookie 头解析成 Playwright storageState cookie 对象。
 * Playwright Cookie 结构：{ name, value, domain, path, expires, httpOnly, secure, sameSite }
 *
 * 认证 Cookie 由后端下发，名称与属性从响应读取，不在这里另造令牌。
 * 这里做最小解析:取 first kv 作为 name=value,后续 attribute 解析 Path/Domain/HttpOnly/Secure/SameSite。
 * Max-Age / Expires 暂不处理(测试场景内不会过期)。
 */
function parseSetCookieForStorageState(raw, originUrl) {
  const segments = String(raw)
    .split(';')
    .map((s) => s.trim())
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
      cookie.sameSite = normalized === 'strict' ? 'Strict' : normalized === 'none' ? 'None' : 'Lax'
    }
  }
  return cookie
}

/** 幂等 key */
function idempotencyKey() {
  return crypto.randomUUID()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 种子数据和夹具端点由 Node fetch 调用，不经过浏览器上下文。
 * 新版 console-api 仅通过 HttpOnly Cookie 下发认证信息，因此初始化逻辑必须复用这些
 * Cookie，不能依赖响应体中的令牌。
 */
function buildAuthHeaders(cookies) {
  const headers = {}
  if (Array.isArray(cookies) && cookies.length > 0) {
    headers.Cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const csrfToken = csrfTokenFromCookies(cookies)
    if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken
  }
  return headers
}

function csrfTokenFromCookies(cookies) {
  return Array.isArray(cookies)
    ? cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value
    : undefined
}

function getSetCookies(response) {
  return typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)
}

async function loginRoleAccount(role, baseURL) {
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length; attempt += 1) {
    const response = await fetchWithTimeout(`${API_BASE}/api/console/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': role.tenantId },
      body: JSON.stringify({ username: role.username, password: role.password }),
    })
    if (response.status === 429 && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
      await sleep(RATE_LIMIT_RETRY_DELAYS_MS[attempt])
      continue
    }

    const body = await response.json().catch(() => null)
    const cookies = response.ok
      ? getSetCookies(response).map((raw) => parseSetCookieForStorageState(raw, baseURL))
      : []
    return { response, body, cookies }
  }
  throw new Error(`role login retry exhausted: ${role.username}`)
}

function roleStorageState(login, role, baseURL) {
  return {
    cookies: login.cookies,
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: storageKeys.tenantId, value: role.defaultTenant },
          { name: storageKeys.session, value: '1' },
          { name: storageKeys.locale, value: DEFAULT_LOCALE },
          { name: storageKeys.onboardingDone, value: '1' },
        ],
      },
    ],
  }
}

async function callAdminUserApi(authHeaders, pathname, init = {}) {
  const method = init.method ?? 'GET'
  const response = await fetchWithTimeout(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      ...authHeaders,
      'X-Tenant-Id': 'system',
      ...(method === 'GET' ? {} : { 'Idempotency-Key': idempotencyKey() }),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`${method} ${pathname} failed: HTTP ${response.status} ${JSON.stringify(body)}`)
  }
  return body?.data ?? body
}

async function ensureFixtureTenant(authHeaders, tenantId) {
  const tenantUrl = `${API_BASE}/api/console/tenants/${encodeURIComponent(tenantId)}`
  const tenantResponse = await fetchWithTimeout(tenantUrl, {
    headers: { ...authHeaders, 'X-Tenant-Id': 'system' },
  })
  if (tenantResponse.ok) return
  if (tenantResponse.status !== 404) {
    const body = await tenantResponse.text().catch(() => '')
    throw new Error(
      `GET /api/console/tenants/${tenantId} failed: HTTP ${tenantResponse.status} ${body}`,
    )
  }

  await callAdminUserApi(authHeaders, '/api/console/tenants', {
    method: 'POST',
    body: JSON.stringify({
      tenantId,
      tenantName: `E2E fixture ${tenantId}`,
      username: `e2e-admin-${tenantId}`,
      password: 'E2eFixture@9371',
    }),
  })
  console.log(`[global-setup] fixture 租户已创建 ${tenantId}`)
}

function seedFailure(message) {
  console.warn(message)
  if (REQUIRE_CONFIG_SEED) throw new Error(message)
}

async function findRoleAccount(authHeaders, role) {
  const params = new URLSearchParams({
    tenantId: role.tenantId,
    keyword: role.username,
    pageNo: '1',
    pageSize: '100',
  })
  const page = await callAdminUserApi(authHeaders, `/api/console/users?${params}`)
  const items = Array.isArray(page) ? page : (page?.items ?? page?.records ?? [])
  return items.find((item) => item.username === role.username)
}

async function ensureRoleAccount(authHeaders, role) {
  let account = await findRoleAccount(authHeaders, role)
  if (!account) {
    account = await callAdminUserApi(authHeaders, '/api/console/users', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: role.tenantId,
        username: role.username,
        password: role.password,
        displayName: role.displayName,
        authoritiesCsv: role.authority,
      }),
    })
    console.log(`[global-setup] role 账号已创建 ${role.username} (${role.authority})`)
    return account
  }

  if (account.tenantId !== role.tenantId) {
    throw new Error(
      `role account tenant mismatch: ${role.username}, expected=${role.tenantId}, actual=${account.tenantId}`,
    )
  }
  if (account.authoritiesCsv !== role.authority) {
    account = await callAdminUserApi(authHeaders, `/api/console/users/${account.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        displayName: account.displayName ?? role.displayName,
        authoritiesCsv: role.authority,
      }),
    })
    console.log(`[global-setup] role 权限已校正 ${role.username} → ${role.authority}`)
  }
  if (!account.enabled) {
    account = await callAdminUserApi(authHeaders, `/api/console/users/${account.id}/enable`, {
      method: 'POST',
    })
    console.log(`[global-setup] role 账号已启用 ${role.username}`)
  }
  return account
}

async function changeRolePassword(login, currentPassword, newPassword) {
  const response = await fetchWithTimeout(`${API_BASE}/api/console/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: login.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
      ...(csrfTokenFromCookies(login.cookies)
        ? { 'X-XSRF-TOKEN': csrfTokenFromCookies(login.cookies) }
        : {}),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`change password failed: HTTP ${response.status} ${body}`)
  }
}

async function prepareRoleLogin(authHeaders, role, baseURL) {
  const account = await ensureRoleAccount(authHeaders, role)
  let login = await loginRoleAccount(role, baseURL)
  const mustChangePassword = login.body?.data?.mustChangePassword === true
  if (login.response.ok && !mustChangePassword && login.cookies.length > 0) return login

  const temporaryPassword = 'E2eReset@9371'
  if (login.response.ok && mustChangePassword) {
    await changeRolePassword(login, role.password, temporaryPassword)
  } else {
    await callAdminUserApi(authHeaders, `/api/console/users/${account.id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword: temporaryPassword }),
    })
  }

  const temporaryLogin = await loginRoleAccount({ ...role, password: temporaryPassword }, baseURL)
  if (!temporaryLogin.response.ok || temporaryLogin.cookies.length === 0) {
    throw new Error(
      `temporary role login failed: ${role.username}, HTTP ${temporaryLogin.response.status}`,
    )
  }
  await changeRolePassword(temporaryLogin, temporaryPassword, role.password)
  login = await loginRoleAccount(role, baseURL)
  if (!login.response.ok || login.cookies.length === 0) {
    throw new Error(
      `role login failed after repair: ${role.username}, HTTP ${login.response.status}`,
    )
  }
  console.log(`[global-setup] role 密码状态已修复 ${role.username}`)
  return login
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

async function tenantConfigAlreadyPresent(commonHeaders, tenantId) {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/console/queries/job-definitions?tenantId=${encodeURIComponent(tenantId)}&pageSize=1`,
      {
        headers: commonHeaders,
        timeoutMs: T_SHORT,
      },
    )
    if (!res.ok) return false
    const body = await res.json().catch(() => null)
    const data = body?.data ?? body
    const items = Array.isArray(data) ? data : (data?.items ?? data?.records ?? [])
    return Array.isArray(items) && items.length > 0
  } catch {
    return false
  }
}

/**
 * 向指定租户上传并应用租户配置包 Excel。
 */
async function seedTenant(authHeaders, tenantId, filePath) {
  if (!existsSync(filePath)) {
    seedFailure(`[seed] 文件不存在 ${tenantId}: ${filePath}`)
    return
  }

  const commonHeaders = {
    ...authHeaders,
    'X-Tenant-Id': tenantId,
  }

  if (!FORCE_SEED && (await tenantConfigAlreadyPresent(commonHeaders, tenantId))) {
    console.log(
      `[seed] tenant=${tenantId} 已存在作业配置，跳过配置包导入(E2E_FORCE_SEED=1 可强制重刷)`,
    )
    return
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
      seedFailure(`[seed] 上传失败 tenant=${tenantId} status=${uploadRes.status} ${text}`)
      return
    }

    const uploadJson = await uploadRes.json()
    uploadToken = uploadJson?.data?.uploadToken ?? uploadJson?.uploadToken
    if (!uploadToken) {
      seedFailure(`[seed] 响应中无 uploadToken tenant=${tenantId}`)
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
  let previewToken
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
      seedFailure(`[seed] 预览失败 tenant=${tenantId} status=${previewRes.status} ${text}`)
      return
    }
    const previewJson = await previewRes.json()
    const data = previewJson?.data ?? previewJson
    previewToken = data?.previewToken
    if (typeof previewToken !== 'string' || previewToken.trim() === '') {
      seedFailure(`[seed] 预览响应缺少 previewToken tenant=${tenantId}`)
      return
    }
    if ((data?.invalidRows ?? 0) > 0) {
      const issues = Array.isArray(data?.issues) ? data.issues.slice(0, 5) : []
      const summary = issues
        .map((x) => `${x.sheetName ?? '?'}#${x.rowNo ?? '?'} ${x.message ?? ''}`.trim())
        .join(' | ')
      seedFailure(
        `[seed] 预览存在无效行，跳过 apply tenant=${tenantId} invalidRows=${data.invalidRows}${summary ? `: ${summary}` : ''}`,
      )
      return
    }
  } catch (err) {
    seedFailure(`[seed] 预览异常 tenant=${tenantId}: ${err.message}`)
    return
  }

  // ── ③ 应用 ──────────────────────────────────────────────────────
  try {
    for (let attempt = 0; attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length; attempt += 1) {
      const applyRes = await fetchWithTimeout(
        `${API_BASE}/api/console/config/tenant-package/excel/apply/${encodeURIComponent(uploadToken)}`,
        {
          method: 'POST',
          headers: {
            ...commonHeaders,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey(),
          },
          body: JSON.stringify({ previewToken }),
          timeoutMs: T_APPLY,
        },
      )

      if (applyRes.ok) {
        console.log(`[seed] ✓ tenant=${tenantId} 配置包导入完成`)
        return
      }

      const text = await applyRes.text().catch(() => '')
      if (applyRes.status === 429 && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
        const delay = RATE_LIMIT_RETRY_DELAYS_MS[attempt]
        console.warn(
          `[seed] 应用被限流 tenant=${tenantId} status=429, ${delay}ms 后重试(${attempt + 1}/${RATE_LIMIT_RETRY_DELAYS_MS.length})`,
        )
        await sleep(delay)
        continue
      }

      seedFailure(`[seed] 应用失败 tenant=${tenantId} status=${applyRes.status} ${text}`)
      return
    }
  } catch (err) {
    seedFailure(`[seed] 应用异常 tenant=${tenantId}: ${err.message}`)
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
    mkdirSync(path.dirname(outPath), { recursive: true })
    const res = await fetchWithTimeout(
      `${API_BASE}/api/console/config/tenant-package/excel/export?tenantId=${encodeURIComponent(FIXTURE_TENANT)}`,
      { headers: { ...authHeaders, 'X-Tenant-Id': FIXTURE_TENANT } },
    )
    if (!res.ok) {
      seedFailure(`[fixture] 租户包导出失败 status=${res.status}`)
      return
    }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(outPath, buf)
    console.log(`[fixture] ✓ 导出租户包 → ${outPath}`)
  } catch (err) {
    seedFailure(`[fixture] 租户包导出异常: ${err.message}`)
  }
}

/**
 * 租户配置包 seed xlsx 的源在后端仓库下，前端仅引用不再保存副本，
 * 防止两份文件漂移（权威源：
 * file-batch-system/test-data/tenant-config-packages/README.md）。
 * 相对路径规则：batch-console 与 file-batch-system 同级目录。
 */
const SEED_SUITE_DIR = path.resolve(
  __dirname,
  '../../file-batch-system/test-data/tenant-config-packages',
)

const TENANT_EXCELS = [
  { tenantId: 'ta', file: path.join(SEED_SUITE_DIR, 'ta-tenant-config-package-test.xlsx') },
  { tenantId: 'tb', file: path.join(SEED_SUITE_DIR, 'tb-tenant-config-package-test.xlsx') },
  { tenantId: 'tc', file: path.join(SEED_SUITE_DIR, 'tc-tenant-config-package-test.xlsx') },
]

/**
 * 全局 Setup：
 *   1. 登录获取 HttpOnly Cookie 与 CSRF Cookie
 *   2. 为 ta / tb / tc 三个租户导入配置包 Excel，失败按 REQUIRE_CONFIG_SEED/staging 策略处理
 *   3. 导出 fixture 文件供 UI 上传链路测试使用
 *   4. 写入 storageState（默认测试租户为 ta）
 *
 * @param {import('@playwright/test').FullConfig} config
 */
async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL ?? FRONTEND_BASE_URL
  const readOnlyMonitoringRun = process.env.E2E_MONITORING_REAL === '1'

  // ── 登录 ────────────────────────────────────────────────────────
  // 认证只消费 Set-Cookie；后续 Node 请求携带 Cookie/CSRF，浏览器使用 storageState.cookies。
  let authCookies = []
  try {
    const loginRes = await fetchWithTimeout(`${API_BASE}/api/console/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'system' },
      body: JSON.stringify({
        username: process.env.E2E_USERNAME || 'admin',
        password: process.env.E2E_PASSWORD || 'admin123',
      }),
    })
    if (!loginRes.ok) throw new Error(`HTTP ${loginRes.status}`)
    const loginJson = await loginRes.json()
    // Node 18+: Headers.getSetCookie() 返回 string[];老节点 fallback 到 raw Set-Cookie
    const setCookies = getSetCookies(loginRes)
    authCookies = setCookies.map((raw) => parseSetCookieForStorageState(raw, baseURL))
    if (authCookies.length === 0) {
      throw new Error('响应中无 Set-Cookie，登录可能未成功')
    }
    console.log(
      `[global-setup] 登录成功,expires: ${loginJson?.data?.expiresAt},cookies: ${authCookies.length}`,
    )
  } catch (err) {
    if (IS_STAGING_TARGET) {
      throw new Error(`[staging-e2e] 管理账号登录或目标 API 校验失败: ${err.message}`)
    }
    console.warn(`[global-setup] 登录失败（${err.message}），跳过 seed,仅写入 storageState`)
  }

  // ── 导入测试数据 ─────────────────────────────────────────────────
  const seedAuthHeaders = buildAuthHeaders(authCookies)
  if (!readOnlyMonitoringRun && Object.keys(seedAuthHeaders).length > 0) {
    for (const tenantId of ['ta', 'tb', 'tc', 'tx']) {
      await ensureFixtureTenant(seedAuthHeaders, tenantId)
    }
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
          { name: storageKeys.tenantId, value: 'ta' },
          // FE 的 router beforeEach 检查这个 flag 决定 isLoggedIn(见 stores/auth.ts SESSION_FLAG_KEY)
          // 必须设,否则即使 HttpOnly cookie 有效,FE 也会直接 redirect 到 /login。
          { name: storageKeys.session, value: '1' },
          // 强制中文 locale,避免某些 spec 没走 enterDemoApp 时 i18n 拿到浏览器默认 en-US
          // 见 src/constants/locale.ts:1 (LOCALE_STORAGE_KEY)
          { name: storageKeys.locale, value: DEFAULT_LOCALE },
          // 关掉首次登录引导(driver.js tour),避免 overlay 拦截点击
          // 见 src/composables/useOnboardingTour.ts:14
          { name: storageKeys.onboardingDone, value: '1' },
        ],
      },
    ],
  }

  writeFileSync(path.join(authDir, 'user.json'), JSON.stringify(storageState, null, 2))
  console.log('[global-setup] storageState 已写入，默认测试租户: ta')

  if (readOnlyMonitoringRun) {
    console.log(
      '[global-setup] monitoring real run: skipped tenant seed, fixture export and RBAC setup',
    )
    return
  }

  // ── 刷新分角色 storageState(role-*.json) ─────────────────────────
  // 以下场景共用分角色状态：scenarios-business / multi-tenant-and-stream / c-plus-coverage / rbac-matrix /
  // flows/_watchdog 都直接读这些文件做 APIRequestContext。
  // 旧版只生成 user.json,role-*.json 的会话容易过期导致 401。
  // 这里幂等准备账号并重新登录刷新，避免本地数据库缺账号时静默跳过 RBAC 覆盖。
  // !!! BE 对同一 username 只保留最近一次登录会话，后续登录会让之前的会话失效。
  //     所以 admin 这一项必须复用上面写到 user.json 的同一份 cookies,不能再 login 一次,
  //     否则会反过来把 user.json 的会话作废,导致全量 e2e 集体 401。
  const ROLE_LOGINS = [
    {
      file: 'role-tenantUser.json',
      username: 'op-tx',
      password: 'admin123',
      tenantId: 'tx',
      defaultTenant: 'tx',
      displayName: 'E2E Tenant User',
      authority: 'ROLE_TENANT_USER',
    },
    {
      file: 'role-auditor.json',
      username: 'auditor',
      password: 'admin123',
      tenantId: 'system',
      defaultTenant: 'ta',
      displayName: 'Console Auditor',
      authority: 'ROLE_AUDITOR',
    },
    {
      file: 'role-tenantAdmin.json',
      username: 'tadmin-ta',
      password: 'Admin@123abc',
      tenantId: 'ta',
      defaultTenant: 'ta',
      displayName: 'E2E Tenant Admin',
      authority: 'ROLE_TENANT_ADMIN',
    },
  ]
  // role-admin.json 直接复用 user.json 的 cookies(同 username,避免互踩 session)
  writeFileSync(path.join(authDir, 'role-admin.json'), JSON.stringify(storageState, null, 2))
  for (const role of ROLE_LOGINS) {
    const login = await prepareRoleLogin(seedAuthHeaders, role, baseURL)
    const state = roleStorageState(login, role, baseURL)
    writeFileSync(path.join(authDir, role.file), JSON.stringify(state, null, 2))
  }
  console.log('[global-setup] role-*.json 已刷新')
}

module.exports = globalSetup
