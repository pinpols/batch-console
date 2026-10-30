import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { BrowserContext } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { requiredEnvironment } from './fixtures/closure-recovery/fixture'
import { AtomicTaskConfigFixture } from './fixtures/runtime-progress/fixture'

const enabled = process.env.E2E_ATOMIC_CONFIG_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(150_000)
test.skip(
  !enabled,
  'Requires current WDI runtime, real authentication and exclusive acceptance slot',
)

test('Atomic已保存配置真实持久化、复用及角色边界', async ({ page, browser }, testInfo) => {
  const fixture = new AtomicTaskConfigFixture()
  const evidenceDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(
    new Date(),
  )
  const evidence = resolve('docs/reports/assets', `atomic-config-${evidenceDate}`)
  mkdirSync(evidence, { recursive: true })
  const contexts: BrowserContext[] = []
  let adminContext: BrowserContext | undefined
  let primaryError: unknown
  const permissions: Record<string, { list: number; create: number }> = {}
  let persistedState: Array<{
    tenantId: string
    taskType: string
    name: string
    parameters: string
    createdBy: string | null
  }> = []
  let appliedConfig = false
  let expectedConfigDeletes: number | undefined
  let cleanup: Record<string, number> | undefined
  const endpoint = '/api/console/ops/atomic-task-configs'

  async function listConfigs(request: BrowserContext['request']) {
    return request.get(endpoint, {
      params: { tenantId: fixture.tenantId, taskType: 'sql' },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
  }

  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
    fixture.prepare()
    adminContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    contexts.push(adminContext)
    await fixture.login(adminContext.request)
    await fixture.login(page.request, true)

    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/system/atomic-task-types')
    await page.getByRole('tab', { name: e2eText('atomicTaskTypeCenter.typeLabel.sql') }).click()

    const sqlInput = page
      .locator('.atc__form .el-form-item')
      .filter({ has: page.getByText('sql', { exact: true }) })
      .getByRole('textbox')
    await expect(sqlInput).toBeVisible()
    await sqlInput.fill('select 11')

    const savedConfig = page.locator('.atc__saved-config:visible')
    await savedConfig
      .locator('.atc__saved-config-form')
      .getByRole('textbox')
      .fill(fixture.tenantAdminConfigName)
    await savedConfig
      .getByRole('button', {
        name: e2eText('atomicTaskTypeCenter.savedConfigSave'),
        exact: true,
      })
      .click()

    await expect
      .poll(async () => {
        const response = await listConfigs(page.request)
        if (response.status() !== 200) return null
        const body = await response.json()
        return (body.data as Array<{ name: string }>).find(
          (item) => item.name === fixture.tenantAdminConfigName,
        )
      })
      .toBeTruthy()
    permissions.tenantAdmin = { list: 200, create: 200 }

    await sqlInput.fill('select 99')
    await savedConfig.locator('.el-select__wrapper').click()
    await page.getByRole('option', { name: fixture.tenantAdminConfigName, exact: true }).click()
    await savedConfig
      .getByRole('button', {
        name: e2eText('atomicTaskTypeCenter.savedConfigApply'),
        exact: true,
      })
      .click()
    await expect(sqlInput).toHaveValue('select 11')
    appliedConfig = true

    const tenantReadback = await listConfigs(page.request)
    expect(tenantReadback.status()).toBe(200)
    const tenantItem = (
      (await tenantReadback.json()).data as Array<{
        tenantId: string
        taskType: string
        name: string
        parameters: string
      }>
    ).find((item) => item.name === fixture.tenantAdminConfigName)
    expect(tenantItem).toMatchObject({
      tenantId: fixture.tenantId,
      taskType: 'sql',
      name: fixture.tenantAdminConfigName,
    })
    expect(JSON.parse(tenantItem!.parameters)).toEqual({ sql: 'select 11' })

    const adminCreate = await fixture.mutate(adminContext.request, endpoint, {
      tenantId: fixture.tenantId,
      taskType: 'sql',
      name: fixture.adminConfigName,
      parameters: { sql: 'select 22' },
    })
    expect(adminCreate.status()).toBe(200)
    const adminReadback = await listConfigs(adminContext.request)
    expect(adminReadback.status()).toBe(200)
    const adminItem = ((await adminReadback.json()).data as Array<{ name: string }>).find(
      (item) => item.name === fixture.adminConfigName,
    )
    expect(adminItem).toBeTruthy()
    permissions.admin = { list: 200, create: adminCreate.status() }

    for (const role of ['auditor', 'tenantUser'] as const) {
      const context = await browser.newContext({
        baseURL: String(testInfo.project.use.baseURL),
        serviceWorkers: 'block',
      })
      contexts.push(context)
      const username = role === 'auditor' ? fixture.auditorName : fixture.userName
      const login = await context.request.post('/api/console/auth/login', {
        headers: { 'X-Tenant-Id': fixture.tenantId },
        data: { username, password: fixture.password },
      })
      expect(login.status()).toBe(200)
      expect((await context.request.get('/api/console/auth/check')).status()).toBe(204)
      const list = await listConfigs(context.request)
      const create = await fixture.mutate(context.request, endpoint, {
        tenantId: fixture.tenantId,
        taskType: 'sql',
        name: role === 'auditor' ? fixture.auditorConfigName : fixture.userConfigName,
        parameters: { sql: 'select 33' },
      })
      expect(list.status(), `${role} list must be forbidden`).toBe(403)
      expect(create.status(), `${role} create must be forbidden`).toBe(403)
      permissions[role] = { list: list.status(), create: create.status() }
      await fixture.mutate(context.request, '/api/console/auth/logout', {})
    }

    persistedState = fixture.savedConfigState()
    expect(persistedState).toHaveLength(2)
    expect(persistedState.map((row) => row.name).sort()).toEqual(
      [fixture.adminConfigName, fixture.tenantAdminConfigName].sort(),
    )
    expect(persistedState.every((row) => row.tenantId === fixture.tenantId)).toBe(true)
    expect(persistedState.map((row) => [row.name, JSON.parse(row.parameters)])).toEqual(
      expect.arrayContaining([
        [fixture.tenantAdminConfigName, { sql: 'select 11' }],
        [fixture.adminConfigName, { sql: 'select 22' }],
      ]),
    )
    expectedConfigDeletes = persistedState.length

    await page.reload()
    await page.getByRole('tab', { name: e2eText('atomicTaskTypeCenter.typeLabel.sql') }).click()
    await savedConfig.locator('.el-select__wrapper').click()
    await expect(
      page.getByRole('option', { name: fixture.tenantAdminConfigName, exact: true }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await page.screenshot({ path: resolve(evidence, 'saved-config-applied.png'), fullPage: true })
  } catch (error) {
    primaryError = error
  } finally {
    try {
      cleanup = await fixture.finish(adminContext?.request ?? page.request, page.request)
      expect(cleanup.atomicConfigRowsRemaining, '本例Atomic配置残留必须为0').toBe(0)
      if (expectedConfigDeletes !== undefined)
        expect(cleanup.atomicConfigDeleted, '本例Atomic配置必须由精确清理删除').toBe(
          expectedConfigDeletes,
        )
    } catch (cleanupError) {
      if (primaryError)
        primaryError = new AggregateError(
          [primaryError, cleanupError],
          'Atomic saved-config scenario and cleanup failed',
        )
      else primaryError = cleanupError
    } finally {
      for (const context of contexts) await context.close()
    }
    writeFileSync(
      resolve(evidence, 'real-evidence.json'),
      JSON.stringify(
        {
          anonymousAuthStatus: 401,
          permissions,
          appliedConfig,
          persistedState: persistedState.map((row) => ({
            taskType: row.taskType,
            parameters: JSON.parse(row.parameters),
          })),
          tenantScopeVerified:
            persistedState.length === 2 &&
            persistedState.every((row) => row.tenantId === fixture.tenantId),
          cleanup,
          cleanupAllZero:
            cleanup !== undefined &&
            cleanup.atomicConfigRowsRemaining === 0 &&
            cleanup.credentialAccounts === 0 &&
            Object.entries(cleanup).every(([key, value]) => key.endsWith('Deleted') || value === 0),
        },
        null,
        2,
      ),
    )
  }
  if (primaryError) throw primaryError
})
