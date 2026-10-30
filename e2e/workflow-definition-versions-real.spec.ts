import { request as requestFactory, type Page, type Route } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { ControlProgressFixture } from './fixtures/runtime-progress/fixture'

const enabled = process.env.E2E_WORKFLOW_VERSIONS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and fixture cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(180_000)
test.skip(
  !enabled,
  'Requires an integrated WDI Console, PostgreSQL and an exclusive acceptance slot',
)

type WorkflowEnvelope = {
  data?: {
    id?: number
    version?: number
  }
  id?: number
  version?: number
}

type WorkflowVersionListEnvelope = {
  data?: Array<{ version: number; current: boolean }>
}

function definition(fixture: ControlProgressFixture, nodeName: string) {
  return {
    tenantId: fixture.tenantId,
    workflowCode: fixture.codes[0],
    workflowName: 'Workflow version snapshot acceptance',
    workflowType: 'DAG',
    enabled: true,
    scheduleType: 'MANUAL',
    triggerMode: 'MIXED',
    calendarCode: fixture.calendarCode,
    nodes: [
      { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
      { nodeCode: 'END', nodeName, nodeType: 'END', nodeOrder: 1, enabled: true },
    ],
    edges: [{ fromNodeCode: 'START', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true }],
  }
}

async function switchTenant(page: Page, tenantId: string) {
  const input = page.locator('.tenant-chip--switch .el-select input')
  await input.fill(tenantId)
  const option = page
    .locator('.tenant-select-popper--header .tenant-option__id')
    .filter({ hasText: new RegExp(`^${tenantId}$`) })
  await expect(option).toBeVisible()
  await option.click()
}

test('Workflow差异页读取所选版本快照并丢弃切租户前的迟到响应', async ({ page }, testInfo) => {
  const fixture = new ControlProgressFixture()
  const reader = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  let prepared = false
  let alternateTenantPrepared = false
  const alternateTenantId = `${fixture.tenantId}-other`
  let primaryError: unknown
  let releaseHeldList: () => void = () => undefined
  let heldListDelivered: Promise<void> = Promise.resolve()

  try {
    fixture.prepare()
    prepared = true
    const alternateTenant = fixture.prepareWorkflowVersionTenant(alternateTenantId)
    alternateTenantPrepared = true
    expect(alternateTenant).toEqual({ tenantId: alternateTenantId })
    await fixture.login(page.request)
    await fixture.login(reader, true)
    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })

    const create = await fixture.mutate(
      page.request,
      '/api/console/workflow-definitions',
      definition(fixture, 'Version one'),
    )
    const createBody = (await create.json()) as WorkflowEnvelope
    expect(create.status(), JSON.stringify(createBody)).toBe(200)
    const workflowId = Number(createBody.data?.id ?? createBody.id)
    expect(Number.isSafeInteger(workflowId)).toBe(true)
    expect(Number(createBody.data?.version ?? createBody.version)).toBe(1)

    const lock = await fixture.mutate(
      page.request,
      `/api/console/workflow-definitions/${workflowId}/lock`,
      undefined,
      'PUT',
    )
    expect(lock.status(), await lock.text()).toBe(200)

    for (const version of [2, 3, 4]) {
      const update = await fixture.mutate(
        page.request,
        `/api/console/workflow-definitions/${workflowId}/full`,
        { definition: definition(fixture, `Version ${version}`), expectedVersion: version - 1 },
        'PUT',
      )
      const updateBody = (await update.json()) as WorkflowEnvelope
      expect(update.status(), JSON.stringify(updateBody)).toBe(200)
      expect(Number(updateBody.data?.version ?? updateBody.version)).toBe(version)
    }

    const snapshots = fixture
      .workflowVersionSnapshots()
      .filter((snapshot) => snapshot.workflowDefinitionId === workflowId)
    expect(snapshots.map((snapshot) => snapshot.version)).toEqual([1, 2, 3, 4])
    expect(snapshots.find((snapshot) => snapshot.version === 1)?.nodes).toContainEqual(
      expect.objectContaining({ nodeCode: 'END', nodeName: 'Version one' }),
    )
    for (const version of [2, 3, 4]) {
      expect(snapshots.find((snapshot) => snapshot.version === version)?.nodes).toContainEqual(
        expect.objectContaining({ nodeCode: 'END', nodeName: `Version ${version}` }),
      )
    }

    const listPath = `/api/console/workflow-definitions/${workflowId}/versions`
    const readerList = await reader.get(listPath, {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    expect(readerList.status(), await readerList.text()).toBe(200)
    const listedVersions = (await readerList.json()) as WorkflowVersionListEnvelope
    expect(listedVersions.data?.map((row) => row.version)).toEqual([4, 3, 2, 1])
    expect(listedVersions.data?.find((row) => row.current)?.version).toBe(4)

    const historicalRead = await reader.get(`${listPath}/2`, {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    expect(historicalRead.status(), await historicalRead.text()).toBe(200)
    const historicalBody = (await historicalRead.json()) as {
      data?: { nodes?: Array<{ nodeCode: string; nodeName: string }> }
    }
    expect(historicalBody.data?.nodes).toContainEqual(
      expect.objectContaining({ nodeCode: 'END', nodeName: 'Version 2' }),
    )

    const crossTenantList = await reader.get(listPath, {
      params: { tenantId: 'system' },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    expect(crossTenantList.status(), await crossTenantList.text()).toBe(403)

    await page.goto(`/workflow/designer/${workflowId}/diff/3/4`)
    const selectors = page.locator('.diff-page__version-select')
    await expect(selectors).toHaveCount(2)
    await expect(selectors.nth(0)).toContainText(/v3/)
    await expect(selectors.nth(1)).toContainText(/v4/)
    const endRow = page.locator('.diff-table tbody tr').filter({ hasText: 'END' })
    await expect(endRow.locator('.diff-badge')).toHaveClass(/diff-badge--modified/)

    await selectors.nth(0).click()
    await page.locator('.el-select-dropdown:visible').getByRole('option', { name: /v2/ }).click()
    await selectors.nth(1).click()
    await selectors.nth(1).locator('input').press('ArrowDown')
    await selectors.nth(1).locator('input').press('Enter')
    await page.getByRole('button', { name: e2eText('workflowDesignerPolish.diffCompare') }).click()
    await expect(selectors.nth(0)).toContainText(/v2/)
    await expect(selectors.nth(1)).toContainText(/v3/)
    await expect(page).toHaveURL(new RegExp(`/workflow/designer/${workflowId}/diff/2/3$`))
    await expect(endRow.locator('.diff-badge')).toHaveClass(/diff-badge--modified/)

    let startHeldList!: () => void
    const heldListStarted = new Promise<void>((resolve) => {
      startHeldList = resolve
    })
    let unblock!: () => void
    const hold = new Promise<void>((resolve) => {
      unblock = resolve
    })
    releaseHeldList = unblock
    heldListDelivered = new Promise<void>((resolve) => {
      const finish = resolve
      void hold.then(finish)
    })
    let held = false
    const versionListRoute = async (route: Route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (
        !held &&
        request.method() === 'GET' &&
        url.pathname === listPath &&
        url.searchParams.get('tenantId') === fixture.tenantId
      ) {
        held = true
        const response = await route.fetch()
        startHeldList()
        await hold
        await route.fulfill({ response })
        return
      }
      await route.continue()
    }
    await page.route(`**${listPath}**`, versionListRoute)
    const reload = page.reload()
    await Promise.all([reload, heldListStarted])
    const alternateTenantListResponse = page.waitForResponse((response) => {
      const requestUrl = new URL(response.url())
      return (
        requestUrl.pathname === listPath &&
        requestUrl.searchParams.get('tenantId') === alternateTenantId
      )
    })
    await switchTenant(page, alternateTenantId)
    expect((await alternateTenantListResponse).status()).toBe(404)
    await expect(page.locator('.diff-page__canvases')).toHaveCount(0)
    releaseHeldList()
    await heldListDelivered
    await reload
    await expect(page.locator('.diff-page__canvases')).toHaveCount(0)

    const fixtureTenantResponse = page.waitForResponse((response) => {
      const requestUrl = new URL(response.url())
      return (
        requestUrl.pathname === listPath &&
        requestUrl.searchParams.get('tenantId') === fixture.tenantId
      )
    })
    await switchTenant(page, fixture.tenantId)
    expect((await fixtureTenantResponse).status()).toBe(200)
    await expect(page.locator('.diff-page__canvases')).toBeVisible()
    await expect(selectors.nth(0)).toContainText(/v2/)
    await expect(selectors.nth(1)).toContainText(/v3/)
    await page.unroute(`**${listPath}**`, versionListRoute)

    await testInfo.attach('workflow-definition-versions.json', {
      body: JSON.stringify(
        {
          versionRows: listedVersions.data,
          persistedSnapshots: snapshots.map((snapshot) => ({
            version: snapshot.version,
            endNodeName: snapshot.nodes.find((node) => node.nodeCode === 'END')?.nodeName,
          })),
          selectedComparison: [2, 3],
          readerOwnTenantStatus: readerList.status(),
          readerCrossTenantStatus: crossTenantList.status(),
          lateOldTenantResponseDiscarded: true,
          alternateTenant: alternateTenantId,
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
    releaseHeldList()
    await heldListDelivered
    const cleanupErrors: unknown[] = []
    try {
      if (prepared) {
        const cleanup = await fixture.finish(page.request, reader)
        await testInfo.attach('workflow-definition-versions-cleanup.json', {
          body: JSON.stringify(cleanup),
          contentType: 'application/json',
        })
      }
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError)
    }
    try {
      if (alternateTenantPrepared) {
        const cleanup = fixture.cleanupWorkflowVersionTenant(alternateTenantId)
        expect(cleanup.tenantRowsRemaining, '辅助租户必须精确清零').toBe(0)
        await testInfo.attach('workflow-definition-versions-alternate-tenant-cleanup.json', {
          body: JSON.stringify(cleanup),
          contentType: 'application/json',
        })
      }
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError)
    } finally {
      try {
        await reader.dispose()
      } catch (disposeError) {
        cleanupErrors.push(disposeError)
      }
    }
    if (cleanupErrors.length > 0) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, ...cleanupErrors],
          'Workflow version acceptance cleanup failed',
        )
      throw new AggregateError(cleanupErrors, 'Workflow version acceptance cleanup failed')
    }
  }
})
