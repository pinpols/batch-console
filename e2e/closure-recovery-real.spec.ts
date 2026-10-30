import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect, test, csrfHeaders, enterDemoApp } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { ClosureRecoveryFixture, requiredEnvironment } from './fixtures/closure-recovery/fixture'

const enabled = process.env.E2E_CLOSURE_RECOVERY_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1') {
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and fixture cleanup')
}
test.use({ storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })
test.setTimeout(90_000)
test.skip(!enabled, 'Requires the integrated JARs and an exclusive real acceptance runtime slot')

type SyncState = {
  logId: number; status: string; successItems: number; skippedItems: number;
  configCount: number; receiptCount: number; receiptResults: unknown; reconciledBy: string | null
}
type RetryEvidence = {
  requestId: string; expectedAttempt: number; reason: string;
  reconciliationReference: string; confirmedNotDelivered: boolean
}
type AuditRow = {
  aggregateId: string; action: string; requestId: string; operatorId: string; params: string
}

async function authenticate(page: Page, tenantId: string): Promise<string> {
  if (process.env.E2E_SKIP_GLOBAL_SETUP !== '1') {
    throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and fixture cleanup')
  }
  const username = requiredEnvironment('E2E_USERNAME')
  const password = requiredEnvironment('E2E_PASSWORD')
  const anonymous = await page.request.get('/api/console/auth/me')
  expect(anonymous.status(), 'Real acceptance requires authentication enforcement').toBe(401)
  const login = await page.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': 'system' }, data: { username, password },
  })
  expect(login.status()).toBe(200)
  const checked = await page.request.get('/api/console/auth/check')
  expect(checked.status()).toBe(204)
  const cookies = await page.context().cookies()
  const authCookie = cookies.find(cookie => cookie.name === 'batch_console_token')
  expect(authCookie?.httpOnly).toBe(true)
  const csrfProbe = await page.request.post('/api/console/config/sync/import', {
    headers: { 'X-Tenant-Id': tenantId }, data: {},
  })
  expect(csrfProbe.status(), 'Real acceptance requires CSRF enforcement').toBe(403)
  await installE2eLocale(page)
  await seedBrowserStorage(page, { session: '1', tenantId, onboardingDone: '1' })
  return username
}

test('真实终态冷历史可见且不可重试，人工核对保留原投递和审计身份', async ({ page, network }, testInfo) => {
  const fixture = new ClosureRecoveryFixture()
  try {
    fixture.run('prepare-tenants')
    const ids = fixture.run<{ hotId: number; coldId: number }>('prepare-notifications')
    const username = await authenticate(page, fixture.tenantId)
    await enterDemoApp(page)
    await page.goto('/system/notifications')
    const terminalTab = page.getByRole('tab', { name: e2eText('notificationManagement.tabTerminalDeliveries') })
    await terminalTab.click()
    const coldRow = page.locator('tr', { hasText: fixture.coldEvent })
    const hotRow = page.locator('tr', { hasText: fixture.hotEvent })
    await expect(coldRow).toContainText('SUCCESS')
    await expect(coldRow.getByRole('button', { name: e2eText('terminalNotifications.reconcileRetry') })).toBeDisabled()
    await expect(hotRow).toContainText('EXHAUSTED')
    await hotRow.getByRole('button', { name: e2eText('terminalNotifications.reconcileRetry') }).click()
    const dialog = page.getByRole('dialog')
    const submit = dialog.getByRole('button', { name: e2eText('terminalNotifications.queueRetry') })
    await expect(submit).toBeDisabled()
    const reason = `fixture receiver confirmed not delivered ${fixture.suffix}`
    const reference = `closure-ticket-${fixture.suffix}`
    await dialog.locator('textarea').fill(reason)
    await dialog.locator('input:not([type="checkbox"])').fill(reference)
    await dialog.getByText(e2eText('terminalNotifications.confirmed'), { exact: true }).click()
    await expect(dialog.getByRole('checkbox', { name: e2eText('terminalNotifications.confirmed') })).toBeChecked()
    const retryPath = `/api/console/notifications/terminal-deliveries/RULE/${ids.hotId}/retry`
    const retryResponse = page.waitForResponse(response =>
      response.url().includes(retryPath) && response.request().method() === 'POST')
    await submit.click()
    const response = await retryResponse
    expect(response.status()).toBe(200)
    const sent = response.request().postDataJSON() as RetryEvidence
    const responseUrl = new URL(response.url())
    expect(responseUrl.searchParams.get('tenantId')).toBe(fixture.tenantId)
    expect(sent).toMatchObject({ expectedAttempt: 1, reason, reconciliationReference: reference, confirmedNotDelivered: true })
    expect(sent.requestId).toMatch(/^[0-9a-f-]{36}$/)
    await expect(dialog).toBeHidden()

    const auditResponse = page.waitForResponse(result =>
      result.url().includes('/api/console/queries/operation-audits') && result.request().method() === 'GET')
    await hotRow.getByRole('link', { name: e2eText('terminalNotifications.audit') }).click()
    const auditResult = await auditResponse
    expect(auditResult.status()).toBe(200)
    const auditBody = await auditResult.json() as { data: { items: AuditRow[] } }
    const audit = auditBody.data.items.find(item => item.requestId === sent.requestId)
    expect(audit).toMatchObject({ aggregateId: `RULE:${ids.hotId}`, action: 'NOTIFICATION_DELIVERY_RETRY', operatorId: username })
    const evidence = JSON.parse(audit?.params ?? 'null') as unknown
    expect(evidence).toMatchObject({ reason, reconciliationReference: reference, previousAttempt: 1, confirmedNotDelivered: true, terminalEventKey: fixture.hotEvent })
    const auditTableRow = page.locator('tr', { hasText: `RULE:${ids.hotId}` })
    await expect(auditTableRow).toContainText('NOTIFICATION_DELIVERY_RETRY')
    const state = fixture.run<{ hotCount: number; coldCount: number; auditCount: number }>('notification-state')
    expect(state).toMatchObject({ hotCount: 1, coldCount: 1, auditCount: 1 })
    network.assertClean('real terminal recovery and audit')
    const evidenceJson = JSON.stringify({ tenantId: fixture.tenantId, ids, request: sent, audit, state }, null, 2)
    await testInfo.attach('terminal-recovery-result.json', { body: evidenceJson, contentType: 'application/json' })
  } finally {
    fixture.cleanup()
    const cleanupEvidence = JSON.stringify({ tenantId: fixture.tenantId, remainingRows: 0 })
    await testInfo.attach('owned-fixture-cleanup.json', { body: cleanupEvidence, contentType: 'application/json' })
  }
})

