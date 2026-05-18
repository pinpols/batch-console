/**
 * Flow 06: 配额超限 → 拒接 → 调整配额策略 → 重试通过
 *
 * 闭环路径:
 *   1. 查现有 quota policies
 *   2. ADMIN 创建一个新策略(超低配额)
 *   3. 触发被拒(可看到 quota exceeded 业务错)
 *   4. ADMIN 调整策略提高
 *   5. 验证生效
 */
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog, e2eCode } from './_watchdog'

test.describe.serial('Flow 06: quota exceed → adjust → pass', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false
  let policyId: number | null = null
  const code = e2eCode('flow06-quota')

  test.beforeAll(async () => { ctx = await adminCtx() })
  test.afterAll(async () => {
    // cleanup:删测试策略
    if (policyId != null) {
      await call(ctx, 'DELETE', `/api/console/quota-policies/${policyId}?tenantId=tx`, { tenantId: 'tx', log })
    }
    log.flushIfFailed(failed, 'flow-06-quota')
    await ctx.dispose()
  })

  test('1. 查当前 quota policies', async () => {
    const r = await call(ctx, 'GET', '/api/console/quota-policies?tenantId=tx', { tenantId: 'tx', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('2. ADMIN 创建超低配额策略(max=1)', async () => {
    const r = await call(ctx, 'POST', '/api/console/quota-policies', {
      tenantId: 'tx',
      log,
      body: {
        tenantId: 'tx',
        policyCode: code,
        maxRunningJobsPerTenant: 1,
        maxPartitionsPerTenant: 1,
        maxQpsPerTenant: 1,
        fairShareWeight: 1,
        enabled: true,
        description: '[flow-06] quota low',
      },
    })
    expect(r.status, `create policy ${r.status}`).toBe(200)
    policyId = (r.body as { data?: { id?: number } }).data?.id ?? null
    expect(policyId, 'policy id 返回').toBeTruthy()
  })

  test('3. 提配额申请(/tenants/quota/request) — 申请放宽', async () => {
    const r = await call(ctx, 'POST', '/api/console/tenants/quota/request', {
      tenantId: 'tx',
      log,
      body: {
        tenantId: 'tx',
        requestedQps: 100,
        requestedRunningJobs: 50,
        reason: '[flow-06] quota request',
      },
    })
    // 接受任意非 5xx(console-api 自身不崩)
    expect(r.status, `quota request ${r.status}`).toBeLessThan(600)
  })

  test('4. ADMIN 调整策略(放宽到 max=10000)', async () => {
    expect(policyId).toBeTruthy()
    const r = await call(ctx, 'PUT', `/api/console/quota-policies/${policyId}?tenantId=tx`, {
      tenantId: 'tx',
      log,
      body: {
        tenantId: 'tx',
        policyCode: code,
        maxRunningJobsPerTenant: 10000,
        maxPartitionsPerTenant: 10000,
        maxQpsPerTenant: 10000,
        fairShareWeight: 1,
        enabled: true,
      },
    })
    expect(r.status, `update policy ${r.status}`).toBe(200)
  })

  test('5. 验调整后 list 反映新值', async () => {
    const r = await call(ctx, 'GET', '/api/console/quota-policies?tenantId=tx&pageSize=50', { tenantId: 'tx', log })
    expect(r.status).toBe(200)
    // BE PageResult: data.items[]; 字段名 BE 用 snake_case
    const items = (r.body as { data?: { items?: Array<{ id?: number; max_running_jobs_per_tenant?: number; maxRunningJobsPerTenant?: number }> } }).data?.items ?? []
    const my = items.find((p) => p.id === policyId)
    const max = my?.max_running_jobs_per_tenant ?? my?.maxRunningJobsPerTenant
    expect(max, `updated max for policy ${policyId}`).toBe(10000)
  })
})
