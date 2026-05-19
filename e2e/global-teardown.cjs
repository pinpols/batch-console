// @ts-check
/**
 * Playwright globalTeardown — 所有 spec 跑完后调一次 admin 清理端点把 e2e-* 数据全删。
 *
 * 为什么不写在每个 spec 的 afterAll:已有 82 个 spec,挨个补 cleanup 工作量大且容易漏。
 * 统一用 prefix 命名约定(测试创建资源时用 `e2e-${uuid}` 或 `e2e-${suite}-${ts}` 开头),
 * 在 BE 的 admin 端点按 prefix 级联清。
 *
 * 失败不阻塞 CI(测试本身已经过/挂过了),只 warn。后端不可达时直接 skip。
 *
 * 由 playwright.config.cjs:globalTeardown 注册。
 */

const TEARDOWN_DISABLED = process.env.BC_E2E_SKIP_TEARDOWN === '1'
const API_BASE = process.env.BC_API_BASE || 'http://localhost:18080'
const PREFIX = process.env.BC_E2E_PREFIX || 'e2e'

async function globalTeardown() {
  if (TEARDOWN_DISABLED) {
    console.log('[global-teardown] skipped (BC_E2E_SKIP_TEARDOWN=1)')
    return
  }

  // 复用 global-setup 写好的 admin storageState 拿 cookie。
  // role-admin.json = user.json 同源(同事务在 setup 里就保证了 jti 一致)
  const path = require('path')
  const fs = require('fs')
  const stateFile = path.resolve(__dirname, '.auth/user.json')
  if (!fs.existsSync(stateFile)) {
    console.warn('[global-teardown] no user.json storage, skip cleanup')
    return
  }
  let cookie = ''
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    const tk = (state.cookies || []).find((c) => c.name === 'batch_console_token')
    if (tk) cookie = `${tk.name}=${tk.value}`
  } catch (e) {
    console.warn('[global-teardown] failed to parse storage state:', e.message)
    return
  }
  if (!cookie) {
    console.warn('[global-teardown] no admin cookie, skip cleanup')
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const url = `${API_BASE}/api/console/admin/test-data?prefix=${encodeURIComponent(PREFIX)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Cookie: cookie, 'X-Tenant-Id': 'system' },
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn(`[global-teardown] cleanup HTTP ${res.status}`)
      return
    }
    const body = await res.json()
    const data = body && body.data
    if (!data) {
      console.warn('[global-teardown] cleanup response missing data')
      return
    }
    const total = Object.values(data).reduce((a, n) => a + n, 0)
    if (total > 0) {
      console.log(`[global-teardown] cleaned ${total} rows by prefix=${PREFIX}`, data)
    } else {
      console.log(`[global-teardown] no e2e dirty data (prefix=${PREFIX})`)
    }
  } catch (err) {
    console.warn('[global-teardown] cleanup failed (non-fatal):', err.message)
  } finally {
    clearTimeout(timer)
  }
}

module.exports = globalTeardown
