#!/usr/bin/env node
/**
 * 为 RBAC 矩阵测试生成 5 角色的 Playwright storageState 文件。
 *
 * 输出:e2e/.auth/role-{admin,configAdmin,auditor,tenantUser,user}.json
 *
 * 用法:
 *   node e2e/scripts/build-role-storage-states.cjs
 *
 * 依赖:BE @ localhost:18080,5 个测试账号已存在(详见账户表 console_user_account)。
 */
const fs = require('node:fs')
const path = require('node:path')

const API = process.env.BC_API_BASE || 'http://localhost:18080'
const ORIGIN = process.env.BC_FE_ORIGIN || 'http://localhost:5173'

const ROLES = [
  { key: 'admin', username: 'admin', password: 'admin123', tenantId: 'system' },
  { key: 'configAdmin', username: 'config-admin', password: 'admin123', tenantId: 'system' },
  { key: 'auditor', username: 'auditor', password: 'admin123', tenantId: 'system' },
  { key: 'tenantUser', username: 'op-tx', password: 'admin123', tenantId: 'tx' },
  { key: 'user', username: 'e2e-user', password: 'admin123', tenantId: 'tx' },
]

function parseSetCookie(raw, baseUrl) {
  const url = new URL(baseUrl)
  const [pair, ...attrs] = raw.split(/;\s*/)
  const eq = pair.indexOf('=')
  const name = pair.slice(0, eq)
  const value = pair.slice(eq + 1)
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
    const [k, v] = a.split('=')
    const key = k.toLowerCase()
    if (key === 'domain') cookie.domain = v
    else if (key === 'path') cookie.path = v
    else if (key === 'max-age') cookie.expires = Math.floor(Date.now() / 1000) + Number(v)
    else if (key === 'expires') cookie.expires = Math.floor(new Date(v).getTime() / 1000)
    else if (key === 'httponly') cookie.httpOnly = true
    else if (key === 'secure') cookie.secure = true
    else if (key === 'samesite') cookie.sameSite = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()
  }
  return cookie
}

async function loginAndBuild(role) {
  const res = await fetch(`${API}/api/console/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': role.tenantId },
    body: JSON.stringify({ username: role.username, password: role.password }),
  })
  if (!res.ok) throw new Error(`${role.key} login HTTP ${res.status}`)
  const j = await res.json()
  if (j.code !== 'SUCCESS') throw new Error(`${role.key} login: ${j.message}`)
  const token = j.data.accessToken
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean)
  const cookies = setCookies.map((raw) => parseSetCookie(raw, ORIGIN))

  return {
    cookies,
    origins: [
      {
        origin: ORIGIN,
        localStorage: [
          { name: 'batch-console-tenant-id', value: role.tenantId },
          { name: 'batch-console-session', value: '1' },
          { name: 'token', value: token },
          { name: 'batch-console:locale', value: 'zh-CN' },
          { name: 'batch-console-onboarding-done', value: '1' },
        ],
      },
    ],
  }
}

async function main() {
  const outDir = path.resolve(__dirname, '..', '.auth')
  fs.mkdirSync(outDir, { recursive: true })
  for (const role of ROLES) {
    try {
      const state = await loginAndBuild(role)
      const file = path.join(outDir, `role-${role.key}.json`)
      fs.writeFileSync(file, JSON.stringify(state, null, 2))
      console.log(`[ok] ${role.key} (${role.username}@${role.tenantId}) → ${file}`)
    } catch (err) {
      console.error(`[fail] ${role.key}: ${err.message}`)
      process.exitCode = 1
    }
  }
}

main()
