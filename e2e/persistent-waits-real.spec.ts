import { request as requestFactory, type BrowserContext, type Page } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { PersistentWaitFixture } from './fixtures/runtime-progress/fixture'

const enabled = process.env.E2E_PERSISTENT_WAITS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and fixture cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(180_000)
test.skip(
  !enabled,
  'Requires an integrated WDI Console, PostgreSQL and an exclusive acceptance slot',
)

type WorkflowEnvelope = { data?: { id?: number }; id?: number }
type WaitItem = Record<string, unknown> & {
  id: number
  waitType: string
  waitStatus: string
  workflowCode: string
}
type WaitPageEnvelope = {
  data?: { items?: WaitItem[]; pageNo?: number; pageSize?: number; total?: number }
}

function workflowDefinition(fixture: PersistentWaitFixture) {
  return {
    tenantId: fixture.tenantId,
    workflowCode: `${fixture.tenantId}-WAIT`,
    workflowName: 'Persistent wait read acceptance',
    workflowType: 'DAG',
    enabled: true,
    scheduleType: 'MANUAL',
    triggerMode: 'MIXED',
    calendarCode: fixture.calendarCode,
    nodes: [
      { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
      { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 1, enabled: true },
    ],
    edges: [{ fromNodeCode: 'START', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true }],
  }
}

async function authenticate(
  context: BrowserContext,
  username: string,
  tenantId: string,
  fixture: PersistentWaitFixture,
) {
  const response = await context.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': tenantId },
    data: { username, password: fixture.password },
  })
  expect(response.status(), `${username} must authenticate`).toBe(200)
  expect((await context.request.get('/api/console/auth/check')).status()).toBe(204)
}

async function openWaitPanel(page: Page, fixture: PersistentWaitFixture, canRead: boolean) {
  await installE2eLocale(page)
  await seedBrowserStorage(page, {
    session: '1',
    tenantId: fixture.tenantId,
    onboardingDone: '1',
  })
  await page.goto('/scheduler/snapshot')
  const panel = page.locator('[data-testid="dependency-waits-panel"]')
  if (!canRead) {
    await expect(panel).toHaveCount(0)
    return
  }
  await expect(panel).toBeVisible()
  await panel.getByRole('tab', { name: e2eText('dependencyWaits.persistentTab') }).click()
  await expect(panel.getByRole('cell', { name: fixture.workflowCode, exact: true })).toHaveCount(2)
  await expect(page.getByText('upstream-a,upstream-b', { exact: true })).toBeVisible()
  await expect(page.getByText('PERSISTENT_WAIT_PRIVATE_PAYLOAD')).toHaveCount(0)
}

