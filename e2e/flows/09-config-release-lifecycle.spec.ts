/**
 * Flow 09: 配置发布完整生命周期。
 *
 * 真实路径：DRAFT -> PENDING_APPROVAL -> PUBLISHED -> ROLLED_BACK。
 * 审批使用独立 ROLE_ADMIN 账号，确保服务端的禁止自审规则被真实执行。
 */
import {
  request as pwRequest,
  type APIRequestContext,
} from '@playwright/test'
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog, e2eCode } from './_watchdog'

const API = process.env.BC_API_BASE || 'http://localhost:18080'

type ReleaseRow = {
  id: number
  configKey: string
  configStatus: string
  versionNo: number
}

type ApprovalDetail = {
  releaseId: number
  configStatus: string
  approval?: { id?: number; approvalStatus?: string } | null
}

test.describe.serial('Flow 09: config release full lifecycle', () => {
  let submitter: APIRequestContext
  let approver: APIRequestContext
  const log = new FlowLog()
  let failed = false
  let releaseV1: ReleaseRow | null = null
  let releaseV2: ReleaseRow | null = null
  const key = e2eCode('flow09_queue').replaceAll('-', '_')

  test.beforeAll(async () => {
    submitter = await adminCtx()
    approver = await pwRequest.newContext({
      baseURL: API,
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    })
    const login = await approver.post('/api/console/auth/login', {
      headers: { 'X-Tenant-Id': 'system' },
      data: { username: 'config-admin', password: 'admin123' },
      failOnStatusCode: false,
    })
    if (login.status() !== 200) {
      throw new Error(`config-admin login failed: HTTP ${login.status()}`)
    }
  })

  test.afterAll(async () => {
    log.flushIfFailed(failed, 'flow-09-config-release')
    await submitter.dispose()
    await approver.dispose()
  })

  test.afterEach(({}, testInfo) => {
    failed ||= testInfo.status !== testInfo.expectedStatus
  })

  async function findRelease(versionNo: number): Promise<ReleaseRow | null> {
    const list = await call(
      submitter,
      'GET',
      '/api/console/config/releases?tenantId=tx&pageSize=200',
      { tenantId: 'tx', log },
    )
    expect(list.status).toBe(200)
    const rows = (list.body as { data?: ReleaseRow[] }).data ?? []
    return rows.find((row) => row.configKey === key && row.versionNo === versionNo) ?? null
  }

  async function createRelease(versionNo: number, maxRunningJobs: number) {
    const response = await call(submitter, 'POST', '/api/console/config/releases', {
      tenantId: 'tx',
      log,
      body: {
        tenantId: 'tx',
        configKey: key,
        configName: `[flow-09] queue v${versionNo}`,
        configType: 'RESOURCE_QUEUE',
        configPayloadJson: JSON.stringify({
          queueCode: key,
          queueName: '[flow-09] release queue',
          queueType: 'MIXED',
          maxRunningJobs,
          maxRunningPartitions: 20,
          maxQps: 10,
          priorityPolicy: 'FIFO',
          fairShareWeight: 1,
          enabled: true,
        }),
        operatorId: 'admin',
      },
    })
    expect(response.status, `create v${versionNo}`).toBe(200)
    const release = await findRelease(versionNo)
    expect(release, `find ${key} v${versionNo}`).not.toBeNull()
    expect(release?.configStatus).toBe('DRAFT')
    return release!
  }

  async function submitAndApprove(release: ReleaseRow) {
    const submitted = await call(
      submitter,
      'POST',
      `/api/console/config/releases/${release.id}/submit-approval`,
      {
        tenantId: 'tx',
        log,
        body: { tenantId: 'tx', reason: `[flow-09] submit v${release.versionNo}` },
      },
    )
    expect(submitted.status, `submit v${release.versionNo}`).toBe(200)
    const detail = (submitted.body as { data?: ApprovalDetail }).data
    expect(detail?.configStatus).toBe('PENDING_APPROVAL')
    const approvalId = detail?.approval?.id
    expect(approvalId, `approval id v${release.versionNo}`).toBeTruthy()

    const approved = await call(
      approver,
      'POST',
      `/api/console/config/approvals/${approvalId}/approve`,
      {
        tenantId: 'tx',
        log,
        body: { tenantId: 'tx', reason: `[flow-09] approve v${release.versionNo}` },
      },
    )
    expect(approved.status, `approve v${release.versionNo}`).toBe(200)
    const approvedDetail = (approved.body as { data?: ApprovalDetail }).data
    expect(approvedDetail?.configStatus).toBe('PUBLISHED')
  }

  test('1. 创建并独立审批 v1', async () => {
    releaseV1 = await createRelease(1, 2)
    await submitAndApprove(releaseV1)
  })

  test('2. 查询运行时配置，v1 已生效', async () => {
    const response = await call(
      submitter,
      'GET',
      `/api/console/queues?tenantId=tx&queueCode=${encodeURIComponent(key)}&pageSize=20`,
      { tenantId: 'tx', log },
    )
    expect(response.status).toBe(200)
    expect(JSON.stringify(response.body)).toContain(key)
    expect(JSON.stringify(response.body)).toContain('"maxRunningJobs":2')
  })

  test('3. 创建并独立审批 v2', async () => {
    releaseV2 = await createRelease(2, 4)
    await submitAndApprove(releaseV2)
  })

  test('4. 回滚 v2 到前一有效版本', async () => {
    expect(releaseV2).not.toBeNull()
    const response = await call(
      submitter,
      'POST',
      `/api/console/config/releases/${releaseV2!.id}/rollback`,
      {
        tenantId: 'tx',
        log,
        body: {
          tenantId: 'tx',
          reason: '[flow-09] rollback v2',
          expectedVersionNo: releaseV2!.versionNo,
        },
      },
    )
    expect(response.status, 'rollback v2').toBe(200)

    const detail = await call(
      submitter,
      'GET',
      `/api/console/config/releases/${releaseV2!.id}?tenantId=tx`,
      { tenantId: 'tx', log },
    )
    expect(detail.status).toBe(200)
    expect((detail.body as { data?: ReleaseRow }).data?.configStatus).toBe('ROLLED_BACK')
  })

  test('5. 回滚后运行时配置恢复 v1', async () => {
    const response = await call(
      submitter,
      'GET',
      `/api/console/queues?tenantId=tx&queueCode=${encodeURIComponent(key)}&pageSize=20`,
      { tenantId: 'tx', log },
    )
    expect(response.status).toBe(200)
    expect(JSON.stringify(response.body)).toContain('"maxRunningJobs":2')
  })

  test('6. change-logs 包含发布与回滚留痕', async () => {
    const response = await call(
      submitter,
      'GET',
      '/api/console/config/change-logs?tenantId=tx&pageSize=200',
      { tenantId: 'tx', log },
    )
    failed = response.status !== 200
    expect(response.status).toBe(200)
    const serialized = JSON.stringify(response.body)
    expect(serialized).toContain(key)
    expect(serialized).toContain('APPROVE')
    expect(serialized).toContain('ROLLBACK')
  })
})
