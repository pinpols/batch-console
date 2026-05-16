/**
 * 错误态注入 helpers — 给 error-states.spec.ts 复用。
 * 见 docs/runbook/fe-qa-c-tier-plan.md §B.2。
 *
 * 用 page.route 拦截匹配的 endpoint,注入 BE 异常响应,断言 UI 兜底。
 * **不**动 production 的 interceptors.ts。
 */
import { type Page, type Route } from '@playwright/test'

export type ErrorKind =
  | '400' // VALIDATION_ERROR
  | '401' // UNAUTHORIZED
  | '403' // FORBIDDEN
  | '404-biz' // BizException NOT_FOUND (有 code + message)
  | '404-route' // Spring 默认 404 ("No static resource ...")
  | '409' // CONFLICT
  | '422' // BIZ_INVALID
  | '500' // SYSTEM_ERROR
  | 'offline' // 网络断
  | 'slow' // 慢响应(模拟 button loading 应持续 disabled)

interface Payload {
  status: number
  body: unknown
}

const BODY: Record<Exclude<ErrorKind, 'offline' | 'slow'>, Payload> = {
  '400': {
    status: 400,
    body: {
      code: 'VALIDATION_ERROR',
      message: '字段不合法: queueName 长度超过 256',
      data: null,
      meta: { traceId: 'inject-400' },
    },
  },
  '401': {
    status: 401,
    body: { code: 'UNAUTHORIZED', message: '需要登录认证', data: null, meta: {} },
  },
  '403': {
    status: 403,
    body: { code: 'FORBIDDEN', message: '该用户没有此操作权限', data: null, meta: {} },
  },
  '404-biz': {
    status: 404,
    body: {
      code: 'NOT_FOUND',
      message: 'queue not found: 9999',
      data: null,
      meta: { traceId: 'inject-404biz' },
    },
  },
  '404-route': {
    status: 404,
    body: {
      timestamp: '2026-05-17T00:00:00Z',
      status: 404,
      error: 'Not Found',
      message: "No static resource api/console/xxx for request '/api/console/xxx'.",
      path: '/api/console/xxx',
    },
  },
  '409': {
    status: 409,
    body: {
      code: 'CONFLICT',
      message: 'queueCode 已存在: e2e-q-1',
      data: null,
      meta: { traceId: 'inject-409' },
    },
  },
  '422': {
    status: 422,
    body: {
      code: 'BIZ_INVALID',
      message: '业务规则失败: 该队列正在运行,不能停用',
      data: null,
      meta: { traceId: 'inject-422' },
    },
  },
  '500': {
    status: 500,
    body: {
      code: 'SYSTEM_ERROR',
      message: '系统错误',
      data: null,
      meta: { traceId: 'inject-500' },
    },
  },
}

/**
 * 拦截匹配的 endpoint,注入指定 error kind。
 *
 * @example
 *   await injectError(page, '**\/api/console/queues', '500')
 *   await page.getByRole('button', { name: '保存' }).click()
 *   await expect(page.locator('.el-message--error').first()).toContainText('系统错误')
 */
export async function injectError(
  page: Page,
  urlMatcher: string | RegExp,
  kind: ErrorKind,
  options: { method?: string; delayMs?: number } = {},
): Promise<void> {
  const method = options.method ?? 'POST'
  await page.route(urlMatcher, async (route: Route) => {
    if (route.request().method().toUpperCase() !== method.toUpperCase()) {
      return route.continue()
    }
    if (kind === 'offline') {
      return route.abort('failed')
    }
    if (kind === 'slow') {
      // 模拟超时(12s)。spec 应该在 5-10s 内断言 button 仍在 loading
      await new Promise((r) => setTimeout(r, 12_000))
      return route.continue()
    }
    const payload = BODY[kind]
    if (options.delayMs) {
      await new Promise((r) => setTimeout(r, options.delayMs!))
    }
    await route.fulfill({
      status: payload.status,
      contentType: 'application/json',
      body: JSON.stringify(payload.body),
      headers: {
        'X-Trace-Id': `inject-${kind}`,
      },
    })
  })
}

/**
 * 清除指定 URL pattern 的所有 route(test 末尾或 case 间清理)。
 */
export async function clearInjection(page: Page, urlMatcher: string | RegExp): Promise<void> {
  await page.unroute(urlMatcher)
}

/**
 * 一次性测多个 error kind 的便捷封装 — 给单一 endpoint 跑 400/500/offline 三件套。
 * 调用方传 actionFn(触发请求),返回每种 kind 命中的 UI 信号。
 */
export async function runErrorMatrix(
  page: Page,
  urlMatcher: string | RegExp,
  kinds: ErrorKind[],
  actionFn: () => Promise<void>,
  options: { method?: string } = {},
): Promise<Record<ErrorKind, 'toast' | 'redirect' | 'silent' | 'error'>> {
  const result = {} as Record<ErrorKind, 'toast' | 'redirect' | 'silent' | 'error'>
  for (const kind of kinds) {
    await injectError(page, urlMatcher, kind, options)
    try {
      await actionFn()
      // 短等待让 UI 反应
      await page.waitForTimeout(800)
      if (page.url().includes('/login')) {
        result[kind] = 'redirect'
      } else if (await page.locator('.el-message--error, .el-message--warning').first().isVisible().catch(() => false)) {
        result[kind] = 'toast'
      } else {
        result[kind] = 'silent'
      }
    } catch (e) {
      result[kind] = 'error'
    }
    await clearInjection(page, urlMatcher)
    await page.locator('.el-message').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  }
  return result
}
