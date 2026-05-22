/**
 * Flow watchdog — 13 业务流共享工具。
 *
 * 提供:
 *  - withRetry / pollUntil — 异步状态等待
 *  - flowLog — 详细日志(失败时落 trace + body)
 *  - ctx admin / user — 预登录 APIRequestContext
 *  - logFailure — 在 afterAll 里把累积日志写到 test-results/
 */
import { request as pwRequest, type APIRequestContext, type APIResponse } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const API = process.env.BC_API_BASE || 'http://localhost:18080'
const STATE_DIR = path.resolve(__dirname, '..', '.auth')

export const ts = () => Date.now().toString(36)
export const rand = () => Math.random().toString(36).slice(2, 8)
export const idem = (prefix = 'e2e-flow') => `${prefix}-${ts()}-${rand()}`
export const e2eCode = (prefix = 'e2e') => `${prefix}-${ts()}-${rand()}`

export async function adminCtx(headers: Record<string, string> = {}): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: API,
    storageState: path.join(STATE_DIR, 'role-admin.json'),
    extraHTTPHeaders: { 'Content-Type': 'application/json', ...headers },
  })
}
export async function tenantUserCtx(
  headers: Record<string, string> = {},
): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: API,
    storageState: path.join(STATE_DIR, 'role-tenantUser.json'),
    extraHTTPHeaders: { 'Content-Type': 'application/json', ...headers },
  })
}

export type FlowEvent = { ts: number; kind: string; data?: unknown }
export class FlowLog {
  events: FlowEvent[] = []
  log(kind: string, data?: unknown) {
    this.events.push({ ts: Date.now(), kind, data })
  }
  /** 在 afterAll 调,只有 failed=true 时写入磁盘 */
  flushIfFailed(failed: boolean, flowName: string) {
    if (!failed) return
    const outDir = path.resolve(__dirname, '..', '..', 'test-results', 'flow-logs')
    fs.mkdirSync(outDir, { recursive: true })
    const f = path.join(outDir, `${flowName}-${ts()}.json`)
    fs.writeFileSync(f, JSON.stringify(this.events, null, 2))
    // eslint no-console allows warn/error; flow 失败用 warn 而非 log,既保 CI 日志可见又通 lint
    console.warn(`[flow] ${flowName} FAILED, log written to ${f}`)
  }
}

/**
 * poll BE 直到 predicate(json) 为真,或超时。
 * 返回最后一次响应的 json(用于断言)。
 */
export async function pollUntil<T = unknown>(
  fetchFn: () => Promise<APIResponse>,
  predicate: (json: T) => boolean,
  opts: { timeoutMs?: number; intervalMs?: number; label?: string } = {},
): Promise<T> {
  const timeout = opts.timeoutMs ?? 10_000
  const interval = opts.intervalMs ?? 500
  const start = Date.now()
  let last: T | undefined
  while (Date.now() - start < timeout) {
    const r = await fetchFn()
    if (r.ok()) {
      last = (await r.json()) as T
      if (predicate(last)) return last
    }
    await new Promise((res) => setTimeout(res, interval))
  }
  throw new Error(
    `[pollUntil] timeout after ${timeout}ms${
      opts.label ? ' for ' + opts.label : ''
    } — last=${JSON.stringify(last).slice(0, 200)}`,
  )
}

/** 一个集中的请求 helper,自动加 Idempotency-Key + X-Tenant-Id + log */
export async function call(
  ctx: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  opts: { tenantId?: string; body?: unknown; log?: FlowLog; expectStatus?: number[] } = {},
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    'X-Tenant-Id': opts.tenantId ?? 'tx',
    'Idempotency-Key': idem(),
  }
  const reqOpts: Parameters<typeof ctx.post>[1] = {
    headers,
    data: opts.body,
    failOnStatusCode: false,
  }
  let r: APIResponse
  if (method === 'GET') r = await ctx.get(url, { headers, failOnStatusCode: false })
  else if (method === 'POST') r = await ctx.post(url, reqOpts)
  else if (method === 'PUT') r = await ctx.put(url, reqOpts)
  else r = await ctx.delete(url, reqOpts)

  const status = r.status()
  const text = await r.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  opts.log?.log(`${method} ${url}`, { status, body })
  return { status, body }
}
