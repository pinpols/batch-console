/**
 * Flow 11: Worker drain / takeover / warmup 真生效
 *
 * 测试通过 orchestrator 内部注册端点准备 3 个隔离 worker，分别验证
 * list / drain / takeover / OFFLINE -> warmup 的真实状态转移。
 */
import { test, expect } from '@playwright/test'
import { API_BASE_URL, ORCHESTRATOR_BASE_URL } from '../support/config'
import { adminCtx, call, FlowLog } from './_watchdog'
import { createHash, createHmac, randomUUID } from 'node:crypto'

test.describe.serial('Flow 11: worker drain/takeover/warmup (API smoke)', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false
  let apiKeyId = 0
  let workerApiKey = ''
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const workerCodes = {
    drain: `e2e-drain-${suffix}`,
    takeover: `e2e-takeover-${suffix}`,
    warmup: `e2e-warmup-${suffix}`,
  }

  test.beforeAll(async () => {
    ctx = await adminCtx()
    const { cookies } = await ctx.storageState()
    const csrfToken = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value
    const keyResponse = await ctx.post(`${API_BASE_URL}/api/console/api-keys?tenantId=ta`, {
      headers: {
        'X-Tenant-Id': 'system',
        'Idempotency-Key': `e2e-flow-worker-key-${suffix}`,
        ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
      },
      data: { keyName: `e2e-flow-worker-${suffix}`, scopes: 'worker.execute' },
      failOnStatusCode: false,
    })
    const keyBody = await keyResponse.json().catch(() => null)
    expect(keyResponse.status(), 'create scoped worker API key').toBe(200)
    apiKeyId = keyBody?.data?.id
    workerApiKey = keyBody?.data?.rawKey
    expect(apiKeyId).toBeTruthy()
    expect(workerApiKey).toBeTruthy()

    for (const workerCode of Object.values(workerCodes)) {
      const path = '/internal/workers/register'
      const body = {
          tenantId: 'ta',
          workerCode,
          workerGroup: 'PROCESS',
          status: 'ONLINE',
          hostName: 'e2e-local',
          hostIp: '127.0.0.1',
          processId: suffix,
          heartbeatAt: new Date().toISOString(),
          capabilityTags: [],
          currentLoad: 0,
          maxConcurrent: 1,
          workerPoolCode: workerCode,
        }
      const response = await signedWorkerRequest(path, body)
      expect(response.status(), `register ${workerCode}`).toBe(200)
    }
  })
  test.afterAll(async () => {
    log.flushIfFailed(failed, 'flow-11-worker')
    if (apiKeyId) {
      const { cookies } = await ctx.storageState()
      const csrfToken = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value
      await ctx.delete(`${API_BASE_URL}/api/console/api-keys/${apiKeyId}?tenantId=ta`, {
        headers: {
          'X-Tenant-Id': 'system',
          'Idempotency-Key': `e2e-flow-worker-revoke-${suffix}`,
          ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
        },
        failOnStatusCode: false,
      })
    }
    await ctx.dispose()
  })

  async function signedWorkerRequest(path: string, body: Record<string, unknown>) {
    const payload = JSON.stringify(body)
    const timestamp = String(Date.now())
    const nonce = randomUUID()
    const bodyHash = createHash('sha256').update(payload).digest('hex')
    const canonical = `POST\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`
    const signature = createHmac('sha256', workerApiKey).update(canonical).digest('hex')
    return ctx.post(`${ORCHESTRATOR_BASE_URL}${path}`, {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'X-Batch-Api-Key': workerApiKey,
        'X-Batch-Tenant-Id': 'ta',
        'X-Batch-Timestamp': timestamp,
        'X-Batch-Nonce': nonce,
        'X-Batch-Signature': signature,
      },
      failOnStatusCode: false,
    })
  }

  test('1. 查 worker 列表(/queries/workers)', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/workers?tenantId=ta&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
    const items = (r.body as { data?: { items?: Array<{ workerCode: string }> } }).data?.items ?? []
    const listedCodes = items.map((item) => item.workerCode)
    expect(listedCodes).toEqual(expect.arrayContaining(Object.values(workerCodes)))
    log.log('workerCodes', listedCodes)
  })

  test('2. 查 cluster-diagnostic/workers', async () => {
    const r = await call(ctx, 'GET', '/api/console/ops/cluster-diagnostic/workers?tenantId=ta', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('3. drain 端点真实进入 DRAINING', async () => {
    const r = await call(ctx, 'POST', `/api/console/workers/${workerCodes.drain}/drain`, {
      tenantId: 'ta', log, body: { tenantId: 'ta', timeoutSeconds: 60 },
    })
    expect(r.status, `drain ${r.status}`).toBe(200)
    expect((r.body as { data?: { status?: string } }).data?.status).toBe('DRAINING')
  })

  test('4. takeover 端点真实退役 worker', async () => {
    const r = await call(ctx, 'POST', `/api/console/workers/${workerCodes.takeover}/takeover`, {
      tenantId: 'ta', log, body: { tenantId: 'ta' },
    })
    expect(r.status, `takeover ${r.status}`).toBe(200)
    expect((r.body as { data?: { status?: string } }).data?.status).toBe('DECOMMISSIONED')
  })

  test('5. warmup 端点真实恢复 OFFLINE worker', async () => {
    const offline = await signedWorkerRequest(`/internal/workers/${workerCodes.warmup}/status`, {
      tenantId: 'ta',
      status: 'OFFLINE',
    })
    expect(offline.status(), `set offline ${workerCodes.warmup}`).toBe(200)
    const r = await call(
      ctx,
      'POST',
      `/api/console/workers/${workerCodes.warmup}/warmup?tenantId=ta`,
      { tenantId: 'ta', log },
    )
    expect(r.status, `warmup ${r.status}`).toBe(200)
    expect((r.body as { data?: { status?: string } }).data?.status).toBe('ONLINE')
  })
})
