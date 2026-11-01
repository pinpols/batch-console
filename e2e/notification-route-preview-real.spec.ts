import { randomUUID } from 'node:crypto'
import {
  request as requestFactory,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { PersistentWaitFixture } from './fixtures/runtime-progress/fixture'

const enabled = process.env.E2E_NOTIFICATION_ROUTE_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns identities and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(180_000)
test.skip(!enabled, 'Requires isolated authenticated services and PostgreSQL')

class RouteFixture extends PersistentWaitFixture {
  readonly otherTenant = `route-${randomUUID()}`
  private otherTenantStarted = false
  private routePreparationStarted = false

  prepareRoute() {
    this.otherTenantStarted = true
    this.prepareWorkflowVersionTenant(this.otherTenant)
    this.routePreparationStarted = true
    expect(
      this.ownedSql('notification-route-prepare', { other_tenant_id: this.otherTenant }),
    ).toEqual({ ready: true })
  }

  routeState() {
    return this.ownedSql<Record<string, unknown>>('notification-route-state')
  }

  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    await this.waitForOwnedSqlSessions()
    let routes = {}
    if (this.routePreparationStarted) {
      routes = this.ownedSql<Record<string, number>>('notification-route-cleanup', {
        other_tenant_id: this.otherTenant,
      })
      expect(Object.values(routes).every((count) => count === 0)).toBe(true)
    }
    if (this.otherTenantStarted)
      expect(this.cleanupWorkflowVersionTenant(this.otherTenant)).toEqual({
        tenantRowsRemaining: 0,
      })
    return { ...(await super.finish(request, reader)), ...routes }
  }
}

test('路由模拟匹配启用配置，遵守角色与租户边界且不产生投递', async ({
  page,
  browser,
}, testInfo) => {
  const fixture = new RouteFixture()
  const anonymous = await requestFactory.newContext({
    baseURL: String(testInfo.project.use.baseURL),
  })
  const contexts: BrowserContext[] = []
  let primaryError: unknown
  try {
    fixture.prepare()
    fixture.prepareWaitRoles()
    fixture.prepareRoute()
    await fixture.login(page.request)
    const createContext = async (username: string) => {
      const context = await browser.newContext({
        baseURL: String(testInfo.project.use.baseURL),
        serviceWorkers: 'block',
      })
      contexts.push(context)
      const login = await context.request.post('/api/console/auth/login', {
        headers: { 'X-Tenant-Id': fixture.tenantId },
        data: { username, password: fixture.password },
      })
      expect(login.status()).toBe(200)
      return context
    }
    const reader = await createContext(fixture.readerName)
    const auditor = await createContext(fixture.auditorName)
    const user = await createContext(fixture.userName)
    const before = fixture.routeState()
    const params = { tenantId: fixture.tenantId, eventType: 'JOB_FAILED', jobCode: 'job-match' }
    const getPreview = (request: APIRequestContext, tenantId = fixture.tenantId) =>
      request.get('/api/console/notifications/route-preview', {
        params: { ...params, tenantId },
        headers: { 'X-Tenant-Id': fixture.tenantId },
      })
    const adminResult = await getPreview(page.request)
    expect(adminResult.status()).toBe(200)
    const result = (await adminResult.json()).data
    expect(result.rules).toEqual([
      expect.objectContaining({
        name: 'route-match',
        channelCode: 'route-enabled',
        channelType: 'WEBHOOK',
      }),
    ])
    expect(result.webhooks).toEqual([expect.objectContaining({ name: 'webhook-match' })])
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE_|private\.invalid|secret|callbackUrl|configJson/i,
    )
    expect((await getPreview(reader.request)).status()).toBe(200)
    expect((await getPreview(reader.request, fixture.otherTenant)).status()).toBe(403)
    expect((await getPreview(auditor.request)).status()).toBe(403)
    expect((await getPreview(user.request)).status()).toBe(403)
    expect((await getPreview(anonymous)).status()).toBe(401)
    for (const [severity, expected] of [
      ['INFO', []],
      ['WARN', ['route-alert-warn']],
      ['ERROR', ['route-alert-error']],
      ['CRITICAL', []],
    ] as const) {
      const response = await page.request.get('/api/console/notifications/route-preview', {
        params: { tenantId: fixture.tenantId, eventType: 'ALERT_ESCALATED', severity },
        headers: { 'X-Tenant-Id': fixture.tenantId },
      })
      expect(response.status()).toBe(200)
      expect((await response.json()).data.rules.map((rule: { name: string }) => rule.name)).toEqual(
        expected,
      )
    }
    for (const severity of ['', 'INVALID']) {
      const response = await page.request.get('/api/console/notifications/route-preview', {
        params: { tenantId: fixture.tenantId, eventType: 'ALERT_ESCALATED', severity },
        headers: { 'X-Tenant-Id': fixture.tenantId },
      })
      expect(response.status()).toBe(400)
    }

    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.goto('/system/notifications')
    await page.getByRole('tab', { name: e2eText('notificationManagement.tabRoutePreview') }).click()
    const preview = page.locator('#pane-routePreview')
    await preview
      .locator('.el-form-item')
      .filter({ hasText: e2eText('notificationRoutePreview.eventType') })
      .locator('.el-select')
      .click()
    await page.getByRole('option', { name: /JOB_FAILED/ }).click()
    await preview
      .locator('.el-form-item')
      .filter({ hasText: e2eText('notificationRoutePreview.jobCode') })
      .locator('input')
      .fill('job-match')
    await preview.getByRole('button', { name: e2eText('notificationRoutePreview.run') }).click()
    await expect(preview.locator('section[aria-live="polite"]')).toContainText('route-match')
    await expect(preview.locator('section[aria-live="polite"]')).toContainText('webhook-match')
    await expect(preview.locator('section[aria-live="polite"]')).not.toContainText(
      'route-missing-channel',
    )
    await testInfo.attach('notification-route-preview.png', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    })
    expect(fixture.routeState()).toEqual(before)
    await testInfo.attach('notification-route-preview-evidence.json', {
      body: JSON.stringify({
        rules: result.rules,
        webhooks: result.webhooks,
        stateUnchanged: true,
      }),
      contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    await page.goto('about:blank')
    try {
      const cleanup = await fixture.finish(page.request, contexts[0]?.request)
      await testInfo.attach('notification-route-preview-cleanup.json', {
        body: JSON.stringify(cleanup),
        contentType: 'application/json',
      })
    } catch (error) {
      if (primaryError) throw new AggregateError([primaryError, error], '通知路由模拟及清理失败')
      throw error
    } finally {
      for (const context of contexts) await context.close()
      await anonymous.dispose()
    }
  }
})
