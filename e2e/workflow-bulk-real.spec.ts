import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect, test, csrfHeaders } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { requiredEnvironment } from './fixtures/closure-recovery/fixture'
import { WorkflowBulkFixture } from './fixtures/workflow-bulk/fixture'

const enabled = process.env.E2E_CLOSURE_RECOVERY_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1') {
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and fixture cleanup')
}
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })
test.setTimeout(90_000)
test.skip(!enabled, 'Requires integrated JARs and an exclusive real acceptance runtime slot')

type TriggeredRequest = {
  definitionId: number; key: string; body: { tenantId: string; bizDate: string; triggerType: string }
}

async function authenticate(page: Page, tenantId: string): Promise<void> {
  const anonymous = await page.request.get('/api/console/auth/me')
  expect(anonymous.status(), 'Real acceptance requires authentication enforcement').toBe(401)
  const username = requiredEnvironment('E2E_USERNAME')
  const password = requiredEnvironment('E2E_PASSWORD')
  const login = await page.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': 'system' }, data: { username, password },
  })
  expect(login.status()).toBe(200)
  const checked = await page.request.get('/api/console/auth/check')
  expect(checked.status()).toBe(204)
  await installE2eLocale(page)
  await seedBrowserStorage(page, { session: '1', tenantId })
}

