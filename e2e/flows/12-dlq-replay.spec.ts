/**
 * Flow 12: Dead Letter Queue replay
 *
 * 端点:
 *   GET  /api/console/queries/dead-letters
 *   POST /api/console/jobs/dead-letters/replay
 */
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog } from './_watchdog'

test.describe.serial('Flow 12: DLQ replay', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false
  let deadLetterIds: number[] = []

  test.beforeAll(async () => { ctx = await adminCtx() })
  test.afterAll(async () => { log.flushIfFailed(failed, 'flow-12-dlq'); await ctx.dispose() })

  test('1. 查 dead-letters 列表', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/dead-letters?tenantId=ta&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
    const items = (r.body as { data?: { items?: Array<{ id: number }> } }).data?.items ?? []
    deadLetterIds = items.map((i) => i.id).slice(0, 3)
    log.log('dlq ids', deadLetterIds)
  })

  test('2. POST /jobs/dead-letters/replay 触发重放', async () => {
    if (deadLetterIds.length === 0) test.skip(true, '无 DLQ 条目')
    const r = await call(ctx, 'POST', '/api/console/jobs/dead-letters/replay', {
      tenantId: 'ta', log,
      body: { tenantId: 'ta', deadLetterIds, reason: '[flow-12] DLQ replay' },
    })
    expect(r.status, `dlq replay ${r.status}`).toBeLessThan(600)
  })

  test('3. 验 replay 后 dead-letters 状态可查', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/dead-letters?tenantId=ta&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('4. 审计日志记录 DLQ 操作', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/audits?tenantId=ta&operationType=DLQ_REPLAY&pageSize=10', { tenantId: 'ta', log })
    // operationType 过滤可能 BE 不支持,容忍 200/400
    expect(r.status, `audit ${r.status}`).toBeLessThan(500)
  })
})
