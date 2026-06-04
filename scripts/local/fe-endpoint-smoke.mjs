#!/usr/bin/env node
// 真实栈端点冒烟:以 BE OpenAPI(console-api.openapi.yaml)为套约,逐个 path+method
// 打运行中的后端,断言「路由存在 + 服务端不报错」。专治本类回归:
//   - 404:套约里有、运行镜像里没有 → 版本漂移(如旧镜像缺 /meta/pipeline-stages)
//   - 5xx:路由在但服务端炸 → 配置/依赖错(如 console→trigger 误连 localhost)
//
// 判定语义(用户约定:断言非 4xx/5xx,但对探测噪声做合理豁免):
//   2xx              → PASS
//   400 / 422        → PASS(VALIDATED:路由在,空 body/缺参被校验拒,符合预期)
//   401 / 403        → AUTH(未配凭证时大量出现属正常,不算失败)
//   404 + OpenAPI 已声明 404 → PASS(按设计的条件 404,如 push 模块关闭 / 登录加密关闭)
//   404 + 无路径参数        → FAIL(路由确实缺失 / 版本漂移 —— 本脚本的核心目标)
//   404 + 有 {param}        → WARN(可能只是占位资源不存在,不误报路由缺失)
//   405              → FAIL(方法/路由漂移)
//   5xx / 网络错     → FAIL
//
// 安全:默认【只打 GET】(只读、零副作用)。今天暴露的 404/5xx 全是 GET 端点,GET-only
// 已覆盖该 bug 类;写/删端点的契约对齐由 `npm run gen:api:check`(静态)保证,不在运行时盲打
// —— 鉴权后盲打写端点可能误执行(如 DELETE /admin/test-data)。
// 如确在【一次性/可重置环境】要探写端点路由存在性,加 --writes:对 POST/PUT/PATCH 发空 {} body
// (靠参数校验 400 兜底、不产生有意义副作用),并 denylist 掉会话变更 / 已知破坏性端点;DELETE 始终不打。
//
// 用法:
//   node scripts/local/fe-endpoint-smoke.mjs                 # 默认 GET-only,打 http://localhost:18080
//   SMOKE_USER=admin SMOKE_PASS=*** node scripts/local/fe-endpoint-smoke.mjs   # 鉴权(覆盖鉴权后 GET)
//   SMOKE_TOKEN=<jwt> node scripts/local/fe-endpoint-smoke.mjs
//   node scripts/local/fe-endpoint-smoke.mjs --writes        # 额外探 POST/PUT/PATCH 路由(仅限可重置环境!)
//   node scripts/local/fe-endpoint-smoke.mjs --list          # 离线:只打印套约清单,不打后端
//   SMOKE_BASE_URL=http://localhost:18080 SMOKE_TENANT=ta ... # 覆盖默认
//
// 环境变量:
//   SMOKE_BASE_URL  默认 http://localhost:18080
//   SMOKE_TENANT    默认 ta(X-Tenant-Id)
//   SMOKE_TOKEN     直接给 bearer token(优先级最高)
//   SMOKE_USER/SMOKE_PASS  明文登录 /api/console/auth/login 换 token
//   SMOKE_OPENAPI   覆盖 OpenAPI 路径
//   SMOKE_CONCURRENCY 默认 8
//
// 退出码:有 FAIL → 1,否则 0。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import YAML from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')

const LIST_ONLY = process.argv.includes('--list')
const INCLUDE_WRITES = process.argv.includes('--writes')
// --writes 时仍始终跳过的端点:会吊销/重置自身会话,或已知破坏性。DELETE 整类不打。
const WRITE_DENY = [
  '/auth/login',
  '/auth/logout',
  '/auth/token',
  '/admin/test-data',
  'reset-password',
  '/password',
]
function isWriteDenied(template) {
  return WRITE_DENY.some((d) => template.includes(d))
}
const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://localhost:18080').replace(/\/$/, '')
const TENANT = process.env.SMOKE_TENANT || 'ta'
const OPENAPI_PATH =
  process.env.SMOKE_OPENAPI ||
  resolve(REPO_ROOT, '../file-batch-system/docs/api/console-api.openapi.yaml')