test('真实新建SSE连接独立发行票据且刷新不复用幂等键', async ({ page, network }, testInfo) => {
  const fixture = new WorkflowBulkFixture()
  const tickets: Array<{ key: string; status: number }> = []
  let primaryError: unknown
  try {
    fixture.run('prepare')
    await authenticate(page, fixture.tenantId)
    page.on('response', response => {
      const request = response.request()
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/console/auth/stream/ticket') {
        tickets.push({ key: request.headers()['idempotency-key'], status: response.status() })
      }
    })
    await page.goto('/workflow/definitions')
    await expect.poll(() => tickets.length).toBeGreaterThanOrEqual(1)
    const initialCount = tickets.length
    await page.reload()
    await expect.poll(() => tickets.length).toBeGreaterThan(initialCount)
    expect(tickets.every(item => item.status === 200 && Boolean(item.key))).toBe(true)
    expect(new Set(tickets.map(item => item.key)).size).toBe(tickets.length)
    network.assertClean('real SSE ticket issuance')
    await testInfo.attach('sse-ticket-result.json', {
      body: JSON.stringify({ tenantId: fixture.tenantId, tickets }), contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    try {
      const residue = fixture.cleanup()
      await testInfo.attach('sse-ticket-cleanup.json', {
        body: JSON.stringify({ tenantId: fixture.tenantId, residue }), contentType: 'application/json',
      })
    } catch (cleanupError) {
      if (primaryError) throw new AggregateError([primaryError, cleanupError], 'SSE acceptance and owned-fixture cleanup failed')
      throw cleanupError
    }
  }
})

test('真实批量发起逐项保留原键、独立完成且重发不增加请求与运行', async ({ page, network }, testInfo) => {
  const fixture = new WorkflowBulkFixture()
  const triggered: TriggeredRequest[] = []
  const ticketResponses: Array<{ key: string; status: number }> = []
  let primaryError: unknown
  try {
    fixture.run('prepare')
    await authenticate(page, fixture.tenantId)
    const csrf = await csrfHeaders(page.request)
    for (const code of fixture.codes) {
      const created = await page.request.post('/api/console/workflow-definitions', {
        headers: { ...csrf, 'X-Tenant-Id': fixture.tenantId, 'Idempotency-Key': randomUUID() },
        data: {
          tenantId: fixture.tenantId, workflowCode: code, workflowName: code,
          workflowType: 'DAG', enabled: true, scheduleType: 'MANUAL', triggerMode: 'MIXED',
          calendarCode: fixture.calendarCode,
          nodes: [
            { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
            { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 1, enabled: true },
          ],
          edges: [{ fromNodeCode: 'START', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true }],
        },
      })
      const creationBody = await created.json() as unknown
      const creationEvidence = JSON.stringify(creationBody)
      expect(created.status(), creationEvidence).toBe(200)
    }
    page.on('request', request => {
      const match = new URL(request.url()).pathname.match(/\/workflow-definitions\/(\d+)\/trigger$/)
      if (request.method() !== 'POST' || !match) return
      triggered.push({
        definitionId: Number(match[1]), key: request.headers()['idempotency-key'],
        body: request.postDataJSON() as TriggeredRequest['body'],
      })
    })
    page.on('response', response => {
      const request = response.request()
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/console/auth/stream/ticket') {
        ticketResponses.push({ key: request.headers()['idempotency-key'], status: response.status() })
      }
    })
    await page.goto('/workflow/definitions')
    for (const code of fixture.codes) {
      const row = page.locator('.el-table__body-wrapper tbody tr', { hasText: code })
      await expect(row).toHaveCount(1)
      await row.locator('.el-checkbox__input').click()
      await expect(row.getByRole('checkbox')).toBeChecked()
    }
    await page.getByRole('button', { name: e2eText('workflowDefinitionList.bulk.open') }).first().click()
    const dialog = page.getByRole('dialog', { name: e2eText('workflowDefinitionList.bulk.title') })
    const date = dialog.locator('.el-date-editor input')
    await date.fill(fixture.bizDate)
    await date.press('Tab')
    const confirmLabel = e2eText('workflowDefinitionList.bulk.confirm').replace('{n}', '2')
    await dialog.getByRole('button', { name: confirmLabel }).click()
    const submitted = e2eText('workflowDefinitionList.bulk.states.SUBMITTED')
    for (const code of fixture.codes) {
      await expect(dialog.locator('tr', { hasText: code })).toContainText(submitted)
    }
    expect(triggered).toHaveLength(2)
    expect(new Set(triggered.map(item => item.key)).size).toBe(2)
    for (const item of triggered) {
      expect(item.key).toMatch(/^[0-9a-f-]{36}$/)
      expect(item.body).toMatchObject({ tenantId: fixture.tenantId, bizDate: fixture.bizDate, triggerType: 'MANUAL' })
    }
    await expect.poll(() => {
      const state = fixture.state()
      return { runs: state.runs.map(run => run.status), events: state.terminalEvents.map(event => event.status) }
    }, {
      timeout: 45_000, intervals: [250, 500, 1000],
    }).toEqual({ runs: ['SUCCESS', 'SUCCESS'], events: ['PUBLISHED', 'PUBLISHED'] })
    const before = fixture.state()
    expect(before.requests).toHaveLength(2)
    expect(before.nodes).toHaveLength(4)
    expect(before.nodes.every(node => node.status === 'SUCCESS')).toBe(true)
    expect(before.jobInstances).toBe(0)
    for (const item of triggered) {
      const headers = { ...csrf, 'X-Tenant-Id': fixture.tenantId, 'Idempotency-Key': item.key }
      const statusPath = `/api/console/workflow-definitions/${item.definitionId}/trigger-status`
      const receipt = await page.request.get(statusPath, { headers, params: { tenantId: fixture.tenantId } })
      expect(receipt.status()).toBe(200)
      const receiptBody = await receipt.json() as { data: { requestId: string; requestStatus: string; bizDate: string } }
      const request = before.requests.find(row => row.workflowDefinitionId === item.definitionId)
      expect(receiptBody.data).toMatchObject({ requestId: request?.requestId, requestStatus: 'LAUNCHED', bizDate: fixture.bizDate })
      const triggerPath = `/api/console/workflow-definitions/${item.definitionId}/trigger`
      const replay = await page.request.post(triggerPath, { headers, data: item.body })
      expect(replay.status()).toBe(409)
      const replayBody = await replay.json() as { code: string; idempotentReplay: boolean }
      expect(replayBody).toMatchObject({ code: 'CONFLICT', idempotentReplay: true })
      const reconciled = await page.request.get(statusPath, { headers, params: { tenantId: fixture.tenantId } })
      expect(reconciled.status()).toBe(200)
      const reconciledBody = await reconciled.json() as { data: { requestId: string; requestStatus: string } }
      expect(reconciledBody.data).toMatchObject({ requestId: request?.requestId, requestStatus: 'LAUNCHED' })
    }
    const after = fixture.state()
    expect(after.requests).toEqual(before.requests)
    expect(after.runs).toEqual(before.runs)
    expect(after.nodes).toEqual(before.nodes)
    // 独立刷新会消费新票据，不得把前一次发行的键套给下一次连接。
    for (let reload = 0; reload < 2; reload += 1) {
      await page.reload()
      await expect(page.locator('.el-table__body-wrapper tbody tr', { hasText: fixture.codes[0] })).toHaveCount(1)
    }
    await expect.poll(() => ticketResponses.length).toBeGreaterThanOrEqual(2)
    expect(ticketResponses.every(item => item.status === 200 && Boolean(item.key))).toBe(true)
    expect(new Set(ticketResponses.map(item => item.key)).size).toBe(ticketResponses.length)
    network.assertClean('real workflow bulk trigger')
    const evidence = JSON.stringify({ tenantId: fixture.tenantId, triggered, ticketResponses, before, after }, null, 2)
    await testInfo.attach('workflow-bulk-result.json', { body: evidence, contentType: 'application/json' })
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    try {
      const residue = fixture.cleanup()
      const cleanupEvidence = JSON.stringify({ tenantId: fixture.tenantId, residue })
      await testInfo.attach('workflow-bulk-cleanup.json', { body: cleanupEvidence, contentType: 'application/json' })
    } catch (cleanupError) {
      if (primaryError) {
        throw new AggregateError([primaryError, cleanupError], 'Bulk acceptance and owned-fixture cleanup failed')
      }
      throw cleanupError
    }
  }
})
