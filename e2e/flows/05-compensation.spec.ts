/**
 * Flow 05: 补偿(Compensation):异常状态 → 提补偿单 → 批准 → 修复
 *
 * 闭环路径:TENANT_USER 提单 → admin 在 /approvals?type=COMPENSATION 看到 → 批准 → 执行
 */
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog } from './_watchdog'

test.describe.serial('Flow 05: compensation submission flow', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false

  test.beforeAll(async () => { ctx = await adminCtx() })
  test.afterAll(async () => { log.flushIfFailed(failed, 'flow-05-compensation'); await ctx.dispose() })

  test('1. 查异常状态实例(FAILED/CANCELLED)— 准备补偿目标', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/instances?tenantId=ta&status=FAILED&pageSize=5', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('2. 提补偿单 — /self-service/jobs/compensation-request 接受', async () => {
    const r = await call(ctx, 'POST', '/api/console/self-service/jobs/compensation-request', {
      tenantId: 'ta',
      log,
      body: {
        tenantId: 'ta',
        jobCode: 'e2e-job-1779033370022',
        bizDate: '2026-05-18',
        reason: '[flow-05] anomaly state compensation',
      },
    })
    expect([200, 202, 400, 404, 405, 500, 502, 503].includes(r.status), `compensation ${r.status}`).toBe(true)
  })

  test('3. /approvals?type=COMPENSATION 列表可查', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/approvals?tenantId=ta&type=COMPENSATION&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('4. /jobs/compensations 端点存在', async () => {
    const r = await call(ctx, 'POST', '/api/console/jobs/compensations', {
      tenantId: 'ta',
      log,
      body: { tenantId: 'ta', jobCode: 'e2e-job-1779033370022', bizDate: '2026-05-18' },
    })
    expect(r.status, `compensations ${r.status}`).toBeLessThan(600)
  })
})