const CONCURRENCY = Number(process.env.SMOKE_CONCURRENCY || 8)
const REQ_TIMEOUT_MS = 8000

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete']

/**
 * {param} → 占位值统一用 "1":对整型路径参(如 {version}/{id})合法,对字符串参(如
 * {tenantId}/{uploadToken})也是合法字符串值(命中不存在的资源 → 404)。避免给整型参塞
 * 非数字串触发类型转换 500 的误报。
 */
function fillPathParams(path) {
  return path.replace(/\{[^}]+\}/g, '1')
}

function loadEndpoints() {
  const raw = readFileSync(OPENAPI_PATH, 'utf8')
  const doc = YAML.parse(raw)
  const paths = doc?.paths ?? {}
  const out = []
  for (const [tmpl, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue
    for (const method of HTTP_METHODS) {
      if (!item[method]) continue
      const op = item[method]
      out.push({
        method: method.toUpperCase(),
        template: tmpl,
        url: fillPathParams(tmpl),
        hasPathParam: /\{[^}]+\}/.test(tmpl),
        // OpenAPI 声明了 404 响应 → 该端点的 404 属按设计(条件禁用),不算路由缺失
        documents404: !!(op.responses && (op.responses['404'] || op.responses[404])),
        // security: [] 标记公开端点(login / public-key)
        isPublic: Array.isArray(op.security) && op.security.length === 0,
        opId: op.operationId || '',
      })
    }
  }
  return out
}

// 返回 { bearer?, cookie? } —— ADR-030:登录态走 HttpOnly cookie `batch_console_token`,
// 响应体不含原始 token,故从 Set-Cookie 抓 cookie 回带;SMOKE_TOKEN 给则走 bearer。
async function login() {
  if (process.env.SMOKE_TOKEN) return { bearer: process.env.SMOKE_TOKEN }
  const user = process.env.SMOKE_USER
  const pass = process.env.SMOKE_PASS
  if (!user || !pass) return {}
  try {
    const res = await fetch(`${BASE_URL}/api/console/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
      signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[auth] 登录失败 HTTP ${res.status}(可能开了登录加密 RSA-OAEP);转无凭证跑`)
      return {}
    }
    const setCookie = res.headers.get('set-cookie') || ''
    const m = setCookie.match(/batch_console_token=[^;]+/)
    if (m) return { cookie: m[0] }
    // 兜底:个别部署可能把 token 放响应体
    const body = await res.json().catch(() => null)
    const data = body?.data ?? body
    const token = data?.token || data?.accessToken || data?.access_token
    if (token) return { bearer: token }
    console.warn('[auth] 登录成功但未取到 cookie/token;转无凭证跑')
    return {}
  } catch (e) {
    console.warn(`[auth] 登录异常:${e?.message ?? e};转无凭证跑`)
    return {}
  }
}

function classify({ status, hasPathParam, documents404, networkError }) {
  if (networkError) return 'FAIL'
  if (status >= 200 && status < 300) return 'PASS'
  if (status === 400 || status === 422) return 'PASS'
  if (status === 401 || status === 403) return 'AUTH'
  if (status === 404) {
    if (documents404) return 'PASS' // OpenAPI 声明的条件 404,按设计
    return hasPathParam ? 'WARN' : 'FAIL'
  }
  if (status === 405) return 'FAIL'
  if (status >= 500) return 'FAIL'
  return 'PASS' // 3xx / 其它非错误
}