test('持久等待查询从真实PostgreSQL投影到调度快照并遵守角色边界', async ({
  browser,
  page,
}, testInfo) => {
  const fixture = new PersistentWaitFixture()
  const contexts: BrowserContext[] = []
  const anonymous = await requestFactory.newContext({
    baseURL: String(testInfo.project.use.baseURL),
  })
  let readerContext: BrowserContext | undefined
  let auditorContext: BrowserContext | undefined
  let userContext: BrowserContext | undefined
  let prepared = false
  let primaryError: unknown

  try {
    fixture.prepare()
    prepared = true
    fixture.prepareWaitRoles()
    await fixture.login(page.request)

    const workflow = workflowDefinition(fixture)
    const create = await fixture.mutate(page.request, '/api/console/workflow-definitions', workflow)
    const createBody = (await create.json()) as WorkflowEnvelope
    expect(create.status(), JSON.stringify(createBody)).toBe(200)
    const workflowId = Number(createBody.data?.id ?? createBody.id)
    expect(Number.isSafeInteger(workflowId)).toBe(true)
    fixture.seedWaits(workflowId, workflow.workflowCode)

    const databaseState = fixture.persistentWaitState()
    expect(databaseState).toEqual({
      readinessCount: 1,
      capacityCount: 1,
      workflowCode: workflow.workflowCode,
      privatePayloadMarkerPresent: true,
    })

    const adminResponse = await page.request.get('/api/console/ops/persistent-waits', {
      params: { tenantId: fixture.tenantId, pageNo: '1', pageSize: '15' },
      headers: { 'X-Tenant-Id': 'system' },
    })
    expect(adminResponse.status()).toBe(200)
    const adminBody = (await adminResponse.json()) as WaitPageEnvelope
    const items = adminBody.data?.items ?? []
    expect(adminBody.data).toMatchObject({ pageNo: 1, pageSize: 15, total: 2 })
    expect(items.map((item) => [item.waitType, item.waitStatus])).toEqual([
      ['CAPACITY_ADMISSION', 'WAITING'],
      ['READINESS', 'PENDING'],
    ])
    expect(items.map((item) => item.workflowCode)).toEqual([
      workflow.workflowCode,
      workflow.workflowCode,
    ])
    expect(JSON.stringify(adminBody)).not.toContain('PERSISTENT_WAIT_PRIVATE_PAYLOAD')
    for (const item of items)
      expect(Object.keys(item).some((key) => /payload/i.test(key))).toBe(false)

    const readinessFilter = await page.request.get('/api/console/ops/persistent-waits', {
      params: { tenantId: fixture.tenantId, waitType: 'READINESS', waitStatus: 'PENDING' },
      headers: { 'X-Tenant-Id': 'system' },
    })
    expect(readinessFilter.status()).toBe(200)
    expect(
      ((await readinessFilter.json()) as WaitPageEnvelope).data?.items?.map(
        (item) => item.waitType,
      ),
    ).toEqual(['READINESS'])

    const firstPage = await page.request.get('/api/console/ops/persistent-waits', {
      params: { tenantId: fixture.tenantId, pageNo: '1', pageSize: '1' },
      headers: { 'X-Tenant-Id': 'system' },
    })
    const secondPage = await page.request.get('/api/console/ops/persistent-waits', {
      params: { tenantId: fixture.tenantId, pageNo: '2', pageSize: '1' },
      headers: { 'X-Tenant-Id': 'system' },
    })
    expect(firstPage.status()).toBe(200)
    expect(secondPage.status()).toBe(200)
    const firstPageBody = (await firstPage.json()) as WaitPageEnvelope
    const secondPageBody = (await secondPage.json()) as WaitPageEnvelope
    expect(firstPageBody.data?.total).toBe(2)
    const firstPageItem = firstPageBody.data?.items?.[0]
    const secondPageItem = secondPageBody.data?.items?.[0]
    expect(firstPageItem).toBeDefined()
    expect(secondPageItem).toBeDefined()
    expect(`${firstPageItem?.waitType}:${firstPageItem?.id}`).not.toBe(
      `${secondPageItem?.waitType}:${secondPageItem?.id}`,
    )

    const targetBaseUrl = String(testInfo.project.use.baseURL)
    readerContext = await browser.newContext({ baseURL: targetBaseUrl, serviceWorkers: 'block' })
    auditorContext = await browser.newContext({ baseURL: targetBaseUrl, serviceWorkers: 'block' })
    userContext = await browser.newContext({ baseURL: targetBaseUrl, serviceWorkers: 'block' })
    contexts.push(readerContext, auditorContext, userContext)
    await authenticate(readerContext, fixture.readerName, fixture.tenantId, fixture)
    await authenticate(auditorContext, fixture.auditorName, fixture.tenantId, fixture)
    await authenticate(userContext, fixture.userName, fixture.tenantId, fixture)

    const readerOwn = await readerContext.request.get('/api/console/ops/persistent-waits', {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    const readerCross = await readerContext.request.get('/api/console/ops/persistent-waits', {
      params: { tenantId: 'system' },
      headers: { 'X-Tenant-Id': fixture.tenantId },
      failOnStatusCode: false,
    })
    const auditorOwn = await auditorContext.request.get('/api/console/ops/persistent-waits', {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    const auditorCross = await auditorContext.request.get('/api/console/ops/persistent-waits', {
      params: { tenantId: 'system' },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    const userOwn = await userContext.request.get('/api/console/ops/persistent-waits', {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
      failOnStatusCode: false,
    })
    const anonymousOwn = await anonymous.get('/api/console/ops/persistent-waits', {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
      failOnStatusCode: false,
    })
    expect(readerOwn.status()).toBe(200)
    expect(readerCross.status()).toBe(403)
    expect(auditorOwn.status()).toBe(200)
    expect(auditorCross.status()).toBe(200)
    expect(userOwn.status()).toBe(403)
    expect(anonymousOwn.status()).toBe(401)

    await openWaitPanel(page, fixture, true)
    await testInfo.attach('persistent-waits-admin.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    const readerPage = await readerContext.newPage()
    await openWaitPanel(readerPage, fixture, true)
    await testInfo.attach('persistent-waits-tenant-admin.png', {
      body: await readerPage.screenshot(),
      contentType: 'image/png',
    })
    const auditorPage = await auditorContext.newPage()
    await openWaitPanel(auditorPage, fixture, true)
    await testInfo.attach('persistent-waits-auditor.png', {
      body: await auditorPage.screenshot(),
      contentType: 'image/png',
    })
    const userPage = await userContext.newPage()
    await openWaitPanel(userPage, fixture, false)

    await testInfo.attach('persistent-waits-access.json', {
      body: JSON.stringify(
        {
          waitTypes: items.map((item) => item.waitType),
          waitStatuses: items.map((item) => item.waitStatus),
          tenantAdminOwnStatus: readerOwn.status(),
          tenantAdminCrossTenantStatus: readerCross.status(),
          auditorOwnStatus: auditorOwn.status(),
          auditorCrossTenantStatus: auditorCross.status(),
          tenantUserStatus: userOwn.status(),
          anonymousStatus: anonymousOwn.status(),
          capacityPayloadMarkerPersisted: databaseState.privatePayloadMarkerPresent,
          capacityPayloadExcludedFromConsole: !JSON.stringify(adminBody).includes(
            'PERSISTENT_WAIT_PRIVATE_PAYLOAD',
          ),
        },
        null,
        2,
      ),
      contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    const cleanupErrors: unknown[] = []
    for (const context of [auditorContext, userContext]) {
      if (!context) continue
      try {
        await fixture.mutate(context.request, '/api/console/auth/logout', {})
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    try {
      if (prepared) {
        const cleanup = await fixture.finish(page.request, readerContext?.request)
        await testInfo.attach('persistent-waits-cleanup.json', {
          body: JSON.stringify(cleanup),
          contentType: 'application/json',
        })
      }
    } catch (error) {
      cleanupErrors.push(error)
    }
    for (const context of contexts) {
      try {
        await context.close()
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    try {
      await anonymous.dispose()
    } catch (error) {
      cleanupErrors.push(error)
    }
    if (cleanupErrors.length > 0) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, ...cleanupErrors],
          'Persistent wait acceptance cleanup failed',
        )
      throw new AggregateError(cleanupErrors, 'Persistent wait acceptance cleanup failed')
    }
  }
})
