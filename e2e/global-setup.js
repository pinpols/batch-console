// @ts-check
const { writeFileSync, mkdirSync, readFileSync, existsSync } = require('fs')
const path = require('path')
const crypto = require('crypto')

const API_BASE = 'http://localhost:18080'
const FIXTURE_TENANT = 'ta'

// 超时常量（ms）
const T_SHORT = 8_000   // 登录、导出等轻量接口
const T_UPLOAD = 20_000 // 文件上传
const T_APPLY  = 30_000 // 配置包应用（事务较重）

/** 幂等 key */
function idempotencyKey() {
  return crypto.randomUUID()
}

/**
 * 带超时的 fetch 封装。
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number }} opts
 */
async function fetchWithTimeout(url, opts = {}) {
  const { timeoutMs = T_SHORT, ...rest } = opts
  return fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) })
}

/**
 * 向指定租户上传并应用租户配置包 Excel。
 */
async function seedTenant(token, tenantId, filePath) {
  if (!existsSync(filePath)) {
    console.warn(`[seed] 文件不存在，跳过 ${tenantId}: ${filePath}`)
    return
  }

  const commonHeaders = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': tenantId,
  }

  // ── ① 上传 ──────────────────────────────────────────────────────
  let uploadToken
  try {
    const fileBuffer = readFileSync(filePath)
    const formData = new FormData()
    formData.append(
      'file',
      new Blob([fileBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      path.basename(filePath),
    )

    const uploadRes = await fetchWithTimeout(
      `${API_BASE}/api/console/config/tenant-package/excel/upload`,
      {
        method: 'POST',
        headers: { ...commonHeaders, 'Idempotency-Key': idempotencyKey() },
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

  // ── ② 应用 ──────────────────────────────────────────────────────
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
 * 导出单域 Excel 配置作为 UI 上传测试的 fixture 文件。
 */
async function exportDomainFixture(token, domain) {
  const outPath = path.resolve(__dirname, `../test-excel-abc/${domain}-export.xlsx`)
  if (existsSync(outPath)) {
    console.log(`[fixture] 已存在，跳过 ${domain}`)
    return
  }
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/console/config/${domain}/excel/export`,
      { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': FIXTURE_TENANT } },
    )
    if (!res.ok) {
      console.warn(`[fixture] 导出失败 domain=${domain} status=${res.status}`)
      return
    }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(outPath, buf)
    console.log(`[fixture] ✓ 导出 ${domain} → ${outPath}`)
  } catch (err) {
    console.warn(`[fixture] 导出异常 domain=${domain}: ${err.message}`)
  }
}

/**
 * 导出租户配置包作为 UI 上传测试的 fixture 文件。
 */
async function exportTenantPackageFixture(token) {
  const outPath = path.resolve(__dirname, '../test-excel-abc/tenant-package-export.xlsx')
  if (existsSync(outPath)) {
    console.log('[fixture] 已存在，跳过租户包导出')
    return
  }
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/console/config/tenant-package/excel/export`,
      { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': FIXTURE_TENANT } },
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
  let token
  try {
    const loginRes = await fetchWithTimeout(`${API_BASE}/api/console/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'system' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    if (!loginRes.ok) throw new Error(`HTTP ${loginRes.status}`)
    const loginJson = await loginRes.json()
    token = loginJson?.data?.accessToken
    if (!token) throw new Error('响应中无 accessToken')
    console.log('[global-setup] 登录成功，expires:', loginJson?.data?.expiresAt)
  } catch (err) {
    console.warn(`[global-setup] 登录失败（${err.message}），跳过 seed，仅写入 storageState`)
  }

  // ── 导入测试数据 ─────────────────────────────────────────────────
  if (token) {
    for (const { tenantId, file } of TENANT_EXCELS) {
      await seedTenant(token, tenantId, file)
    }
    await exportDomainFixture(token, 'resource-queues')
    await exportTenantPackageFixture(token)
  }

  // ── 写 storageState（默认测试租户 ta）───────────────────────────
  const authDir = path.resolve('e2e/.auth')
  mkdirSync(authDir, { recursive: true })

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: 'batch-console-tenant-id', value: 'ta' },
          { name: 'token', value: token ?? '' },
        ],
      },
    ],
  }

  writeFileSync(path.join(authDir, 'user.json'), JSON.stringify(storageState, null, 2))
  console.log('[global-setup] storageState 已写入，默认测试租户: ta')
}

module.exports = globalSetup
