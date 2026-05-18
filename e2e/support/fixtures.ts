import * as fs from 'fs'
import * as path from 'path'
import { test as base, expect } from '@playwright/test'

type ConsoleEntry = { time: string; type: string; text: string }

export type NetworkErrorEntry = {
  time: string
  status: number
  method: string
  url: string
  body?: string
}

export type NetworkWatchdog = {
  /** 所有捕获的 ≥400 响应(含被白名单忽略的) */
  readonly all: NetworkErrorEntry[]
  /** 把 URL 子串/RegExp 加入忽略名单 */
  ignore(pattern: string | RegExp): void
  /** 把响应自定义判定为可忽略 */
  ignoreIf(pred: (entry: NetworkErrorEntry) => boolean): void
  /** 拍快照:未被忽略的网络错误列表 */
  errors(): NetworkErrorEntry[]
  /** 断言无未忽略的 4xx/5xx;有则抛出附带详情 */
  assertClean(scope?: string): void
}

// API 路径前缀(只关心后端业务调用,放过静态资源/三方)
const API_URL_RE =
  /\/(api|auth|console|ops|fb|reports|approvals|files|jobs|workflow|monitor|observability|governance|workers|system|scheduler|config|self-service|tenants|operations|fb-console)\//

// 默认忽略:SSE / WS close、vite hmr 噪声、stream ticket idempotency 去重 409
const IGNORED_DEFAULT_URL_HINTS = [/\/sse\b/, /\/ws\b/, /\/@vite\//, /\/__vite_ping/, /\/\.vite\//]

function shouldIgnoreByDefault(entry: NetworkErrorEntry): boolean {
  if (entry.status === 0) return true
  // SSE ticket 并发请求 409 是 BE 幂等去重设计行为(同一 idem-key 30s 内重复 → 409)
  if (entry.status === 409 && /\/auth\/stream\/ticket\b/.test(entry.url)) return true
  return IGNORED_DEFAULT_URL_HINTS.some((r) => r.test(entry.url))
}

/**
 * 扩展 Playwright test:
 *   1. 自动收集 console / pageerror,失败时落盘 console.log
 *   2. 自动抓取所有 ≥400 后端响应,失败/有未忽略错误时落盘 network.log
 *      spec 可通过 `network.assertClean()` 在关键步骤断言无 4xx/5xx;
 *      负路径 spec(故意触发 400)可调 `network.ignore(urlSubstr)` 加白名单。
 */
const test = base.extend<{
  _consoleLogs: ConsoleEntry[]
  network: NetworkWatchdog
}>({
  _consoleLogs: [
    async ({ page }, use, testInfo) => {
      const logs: ConsoleEntry[] = []

      page.on('console', (msg) => {
        logs.push({ time: new Date().toISOString(), type: msg.type(), text: msg.text() })
      })

      page.on('pageerror', (err) => {
        logs.push({ time: new Date().toISOString(), type: 'pageerror', text: err.message })
      })

      await use(logs)

      if (testInfo.status !== testInfo.expectedStatus && logs.length > 0) {
        const logFile = path.join(testInfo.outputDir, 'console.log')
        fs.mkdirSync(testInfo.outputDir, { recursive: true })
        const content = logs
          .map((l) => `[${l.time}] [${l.type.toUpperCase().padEnd(9)}] ${l.text}`)
          .join('\n')
        fs.writeFileSync(logFile, content, 'utf8')
        await testInfo.attach('console.log', { path: logFile, contentType: 'text/plain' })
      }
    },
    { auto: true },
  ],
  network: [
    async ({ page }, use, testInfo) => {
      const all: NetworkErrorEntry[] = []
      const urlIgnores: (string | RegExp)[] = []
      const predIgnores: ((e: NetworkErrorEntry) => boolean)[] = []

      page.on('response', async (resp) => {
        try {
          const status = resp.status()
          if (status < 400) return
          const url = resp.url()
          if (!API_URL_RE.test(url)) return
          const req = resp.request()
          let body: string | undefined
          try {
            const txt = await resp.text()
            body = txt.length > 500 ? txt.slice(0, 500) + '…' : txt
          } catch {
            /* body 不可读(已关闭/二进制) */
          }
          all.push({
            time: new Date().toISOString(),
            status,
            method: req.method(),
            url,
            body,
          })
        } catch {
          /* 响应已 disposed */
        }
      })

      const isIgnored = (e: NetworkErrorEntry): boolean => {
        if (shouldIgnoreByDefault(e)) return true
        for (const p of urlIgnores) {
          if (typeof p === 'string' ? e.url.includes(p) : p.test(e.url)) return true
        }
        for (const f of predIgnores) {
          if (f(e)) return true
        }
        return false
      }

      const watchdog: NetworkWatchdog = {
        get all() {
          return all
        },
        ignore(pattern) {
          urlIgnores.push(pattern)
        },
        ignoreIf(pred) {
          predIgnores.push(pred)
        },
        errors() {
          return all.filter((e) => !isIgnored(e))
        },
        assertClean(scope?: string) {
          const errs = this.errors()
          if (errs.length === 0) return
          const lines = errs.map(
            (e) => `[${e.status}] ${e.method} ${e.url}${e.body ? ` :: ${e.body}` : ''}`,
          )
          throw new Error(
            `Unexpected server errors${scope ? ` in [${scope}]` : ''} (${errs.length}):\n` +
              lines.join('\n'),
          )
        },
      }

      await use(watchdog)

      const shouldDump =
        testInfo.status !== testInfo.expectedStatus || watchdog.errors().length > 0
      if (shouldDump && all.length > 0) {
        const logFile = path.join(testInfo.outputDir, 'network.log')
        fs.mkdirSync(testInfo.outputDir, { recursive: true })
        const content = all
          .map((e) => {
            const ign = isIgnored(e) ? ' [IGNORED]' : ''
            return `[${e.time}]${ign} [${e.status}] ${e.method} ${e.url}${e.body ? `\n    body: ${e.body}` : ''}`
          })
          .join('\n')
        fs.writeFileSync(logFile, content, 'utf8')
        await testInfo.attach('network.log', { path: logFile, contentType: 'text/plain' })
      }
    },
    { auto: true },
  ],
})

export { test, expect }
