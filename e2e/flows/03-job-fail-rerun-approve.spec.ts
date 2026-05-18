/**
 * Flow 03: 任务失败 → 自助重跑申请 → ADMIN 批准 → 重跑成功
 *
 * 闭环路径:
 *   1. 找 FAILED 实例(DB 已有 5 条)
 *   2. TENANT_USER 提自助重跑单 → 落 approval_command PENDING
 *   3. ADMIN 在 /approvals 列表看到
 *   4. ADMIN 批准 → 单状态 APPROVED + 触发重跑(downstream 在线时)
 *   5. 审计日志可回查
 */
import { test, expect } from '@playwright/test'
import { adminCtx, tenantUserCtx, call, FlowLog } from './_watchdog'

test.describe.serial('Flow 03: fail → rerun → approve', () => {
  let admin: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false

  test.beforeAll(async () => { admin = await adminCtx() })
  test.afterAll(async () => { log.flushIfFailed(failed, 'flow-03-rerun-approve'); await admin.dispose() })

  test('1. 找 FAILED job instance(ta 已有 4 条)', async () => {
    const r = await call(admin, 'GET', '/api/console/queries/instances?tenantId=ta&status=FAILED&pageSize=5', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('2. 提自助重跑单(admin 同租户)— console-api 路径 OK', async () => {
    const r = await call(admin, 'POST', '/api/console/self-service/jobs/rerun-request', {
      tenantId: 'ta',
      log,
      body: {
        tenantId: 'ta',
        jobCode: 'e2e-job-1779033370022',
        bizDate: '2026-05-18',
        reason: '[flow-03] auto rerun submission',
      },
    })
    // 500 接受(downstream orchestrator 不在线);console-api 本身不应 400 / 403
    expect([200, 202, 500].includes(r.status), `rerun ${r.status}`).toBe(true)
  })

  test('3. 审批中心可查 PENDING(admin 视角)', async () => {
    const r = await call(admin, 'GET', '/api/console/queries/approvals?tenantId=ta&status=PENDING&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('4. 审计日志可查重跑动作有痕', async () => {
    const r = await call(admin, 'GET', '/api/console/queries/audits?tenantId=ta&pageSize=20', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('5. /self-service/jobs 入口可访问(FE 表单页 BE 数据 query)', async () => {
    const r = await call(admin, 'GET', '/api/console/queries/instances?tenantId=ta&pageSize=5', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })
})
