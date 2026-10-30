import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { BrowserContext } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { OidcIdentityFixture } from './fixtures/runtime-progress/oidcIdentityFixture'

const enabled = process.env.E2E_OIDC_IDENTITY_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(150_000)
test.skip(
  !enabled,
  'Requires a WDI Console with the local OIDC management provider enabled and an exclusive tenant',
)

test('OIDC身份绑定页面、租户边界、冲突和审计真实闭环', async ({ page, browser }, testInfo) => {
  const fixture = new OidcIdentityFixture()
  const evidenceDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(
    new Date(),
  )
  const evidence = resolve('docs/reports/assets', `oidc-identity-${evidenceDate}`)
  mkdirSync(evidence, { recursive: true })
  const contexts: BrowserContext[] = []
  let adminContext: BrowserContext | undefined
  let tenantAdminContext: BrowserContext | undefined
  let primaryError: unknown
  let providerEnabled = false
  let anonymousAuthStatus = 0
  let tenantAdminStatuses: Record<string, number> = {}
  let duplicateStatus: number | undefined
  let unconfiguredTenantStatus: number | undefined
  let persistedState: ReturnType<OidcIdentityFixture['oidcState']> | undefined
  let oidcCleanup: Record<string, number> | undefined
  let cleanup: Record<string, number> | undefined
  const endpoint = '/api/console/auth/oidc/identities'

  async function listIdentities(request: BrowserContext['request']) {
    return request.get(endpoint, {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
  }

  try {
    anonymousAuthStatus = (await page.request.get('/api/console/auth/me')).status()
    expect(anonymousAuthStatus).toBe(401)
    fixture.prepare()

    adminContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    contexts.push(adminContext)
    tenantAdminContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    contexts.push(tenantAdminContext)
    await fixture.login(adminContext.request)
    await fixture.login(tenantAdminContext.request, true)
    await fixture.login(page.request)

    const providerResponse = await page.request.get('/api/console/auth/oidc/provider')
    expect(providerResponse.status()).toBe(200)
    const provider = (await providerResponse.json()).data as {
      enabled: boolean
      registrationId: string
    }
    providerEnabled = provider.enabled
    expect(providerEnabled).toBe(true)
    expect(provider.registrationId).toBe('wdi-local')

    const initialList = await listIdentities(page.request)
    expect(initialList.status()).toBe(200)
    expect((await initialList.json()).data).toEqual([])
    const unconfiguredTenantId = `e2e-oidc-other-${randomUUID().replaceAll('-', '')}`
    const unconfiguredTenantList = await page.request.get(endpoint, {
      params: { tenantId: unconfiguredTenantId },
      headers: { 'X-Tenant-Id': unconfiguredTenantId },
    })
    unconfiguredTenantStatus = unconfiguredTenantList.status()
    expect(unconfiguredTenantStatus).toBe(404)

    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/system/user-accounts')
    await page.getByRole('button', { name: e2eText('oidcIdentityBindings.open') }).click()

    const drawer = page.locator('.el-drawer:visible').filter({
      hasText: e2eText('oidcIdentityBindings.title'),
    })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText(e2eText('oidcIdentityBindings.scopeHint'))).toBeVisible()
    const form = drawer.locator('.oidc-bindings__form')
    const usernameInput = form
      .locator('.el-form-item')
      .filter({ hasText: e2eText('oidcIdentityBindings.username') })
      .getByRole('textbox')
    const subjectInput = form
      .locator('.el-form-item')
      .filter({ hasText: e2eText('oidcIdentityBindings.subject') })
      .getByRole('textbox')
    await usernameInput.fill(fixture.readerName)
    await subjectInput.fill(fixture.subject)
    await drawer
      .getByRole('button', { name: e2eText('oidcIdentityBindings.bind'), exact: true })
      .click()

    await expect
      .poll(async () => {
        const response = await listIdentities(page.request)
        if (response.status() !== 200) return null
        const body = (await response.json()).data as Array<{
          id: number
          tenantId: string
          username: string
          issuer: string
          subject: string
          linkedBy: string
        }>
        return body.find((identity) => identity.subject === fixture.subject) ?? null
      })
      .toMatchObject({
        tenantId: fixture.tenantId,
        username: fixture.readerName,
        issuer: 'https://issuer.invalid/wdi',
        subject: fixture.subject,
      })
    await expect(drawer.getByText(fixture.subject, { exact: true })).toBeVisible()
    persistedState = fixture.oidcState()
    expect(persistedState.identityCount).toBe(1)
    expect(persistedState.identity).toMatchObject({
      username: fixture.readerName,
      issuer: 'https://issuer.invalid/wdi',
      subject: fixture.subject,
      linkedBy: fixture.adminName,
    })
    expect(persistedState.accountRoles).toBe('ROLE_TENANT_ADMIN')

    const duplicate = await fixture.mutate(adminContext.request, endpoint, {
      username: fixture.readerName,
      subject: `duplicate-${fixture.subject}`,
    })
    duplicateStatus = duplicate.status()
    expect(duplicateStatus).toBe(409)
    const duplicateReadback = await listIdentities(adminContext.request)
    expect(duplicateReadback.status()).toBe(200)
    expect((await duplicateReadback.json()).data as unknown[]).toHaveLength(1)

    const tenantAdminList = await listIdentities(tenantAdminContext.request)
    const tenantAdminBind = await fixture.mutate(tenantAdminContext.request, endpoint, {
      username: fixture.readerName,
      subject: `forbidden-${fixture.subject}`,
    })
    const bound = persistedState.identity!
    const tenantAdminUnbind = await fixture.mutate(
      tenantAdminContext.request,
      `${endpoint}/${bound.id}`,
      undefined,
      'DELETE',
    )
    tenantAdminStatuses = {
      list: tenantAdminList.status(),
      bind: tenantAdminBind.status(),
      unbind: tenantAdminUnbind.status(),
    }
    expect(tenantAdminStatuses).toEqual({ list: 403, bind: 403, unbind: 403 })

    await page.screenshot({ path: resolve(evidence, 'identity-bound.png'), fullPage: true })
    await drawer
      .getByRole('button', { name: e2eText('oidcIdentityBindings.unbind'), exact: true })
      .click()
    const confirmation = page.locator('.el-message-box:visible')
    await expect(confirmation).toBeVisible()
    await confirmation.getByRole('button', { name: e2eText('common.confirm'), exact: true }).click()
    await expect
      .poll(async () => {
        const response = await listIdentities(page.request)
        if (response.status() !== 200) return -1
        return ((await response.json()).data as unknown[]).length
      })
      .toBe(0)
    persistedState = fixture.oidcState()
    expect(persistedState.identityCount).toBe(0)
    expect(persistedState.accountRoles).toBe('ROLE_TENANT_ADMIN')
    expect(
      persistedState.auditActions.some(
        (row) => row.action === 'auth.oidc.identity.bind' && row.result === 'SUCCESS',
      ),
    ).toBe(true)
    expect(
      persistedState.auditActions.some(
        (row) => row.action === 'auth.oidc.identity.unbind' && row.result === 'SUCCESS',
      ),
    ).toBe(true)
  } catch (error) {
    primaryError = error
  } finally {
    try {
      oidcCleanup = fixture.cleanupOidc()
      expect(oidcCleanup.identityRemaining).toBe(0)
      expect(oidcCleanup.auditRemaining).toBe(0)
    } catch (cleanupError) {
      primaryError = primaryError
        ? new AggregateError([primaryError, cleanupError], 'OIDC identity cleanup failed')
        : cleanupError
    }
    try {
      cleanup = await fixture.finish(
        adminContext?.request ?? page.request,
        tenantAdminContext?.request,
      )
      expect(cleanup.credentialAccounts).toBe(0)
      expect(Object.values(cleanup).every((count) => count === 0)).toBe(true)
    } catch (cleanupError) {
      primaryError = primaryError
        ? new AggregateError([primaryError, cleanupError], 'OIDC binding and parent cleanup failed')
        : cleanupError
    } finally {
      for (const context of contexts) await context.close()
    }
    writeFileSync(
      resolve(evidence, 'real-evidence.json'),
      JSON.stringify(
        {
          anonymousAuthStatus,
          providerEnabled,
          tenantAdminStatuses,
          duplicateStatus,
          unconfiguredTenantStatus,
          persistedBindingVerified:
            persistedState?.identityCount === 0 &&
            persistedState.auditActions.some((row) => row.action === 'auth.oidc.identity.bind'),
          rolesUnchanged: persistedState?.accountRoles === 'ROLE_TENANT_ADMIN',
          auditActions: persistedState?.auditActions.map((row) => ({
            action: row.action,
            result: row.result,
          })),
          oidcCleanup,
          cleanup,
          cleanupAllZero:
            oidcCleanup !== undefined &&
            oidcCleanup.identityRemaining === 0 &&
            oidcCleanup.auditRemaining === 0 &&
            cleanup !== undefined &&
            Object.values(cleanup).every((count) => count === 0),
        },
        null,
        2,
      ),
    )
  }
  if (primaryError) throw primaryError
})
