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
import { spawnSync } from 'node:child_process'
import { adminCtx, call, FlowLog } from './_watchdog'

const PG_CONTAINER = process.env.PG_CONTAINER || 'batch-postgres-primary'
const POSTGRES_USER = process.env.POSTGRES_USER || 'batch_user'
const PLATFORM_DB = process.env.PLATFORM_DB || 'batch_platform'

function psql(sql: string) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      PG_CONTAINER,
      'psql',
      '-U',
      POSTGRES_USER,
      '-d',
      PLATFORM_DB,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'psql failed').trim())
  }
}

test.describe.serial('Flow 08: outbox stuck → republish → delivered', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false
  let stuckEventIds: number[] = []
  const eventKey = `e2e-stuck-${Date.now().toString(36)}`

  test.beforeAll(async () => {
    ctx = await adminCtx()
    psql(`
      INSERT INTO batch.outbox_event (
        tenant_id, aggregate_type, aggregate_id, event_type, event_key,
        payload_json, publish_status, publish_attempt, next_publish_at, trace_id
      ) VALUES (
        'ta', 'JOB_INSTANCE', 1001, 'JOB_TRIGGERED', '${eventKey}',
        '{"jobCode":"TA_INC_ORDER_AGG","bizDate":"2026-05-01"}'::jsonb,
        'FAILED', 5, NOW() + INTERVAL '1 day', '${eventKey}-trace'
      );

      INSERT INTO batch.event_outbox_retry (
        tenant_id, outbox_event_id, event_key, retry_attempt, retry_status,
        retry_reason, next_retry_at, trace_id
      )
      SELECT tenant_id, id, event_key, publish_attempt, 'FAILED',
             'e2e isolated stuck event', next_publish_at, trace_id
        FROM batch.outbox_event
       WHERE tenant_id = 'ta' AND event_key = '${eventKey}';
    `)
  })
  test.afterAll(async () => {
    log.flushIfFailed(failed, 'flow-08-outbox')
    psql(`
      DELETE FROM batch.event_delivery_log delivery
       USING batch.outbox_event event
       WHERE delivery.outbox_event_id = event.id
         AND event.tenant_id = 'ta' AND event.event_key = '${eventKey}';
      DELETE FROM batch.event_outbox_retry retry
       USING batch.outbox_event event
       WHERE retry.outbox_event_id = event.id
         AND event.tenant_id = 'ta' AND event.event_key = '${eventKey}';
      DELETE FROM batch.outbox_event WHERE tenant_id = 'ta' AND event_key = '${eventKey}';
    `)
    await ctx.dispose()
  })

  test('1. 查 outbox stats — 通道存活', async () => {
    const r = await call(ctx, 'GET', '/api/console/ops/outbox/stats?tenantId=ta', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('2. 查 stuck/FAILED retries', async () => {
    const r = await call(ctx, 'GET', `/api/console/queries/outbox-retries?tenantId=ta&retryStatus=FAILED&eventKey=${eventKey}&pageSize=10`, { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
    const items = (r.body as { data?: { items?: Array<{ outboxEventId: number }> } }).data?.items ?? []
    stuckEventIds = items.map((i) => i.outboxEventId).filter(Boolean).slice(0, 1)
    expect(stuckEventIds.length).toBeGreaterThan(0)
    log.log('stuck event ids', stuckEventIds)
  })

  test('3. POST /ops/outbox/republish — 触发重投', async () => {
    expect(stuckEventIds.length).toBeGreaterThan(0)
    const r = await call(ctx, 'POST', '/api/console/ops/outbox/republish?tenantId=ta', {
      tenantId: 'ta', log, body: stuckEventIds,
    })
    failed = failed || r.status !== 200
    expect(r.status, `republish ${r.status}`).toBe(200)
    const resetCount = (r.body as { data?: { resetCount?: number } }).data?.resetCount ?? 0
    failed = failed || resetCount === 0
    expect(resetCount).toBeGreaterThan(0)
  })

  test('4. 查 outbox-deliveries 投递记录可见', async () => {
    let status = 0
    let deliveries: unknown[] = []
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const r = await call(ctx, 'GET', `/api/console/queries/outbox-deliveries?tenantId=ta&eventKey=${eventKey}&pageSize=10`, { tenantId: 'ta', log })
      status = r.status
      deliveries = (r.body as { data?: { items?: unknown[] } }).data?.items ?? []
      if (status === 200 && deliveries.length > 0) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    failed = failed || status !== 200 || deliveries.length === 0
    expect(status).toBe(200)
    expect(deliveries.length).toBeGreaterThan(0)
  })

  test('5. POST /ops/outbox/cleanup — 验清理端点存活', async () => {
    const r = await call(ctx, 'POST', '/api/console/ops/outbox/cleanup?tenantId=ta&retainDays=365', {
      tenantId: 'ta', log,
    })
    failed = failed || r.status !== 200
    expect(r.status, `cleanup ${r.status}`).toBe(200)
  })
})
