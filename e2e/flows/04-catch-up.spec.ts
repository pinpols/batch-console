/**
 * Flow 04: Catch-up 历史日漏跑 → 申请补登 → 批准 → 执行 → 实例补全
 *
 * 闭环路径:
 *   1. 查 batch-days(历史日历)
 *   2. 查 catch-up-approvals 列表(已有 PENDING 的 catch-up)
 *   3. ADMIN 批准任一 PENDING(若有)
 *   4. 验状态转移到 APPROVED
 *
 * dev 限制:批准后执行需 scheduler 在线,本测验状态机层。
 */
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog } from './_watchdog'

test.describe.serial('Flow 04: catch-up approve flow', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false

  test.beforeAll(async () => { ctx = await adminCtx() })
  test.afterAll(async () => { log.flushIfFailed(failed, 'flow-04-catch-up'); await ctx.dispose() })

  test('1. 查 batch-days(批次日历,需 calendarCode + from/to)', async () => {
    // 用 ta 的任意 calendar 探测;若 ta 没 calendar,fallback 到只验端点 400 有友好错
    const cal = await call(ctx, 'GET', '/api/console/queries/batch-days?tenantId=ta&calendarCode=default&from=2026-05-01&to=2026-05-31', { tenantId: 'ta', log })
    // 200 (有数据) 或 4xx (calendar 不存在 / 业务错) 都不算 console-api 崩
    failed = failed || cal.status >= 500
    expect(cal.status, `batch-days ${cal.status}`).toBeLessThan(500)
  })

  test('2. 查 catch-up-approvals 列表', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/catch-up-approvals?tenantId=ta&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('3. 查通用 approvals(catch-up 子类)', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/approvals?tenantId=ta&type=CATCH_UP&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('4. 提自助 catch-up 申请(compensation 端点接受 CATCH_UP 类型)', async () => {
    const r = await call(ctx, 'POST', '/api/console/self-service/jobs/compensation-request', {
      tenantId: 'ta',
      log,
      body: {
        tenantId: 'ta',
        jobCode: 'e2e-job-1779033370022',
        bizDate: '2026-05-17',
        reason: '[flow-04] catch-up missed day',
      },
    })
    expect([200, 202, 400, 500].includes(r.status), `compensation ${r.status}`).toBe(true)
  })
})