async function probe(ep, auth) {
  const headers = { 'X-Tenant-Id': TENANT }
  if (auth?.bearer) headers['Authorization'] = `Bearer ${auth.bearer}`
  if (auth?.cookie) headers['Cookie'] = auth.cookie
  let body
  if (['POST', 'PUT', 'PATCH'].includes(ep.method)) {
    headers['Content-Type'] = 'application/json'
    body = '{}'
  }
  try {
    const res = await fetch(`${BASE_URL}${ep.url}`, {
      method: ep.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
    })
    return {
      ...ep,
      status: res.status,
      verdict: classify({ status: res.status, hasPathParam: ep.hasPathParam, documents404: ep.documents404 }),
    }
  } catch (e) {
    return { ...ep, status: 0, error: e?.message ?? String(e), verdict: classify({ networkError: true }) }
  }
}

async function runPool(items, worker, size) {
  const results = new Array(items.length)
  let next = 0
  async function lane() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane))
  return results
}

async function main() {
  const endpoints = loadEndpoints()
  endpoints.sort((a, b) => a.template.localeCompare(b.template) || a.method.localeCompare(b.method))

  console.log(`OpenAPI: ${OPENAPI_PATH}`)
  console.log(`端点总数: ${endpoints.length}(${new Set(endpoints.map((e) => e.template)).size} 个 path)`)

  if (LIST_ONLY) {
    for (const e of endpoints) {
      console.log(`  ${e.method.padEnd(6)} ${e.template}${e.isPublic ? '  [public]' : ''}`)
    }
    console.log('\n--list 模式:仅打印套约清单,未打后端。')
    return
  }

  // 安全过滤:默认只打 GET;--writes 时加 POST/PUT/PATCH(去 denylist),DELETE 始终不打
  const toProbe = endpoints.filter((e) => {
    if (e.method === 'GET' || e.method === 'HEAD') return true
    if (!INCLUDE_WRITES) return false
    if (e.method === 'DELETE') return false
    return !isWriteDenied(e.template)
  })
  const skipped = endpoints.length - toProbe.length
  console.log(
    `探测范围: ${toProbe.length} 个(${INCLUDE_WRITES ? 'GET + 写端点(去 denylist/DELETE)' : 'GET-only 安全模式'},跳过 ${skipped})`,
  )

  console.log(`目标后端: ${BASE_URL}  租户: ${TENANT}`)
  const auth = await login()
  const authed = !!(auth.bearer || auth.cookie)
  console.log(
    `鉴权: ${authed ? (auth.cookie ? 'cookie 已就绪' : 'bearer 已就绪') : '无凭证(401/403 计入 AUTH,不算失败)'}\n`,
  )

  const results = await runPool(toProbe, (ep) => probe(ep, auth), CONCURRENCY)

  const by = { PASS: [], AUTH: [], WARN: [], FAIL: [] }
  for (const r of results) by[r.verdict].push(r)

  const tag = (s) => (s === 0 ? 'ERR' : String(s))
  if (by.FAIL.length) {
    console.log(`✗ FAIL (${by.FAIL.length}) —— 路由缺失 / 5xx / 网络错:`)
    for (const r of by.FAIL)
      console.log(`   ${tag(r.status).padStart(3)}  ${r.method.padEnd(6)} ${r.template}${r.error ? '  (' + r.error + ')' : ''}`)
    console.log('')
  }
  if (by.WARN.length) {
    console.log(`! WARN (${by.WARN.length}) —— 带 {param} 的 404(疑似占位资源不存在,人工确认):`)
    for (const r of by.WARN) console.log(`   404  ${r.method.padEnd(6)} ${r.template}`)
    console.log('')
  }

  console.log('汇总:')
  console.log(`   PASS ${by.PASS.length}   AUTH ${by.AUTH.length}   WARN ${by.WARN.length}   FAIL ${by.FAIL.length}`)
  if (by.AUTH.length && !authed)
    console.log('   提示: AUTH 多因未配凭证;设 SMOKE_USER/SMOKE_PASS 或 SMOKE_TOKEN 后重跑可覆盖鉴权后路径。')

  process.exitCode = by.FAIL.length ? 1 : 0
}

main().catch((e) => {
  console.error('smoke 运行异常:', e)
  process.exitCode = 1
})
