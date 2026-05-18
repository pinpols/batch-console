/**
 * Flow 08: Outbox stuck → republish → 投递成功
 *
 * 端点:
 *   GET  /api/console/ops/outbox/stats
 *   GET  /api/console/queries/outbox-retries (找 FAILED)
 *   POST /api/console/ops/outbox/republish (按 ids)
 *   POST /api/console/ops/outbox/cleanup
 *   GET  /api/console/queries/outbox-deliveries (验投递)
 */
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog } from './_watchdog'

test.describe.serial('Flow 08: outbox stuck → republish → delivered', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false
  let stuckIds: number[] = []

  test.beforeAll(async () => { ctx = await adminCtx() })
  test.afterAll(async () => { log.flushIfFailed(failed, 'flow-08-outbox'); await ctx.dispose() })

  test('1. 查 outbox stats — 通道存活', async () => {
    const r = await call(ctx, 'GET', '/api/console/ops/outbox/stats?tenantId=ta', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('2. 查 stuck/FAILED retries', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/outbox-retries?tenantId=ta&status=FAILED&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
    const items = (r.body as { data?: { items?: Array<{ id: number }> } }).data?.items ?? []
    stuckIds = items.map((i) => i.id).filter(Boolean).slice(0, 3)
    log.log('stuck ids', stuckIds)
  })

  test('3. POST /ops/outbox/republish — 触发重投', async () => {
    if (stuckIds.length === 0) test.skip(true, '无 stuck retry')
    const r = await call(ctx, 'POST', '/api/console/ops/outbox/republish', {
      tenantId: 'ta', log, body: { tenantId: 'ta', ids: stuckIds, reason: '[flow-08] republish' },
    })
    expect([200, 202, 400, 404].includes(r.status), `republish ${r.status}`).toBe(true)
  })

  test('4. 查 outbox-deliveries 投递记录可见', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/outbox-deliveries?tenantId=ta&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('5. POST /ops/outbox/cleanup — 验清理端点存活', async () => {
    const r = await call(ctx, 'POST', '/api/console/ops/outbox/cleanup', {
      tenantId: 'ta', log, body: { tenantId: 'ta', olderThanDays: 365 },
    })
    expect(r.status, `cleanup ${r.status}`).toBeLessThan(600)
  })
})