test('真实 ConfigSync 核对已提交收据后刷新保持原结果且不重复执行目标', async ({ page, network }, testInfo) => {
  const fixture = new ClosureRecoveryFixture()
  try {
    fixture.run('prepare-tenants')
    const username = await authenticate(page, fixture.tenantId)
    const csrf = await csrfHeaders(page.request)
    const headers = { ...csrf, 'X-Tenant-Id': fixture.tenantId, 'Idempotency-Key': randomUUID() }
    fixture.run('install-sync-fault')
    try {
      const imported = await page.request.post('/api/console/config/sync/import', {
        headers,
        data: {
          tenantId: fixture.tenantId, sourceEnv: 'closure-browser-source', targetEnv: 'closure-browser-target',
          targetTenantIds: [fixture.targetA, fixture.targetB], dryRun: false,
          bundle: { resourceQueues: [{ queueCode: fixture.queueCode, queueName: 'Closure browser queue', queueType: 'MIXED' }] },
        },
      })
      expect(imported.status(), 'Only final audit persistence is faulted').toBe(500)
    } finally {
      fixture.run('remove-sync-fault')
    }
    const before = fixture.run<SyncState>('config-sync-state')
    await testInfo.attach('config-sync-before.json', { body: JSON.stringify(before), contentType: 'application/json' })
    expect(before).toMatchObject({ status: 'RUNNING', configCount: 2, receiptCount: 2 })
    await enterDemoApp(page)
    await page.goto('/config/management')
    await page.getByRole('tab', { name: e2eText('configManagement.tabSyncLogs') }).click()
    const row = page.locator('tr').filter({ has: page.getByText(`#${before.logId}`, { exact: true }) })
    await expect(row).toContainText('RUNNING')
    await expect(row).toContainText(e2eText('configSyncLogsTab.outcomePending'))
    const reconcilePath = `/api/console/config/sync/logs/${before.logId}/reconcile`
    const reconciliation = page.waitForResponse(response =>
      response.url().includes(reconcilePath) && response.request().method() === 'POST')
    await row.getByRole('button', { name: e2eText('configSyncLogsTab.reconcile') }).click()
    const response = await reconciliation
    expect(response.status()).toBe(200)
    const body = await response.json() as { data: { id: number; tenantId: string; syncStatus: string; successItems: number; skippedItems: number } }
    expect(body.data).toMatchObject({ id: before.logId, tenantId: fixture.tenantId, syncStatus: 'SUCCESS', successItems: 2, skippedItems: 0 })
    await expect(row).toContainText('SUCCESS')
    await expect(row.getByRole('button', { name: e2eText('configSyncLogsTab.reconcile') })).toHaveCount(0)
    await page.reload()
    await page.getByRole('tab', { name: e2eText('configManagement.tabSyncLogs') }).click()
    await expect(row).toContainText('SUCCESS')
    const after = fixture.run<SyncState>('config-sync-state')
    expect(after).toMatchObject({ status: 'SUCCESS', successItems: 2, skippedItems: 0, configCount: 2, receiptCount: 2, reconciledBy: username })
    expect(after.receiptResults).toEqual(before.receiptResults)
    network.assertClean('real ConfigSync reconcile and persisted result')
    const evidenceJson = JSON.stringify({ tenantId: fixture.tenantId, before, response: body.data, after }, null, 2)
    await testInfo.attach('config-sync-reconcile-result.json', { body: evidenceJson, contentType: 'application/json' })
  } finally {
    fixture.cleanup()
    const cleanupEvidence = JSON.stringify({ tenantId: fixture.tenantId, remainingRows: 0 })
    await testInfo.attach('owned-fixture-cleanup.json', { body: cleanupEvidence, contentType: 'application/json' })
  }
})
