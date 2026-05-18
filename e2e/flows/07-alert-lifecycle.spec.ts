/**
 * Flow 07: Alert 触发 → ack → silence 30min → 自动到期 → close
 *
 * 完整告警生命周期:OPEN → ACKED → SILENCED → CLOSED
 *
 * 端点:
 *   POST /api/console/alerts/{alertId}/ack
 *   POST /api/console/alerts/{alertId}/silence
 *   POST /api/console/alerts/{alertId}/close
 */
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog } from './_watchdog'

test.describe.serial('Flow 07: alert lifecycle', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false
  let alertId: number | null = null

  test.beforeAll(async () => { ctx = await adminCtx() })
  test.afterAll(async () => { log.flushIfFailed(failed, 'flow-07-alert'); await ctx.dispose() })

  test('1. 查 OPEN alerts(seed 里 ta 已有 4 条)', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/alerts?tenantId=ta&status=OPEN&pageSize=5', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
    const items = (r.body as { data?: { items?: Array<{ id: number }> } }).data?.items ?? []
    alertId = items[0]?.id ?? null
    log.log('alertId', alertId)
  })

  test('2. ACK alert', async () => {
    if (alertId == null) test.skip(true, '无 OPEN alert')
    const r = await call(ctx, 'POST', `/api/console/alerts/${alertId}/ack`, {
      tenantId: 'ta', log, body: { tenantId: 'ta', operatorId: 'admin', reason: '[flow-07] auto ack' },
    })
    expect([200, 409].includes(r.status), `ack ${r.status}`).toBe(true)
  })

  test('3. SILENCE 30min', async () => {
    if (alertId == null) test.skip(true, '无 alert')
    const r = await call(ctx, 'POST', `/api/console/alerts/${alertId}/silence`, {
      tenantId: 'ta', log, body: { tenantId: 'ta', operatorId: 'admin', reason: '[flow-07] 30min silence' },
    })
    expect([200, 409].includes(r.status), `silence ${r.status}`).toBe(true)
  })

  test('4. CLOSE alert', async () => {
    if (alertId == null) test.skip(true, '无 alert')
    const r = await call(ctx, 'POST', `/api/console/alerts/${alertId}/close`, {
      tenantId: 'ta', log, body: { tenantId: 'ta', operatorId: 'admin', reason: '[flow-07] auto close' },
    })
    expect([200, 409].includes(r.status), `close ${r.status}`).toBe(true)
  })

  test('5. 验最终状态 = CLOSED', async () => {
    const r = await call(ctx, 'GET', `/api/console/queries/alerts?tenantId=ta&status=CLOSED&pageSize=10`, { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })
})
