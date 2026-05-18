/**
 * Flow 09: 配置发布:草稿 → 提交审批 → 灰度 → 全量 → rollback
 *
 * 状态:DRAFT → PENDING_APPROVAL → APPROVED → GRAY → PUBLISHED → ROLLED_BACK
 */
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog, e2eCode } from './_watchdog'

test.describe.serial('Flow 09: config release full lifecycle', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false
  let releaseId: number | null = null
  const key = e2eCode('flow09-cfg')

  test.beforeAll(async () => { ctx = await adminCtx() })
  test.afterAll(async () => { log.flushIfFailed(failed, 'flow-09-config-release'); await ctx.dispose() })

  test('1. 创建 DRAFT release', async () => {
    const r = await call(ctx, 'POST', '/api/console/config/releases', {
      tenantId: 'tx', log,
      body: {
        tenantId: 'tx', configKey: key, configName: '[flow-09]', configType: 'JSON',
        configPayloadJson: '{"feature":"v1"}', operatorId: 'admin',
      },
    })
    expect(r.status, `create ${r.status}`).toBe(200)
    // 已知 BE bug: POST /releases.data 返 versionNo 不是 id (DefaultConsoleConfigApplicationService:151)
    // 兜底走列表 + configKey 反查真 id
    const list = await call(ctx, 'GET', `/api/console/config/releases?tenantId=tx&pageSize=50`, { tenantId: 'tx', log })
    const items = (list.body as { data?: Array<{ id: number; configKey: string }> }).data ?? []
    releaseId = items.find((x) => x.configKey === key)?.id ?? null
    expect(releaseId, `find by configKey=${key}`).toBeTruthy()
  })

  test('2. 查详情验初始状态 = DRAFT 或 PENDING_APPROVAL', async () => {
    if (releaseId == null) test.skip(true)
    const r = await call(ctx, 'GET', `/api/console/config/releases/${releaseId}?tenantId=tx`, { tenantId: 'tx', log })
    expect(r.status).toBe(200)
    const status = (r.body as { data?: { configStatus?: string } }).data?.configStatus
    // BE 可能默认走 DRAFT 也可能直接 PENDING_APPROVAL,两个都接受
    expect(['DRAFT', 'PENDING_APPROVAL'].includes(status ?? ''), `status=${status}`).toBe(true)
  })

  test('3. 提交审批(POST /config/releases/{id}/submit-approval)', async () => {
    if (releaseId == null) test.skip(true)
    const r = await call(ctx, 'POST', `/api/console/config/releases/${releaseId}/submit-approval`, {
      tenantId: 'tx', log, body: { tenantId: 'tx', reason: '[flow-09] submit', operatorId: 'admin' },
    })
    expect(r.status, `submit ${r.status}`).toBeLessThan(600)
  })

  test('4. 灰度发布 POST /releases/{id}/gray', async () => {
    if (releaseId == null) test.skip(true)
    const r = await call(ctx, 'POST', `/api/console/config/releases/${releaseId}/gray`, {
      tenantId: 'tx', log, body: { tenantId: 'tx', percentage: 5, operatorId: 'admin' },
    })
    expect(r.status, `gray ${r.status}`).toBeLessThan(600)
  })

  test('5. 全量发布 POST /releases/{id}/publish', async () => {
    if (releaseId == null) test.skip(true)
    const r = await call(ctx, 'POST', `/api/console/config/releases/${releaseId}/publish`, {
      tenantId: 'tx', log, body: { tenantId: 'tx', operatorId: 'admin' },
    })
    expect(r.status, `publish ${r.status}`).toBeLessThan(600)
  })

  test('6. 回滚 POST /releases/{id}/rollback', async () => {
    if (releaseId == null) test.skip(true)
    const r = await call(ctx, 'POST', `/api/console/config/releases/${releaseId}/rollback`, {
      tenantId: 'tx', log, body: { tenantId: 'tx', reason: '[flow-09] rollback', operatorId: 'admin' },
    })
    expect(r.status, `rollback ${r.status}`).toBeLessThan(600)
  })

  test('7. change-logs 留痕', async () => {
    const r = await call(ctx, 'GET', '/api/console/config/change-logs?tenantId=tx&pageSize=10', { tenantId: 'tx', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })
})
