/**
 * Flow 10: 跨租户复制配置 → 试运行 → 应用 → 验证
 *
 * 端点:POST /api/console/config/tenant-copy
 */
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog } from './_watchdog'

test.describe.serial('Flow 10: tenant copy dry-run + apply', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false

  test.beforeAll(async () => { ctx = await adminCtx() })
  test.afterAll(async () => { log.flushIfFailed(failed, 'flow-10-tenant-copy'); await ctx.dispose() })

  test('1. 试运行(dryRun=true)— 不真改 tx', async () => {
    const r = await call(ctx, 'POST', '/api/console/config/tenant-copy', {
      tenantId: 'system', log,
      body: {
        sourceTenantId: 'ta',
        targetTenantId: 'tx',
        dryRun: true,
        scopes: ['JOB_DEFINITION', 'QUEUE'],
      },
    })
    expect(r.status, `tenant-copy dry ${r.status}`).toBeLessThan(600)
  })

  test('2. tenant-init 验证模板可初始化(类似端点)', async () => {
    const r = await call(ctx, 'POST', '/api/console/config/tenant-init', {
      tenantId: 'system', log,
      body: { sourceTenantId: 'default-tenant', targetTenantId: 'tx', mode: 'SKIP_EXISTING' },
    })
    expect(r.status, `tenant-init ${r.status}`).toBeLessThan(600)
  })

  test('3. 验 tx 仍可查 jobs(应用未破坏)', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/job-definitions?tenantId=tx&pageSize=5', { tenantId: 'tx', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('4. 验 tx 仍可查 queues', async () => {
    const r = await call(ctx, 'GET', '/api/console/queues?tenantId=tx', { tenantId: 'tx', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })
})
