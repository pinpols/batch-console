// @ts-check
const { writeFileSync, mkdirSync, readFileSync, existsSync } = require('fs')
const path = require('path')
const crypto = require('crypto')

const API_BASE = 'http://localhost:18080'
const FIXTURE_TENANT = 'system'

/**
 * 稳定幂等 key：相同 tenant + 文件内容哈希 + 阶段名 → 同一 key。
 * 配合后端 ConsoleIdempotencyInterceptor，重跑 e2e 时 upload/apply
 * 直接命中缓存响应，不会对数据库重放（避免撞唯一键 500）。
 */
function stableIdempotencyKey(tenantId, stage, fileBuffer) {
  const h = crypto
    .createHash('sha1')
    .update(tenantId)
    .update(':')
    .update(stage)
    .update(':')
    .update(fileBuffer || Buffer.alloc(0))
    .digest('hex')
    .slice(0, 32)
  return `e2e-seed-${h}`
}

// 超时常量（ms）
const T_SHORT = 8_000   // 登录、导出等轻量接口
const T_UPLOAD = 20_000 // 文件上传
const T_APPLY  = 30_000 // 配置包应用（事务较重）

/** 幂等 key */
function idempotencyKey() {
  return crypto.randomUUID()
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
async function seedTenant(token, tenantId, filePath) {
  if (!existsSync(filePath)) {
    console.warn(`[seed] 文件不存在，跳过 ${tenantId}: ${filePath}`)
    return
  }

  const commonHeaders = {
    Authorization: `Bearer ${token}`,
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
          'Idempotency-Key': stableIdempotencyKey(tenantId, 'upload', fileBuffer),
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

  // ── ② 应用 ──────────────────────────────────────────────────────
  try {
    const applyRes = await fetchWithTimeout(
      `${API_BASE}/api/console/config/tenant-package/excel/apply/${encodeURIComponent(uploadToken)}`,
      {
        method: 'POST',
        headers: {
          ...commonHeaders,
          'Content-Type': 'application/json',
          'Idempotency-Key': stableIdempotencyKey(tenantId, 'apply', fileBuffer),
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
async function exportTenantPackageFixture(token) {
  const outPath = path.resolve(__dirname, '../test-excel-abc/tenant-package-export.xlsx')
  if (existsSync(outPath)) {
    console.log('[fixture] 已存在，跳过租户包导出')
    return
  }
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/console/config/tenant-package/excel/export?tenantId=${encodeURIComponent(FIXTURE_TENANT)}`,
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
    await exportTenantPackageFixture(token)
  }

  // ── 写 storageState（默认测试租户 ta，与 seedTenant 目标一致）──────
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
}

module.exports = globalSetup
