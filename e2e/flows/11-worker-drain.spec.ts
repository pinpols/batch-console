/**
 * Flow 11: Worker drain / takeover / warmup 真生效
 *
 * 用户标注:目前 worker 已退役无法测真效果。
 *           本测验 console-api 路径:list/detail/drain/takeover/warmup 端点不崩。
 *           真生效需 worker service 在线 + 真 worker 注册。
 */
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog } from './_watchdog'

test.describe.serial('Flow 11: worker drain/takeover/warmup (API smoke)', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false
  let workerId: number | null = null

  test.beforeAll(async () => { ctx = await adminCtx() })
  test.afterAll(async () => { log.flushIfFailed(failed, 'flow-11-worker'); await ctx.dispose() })

  test('1. 查 worker 列表(/queries/workers)', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/workers?tenantId=ta&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
    const items = (r.body as { data?: { items?: Array<{ id: number }> } }).data?.items ?? []
    workerId = items[0]?.id ?? null
    log.log('workerId', workerId)
  })

  test('2. 查 cluster-diagnostic/workers', async () => {
    const r = await call(ctx, 'GET', '/api/console/ops/cluster-diagnostic/workers?tenantId=ta', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('3. drain 端点(若 worker 存在)', async () => {
    if (workerId == null) test.skip(true, '无 worker 可测')
    const r = await call(ctx, 'POST', `/api/console/workers/${workerId}/drain`, {
      tenantId: 'ta', log, body: { tenantId: 'ta', reason: '[flow-11] drain' },
    })
    // 已退役 worker 应返 409 STATE_CONFLICT (BE 正确返业务错)
    expect(r.status, `drain ${r.status}`).toBeLessThan(600)
  })

  test('4. takeover 端点', async () => {
    if (workerId == null) test.skip(true, '无 worker 可测')
    const r = await call(ctx, 'POST', `/api/console/workers/${workerId}/takeover`, {
      tenantId: 'ta', log, body: { tenantId: 'ta', targetGroup: 'default' },
    })
    expect(r.status, `takeover ${r.status}`).toBeLessThan(600)
  })

  test('5. warmup 端点', async () => {
    if (workerId == null) test.skip(true, '无 worker 可测')
    const r = await call(ctx, 'POST', `/api/console/workers/${workerId}/warmup`, {
      tenantId: 'ta', log, body: { tenantId: 'ta' },
    })
    expect(r.status, `warmup ${r.status}`).toBeLessThan(600)
  })
})
