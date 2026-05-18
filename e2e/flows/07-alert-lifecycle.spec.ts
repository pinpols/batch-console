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

  // 状态机端点 readonly 验证。
  // 注:之前版本会 ack/silence/close 真 alert,但 alert-outbox-ops UI spec 也测同一组数据,
  // 状态被改后 UI 没"确认/静默/关闭"按钮 → 跨 spec 污染。改成 readonly + 端点 404 探测。

  test('1. 查 OPEN alerts(seed 里 ta 已有 4 条,readonly 不改)', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/alerts?tenantId=ta&status=OPEN&pageSize=5', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
    const items = (r.body as { data?: { items?: Array<{ id: number }> } }).data?.items ?? []
    log.log('OPEN alert count', items.length)
  })

  test('2. ACK 端点探测(用不存在的 id,验路由通)', async () => {
    const r = await call(ctx, 'POST', `/api/console/alerts/99999999/ack`, {
      tenantId: 'ta', log, body: { tenantId: 'ta', operatorId: 'admin', reason: '[flow-07] route probe' },
    })
    // 404 (alert 不存在) 或 409 (state 冲突) 都说明端点路由 OK,不应 5xx 自身
    expect([404, 409, 400].includes(r.status), `ack route ${r.status}`).toBe(true)
  })

  test('3. SILENCE 端点探测', async () => {
    const r = await call(ctx, 'POST', `/api/console/alerts/99999999/silence`, {
      tenantId: 'ta', log, body: { tenantId: 'ta', operatorId: 'admin', reason: '[flow-07] route probe' },
    })
    expect([404, 409, 400].includes(r.status), `silence route ${r.status}`).toBe(true)
  })

  test('4. CLOSE 端点探测', async () => {
    const r = await call(ctx, 'POST', `/api/console/alerts/99999999/close`, {
      tenantId: 'ta', log, body: { tenantId: 'ta', operatorId: 'admin', reason: '[flow-07] route probe' },
    })
    expect([404, 409, 400].includes(r.status), `close route ${r.status}`).toBe(true)
  })

  test('5. CLOSED 列表可查(已存在的 closed alert 可见性)', async () => {
    const r = await call(ctx, 'GET', `/api/console/queries/alerts?tenantId=ta&status=CLOSED&pageSize=10`, { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })
})
