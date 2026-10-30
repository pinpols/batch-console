import { randomUUID } from 'node:crypto'
import {
  request as requestFactory,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { csrfHeaders, expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { SchedulerWaitFixture } from './fixtures/runtime-progress/schedulerWaitFixture'

const enabled = process.env.E2E_SCHEDULER_WAITS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and fixture cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(180_000)
test.skip(
  !enabled,
  'Requires an integrated WDI Console, PostgreSQL and an exclusive acceptance slot',
)

type CalendarWaitItem = Record<string, unknown> & {
  id: number
  tenantId: string
  calendarCode: string
  bizDate: string
  waitStatus: string
  manualAction?: string | null
  manualReason?: string | null
}
type JobWaitItem = Record<string, unknown> & {
  tenantId: string
  requestId: string
  jobCode: string
  bizDate: string
  waitStatus: string
}
type ListEnvelope<T> = { data?: T[] }

async function authenticate(
  context: BrowserContext,
  username: string,
  tenantId: string,
  fixture: SchedulerWaitFixture,
) {
  const response = await context.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': tenantId },
    data: { username, password: fixture.password },
  })
  expect(response.status(), `${username} must authenticate`).toBe(200)
  expect((await context.request.get('/api/console/auth/check')).status()).toBe(204)
}

async function openWaitPanel(page: Page, fixture: SchedulerWaitFixture, canRead: boolean) {
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
    return panel
  }
  await expect(panel).toBeVisible()
  await panel.getByRole('tab', { name: e2eText('dependencyWaits.calendarTab') }).click()
  await expect(panel.getByRole('cell', { name: fixture.calendarCode, exact: true })).toBeVisible()
  await expect(
    panel.getByRole('cell', { name: fixture.calendarWaitDate, exact: true }),
  ).toBeVisible()
  return panel
}

async function manualActionRequest(
  request: APIRequestContext,
  fixture: SchedulerWaitFixture,
  reason: string,
  action: 'RELEASE' | 'SKIP' = 'RELEASE',
  bizDate = fixture.calendarWaitDate,
) {
  return request.post('/api/console/calendar-dependency-waits/manual-action', {
    headers: {
      ...(await csrfHeaders(request)),
      'X-Tenant-Id': fixture.tenantId,
      'Idempotency-Key': randomUUID(),
    },
    data: {
      tenantId: fixture.tenantId,
      calendarCode: fixture.calendarCode,
      bizDate,
      action,
      reason,
    },
    failOnStatusCode: false,
  })
}

test('调度快照真实展示两类依赖等待并限制人工操作权限', async ({ browser, page }, testInfo) => {
  const fixture = new SchedulerWaitFixture()
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
    fixture.seedSchedulerWaits()

    const upstreamJobResponse = await fixture.mutate(page.request, '/api/console/job-definitions', {
      tenantId: fixture.tenantId,
      jobCode: fixture.upstreamJobCode,
      jobName: 'G02 dependency upstream acceptance',
      jobType: 'ATOMIC',
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      workerGroup: 'ATOMIC',
      timeoutSeconds: 90,
      calendarCode: fixture.calendarCode,
      paramSchema: JSON.stringify({ type: 'object', additionalProperties: true }),
      defaultParams: JSON.stringify({ taskType: 'sql', sql: 'SELECT 1' }),
      enabled: true,
    })
    expect(upstreamJobResponse.status(), await upstreamJobResponse.text()).toBe(200)

    const dependentJobResponse = await fixture.mutate(
      page.request,
      '/api/console/job-definitions',
      {
        tenantId: fixture.tenantId,
        jobCode: fixture.jobWaitCode,
        jobName: 'G02 dependency downstream acceptance',
        jobType: 'ATOMIC',
        scheduleType: 'MANUAL',
        triggerMode: 'MIXED',
        workerGroup: 'ATOMIC',
        timeoutSeconds: 90,
        calendarCode: fixture.calendarCode,
        dependsOnJobCodes: [fixture.upstreamJobCode],
        paramSchema: JSON.stringify({ type: 'object', additionalProperties: true }),
        defaultParams: JSON.stringify({ privatePayloadMarker: 'PRIVATE_JOB_WAIT_PAYLOAD' }),
        enabled: true,
      },
    )
    expect(dependentJobResponse.status(), await dependentJobResponse.text()).toBe(200)

    const createWorkflow = await fixture.mutate(page.request, '/api/console/workflow-definitions', {
      tenantId: fixture.tenantId,
      workflowCode: fixture.codes[0],
      workflowName: 'G02 job dependency wait acceptance',
      workflowType: 'DAG',
      enabled: true,
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      calendarCode: fixture.calendarCode,
      nodes: [
        { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
        {
          nodeCode: 'DEPENDENT_JOB',
          nodeName: 'Dependent job',
          nodeType: 'JOB',
          relatedJobCode: fixture.jobWaitCode,
          nodeOrder: 1,
          enabled: true,
          nodeParams: JSON.stringify({ privatePayloadMarker: 'PRIVATE_JOB_WAIT_PAYLOAD' }),
        },
        { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 2, enabled: true },
      ],
      edges: [
        { fromNodeCode: 'START', toNodeCode: 'DEPENDENT_JOB', edgeType: 'SUCCESS', enabled: true },
        { fromNodeCode: 'DEPENDENT_JOB', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true },
      ],
    })
    const workflowBody = (await createWorkflow.json()) as { data?: { id?: number }; id?: number }
    expect(createWorkflow.status(), JSON.stringify(workflowBody)).toBe(200)
    const workflowDefinitionId = Number(workflowBody.data?.id ?? workflowBody.id)
    expect(Number.isSafeInteger(workflowDefinitionId) && workflowDefinitionId > 0).toBe(true)

    const createdWorkflowRead = await page.request.get(
      `/api/console/workflow-definitions/${workflowDefinitionId}`,
      {
        params: { tenantId: fixture.tenantId },
        headers: { 'X-Tenant-Id': fixture.tenantId },
      },
    )
    expect(createdWorkflowRead.status(), await createdWorkflowRead.text()).toBe(200)

    const trigger = await fixture.mutate(
      page.request,
      `/api/console/workflow-definitions/${workflowDefinitionId}/trigger`,
      { tenantId: fixture.tenantId, bizDate: fixture.bizDate, triggerType: 'MANUAL' },
    )
    expect(trigger.status(), await trigger.text()).toBe(200)

    await expect
      .poll(() => fixture.schedulerWaitState().jobRows, {
        timeout: 45_000,
        intervals: [1000, 2000, 3000],
      })
      .toBe(1)
    const waitingState = fixture.schedulerWaitState()
    expect(waitingState.jobWaitRequestId).toBeTruthy()
    fixture.rememberJobWaitRequestId(String(waitingState.jobWaitRequestId))

    const beforeAction = fixture.schedulerWaitState()
    expect(beforeAction).toMatchObject({
      calendarRows: 1,
      calendarStatus: 'WAITING',
      manualAction: null,
      jobRows: 1,
      jobWaitStatus: 'WAITING',
      jobCode: fixture.jobWaitCode,
      triggerRequestRows: 1,
      triggerRequestStatus: 'WAITING',
      privatePayloadMarkerPresent: true,
    })

    const targetBaseUrl = String(testInfo.project.use.baseURL)
    readerContext = await browser.newContext({ baseURL: targetBaseUrl, serviceWorkers: 'block' })
    auditorContext = await browser.newContext({ baseURL: targetBaseUrl, serviceWorkers: 'block' })
    userContext = await browser.newContext({ baseURL: targetBaseUrl, serviceWorkers: 'block' })
    contexts.push(readerContext, auditorContext, userContext)
    await authenticate(readerContext, fixture.readerName, fixture.tenantId, fixture)
    await authenticate(auditorContext, fixture.auditorName, fixture.tenantId, fixture)
    await authenticate(userContext, fixture.userName, fixture.tenantId, fixture)

    const ownQuery = { tenantId: fixture.tenantId }
    const ownHeaders = { 'X-Tenant-Id': fixture.tenantId }
    const tenantAdminCalendar = await readerContext.request.get(
      '/api/console/calendar-dependency-waits',
      {
        params: {
          ...ownQuery,
          calendarCode: fixture.calendarCode,
          waitStatus: 'WAITING',
          limit: '200',
        },
        headers: ownHeaders,
      },
    )
    const tenantAdminJob = await readerContext.request.get('/api/console/job-dependency-waits', {
      params: { ...ownQuery, jobCode: fixture.jobWaitCode, waitStatus: 'WAITING' },
      headers: ownHeaders,
    })
    expect(tenantAdminCalendar.status()).toBe(200)
    expect(tenantAdminJob.status()).toBe(200)
    const tenantAdminUnfilteredJob = await readerContext.request.get(
      '/api/console/job-dependency-waits',
      { params: { ...ownQuery, waitStatus: 'WAITING', limit: '200' }, headers: ownHeaders },
    )
    expect(tenantAdminUnfilteredJob.status()).toBe(200)
    const calendarBody = (await tenantAdminCalendar.json()) as ListEnvelope<CalendarWaitItem>
    const calendarItems = calendarBody.data ?? []
    expect(calendarItems, JSON.stringify(calendarBody)).toHaveLength(1)
    expect(calendarItems[0]).toMatchObject({
      tenantId: fixture.tenantId,
      calendarCode: fixture.calendarCode,
      bizDate: fixture.calendarWaitDate,
      waitStatus: 'WAITING',
    })
    const jobBody = (await tenantAdminJob.json()) as ListEnvelope<JobWaitItem>
    const jobItems = jobBody.data ?? []
    expect(jobItems).toHaveLength(1)
    expect(jobItems[0]).toMatchObject({
      tenantId: fixture.tenantId,
      requestId: fixture.jobWaitRequestId,
      jobCode: fixture.jobWaitCode,
      bizDate: fixture.bizDate,
      waitStatus: 'WAITING',
    })
    expect(((await tenantAdminUnfilteredJob.json()) as ListEnvelope<JobWaitItem>).data).toEqual(
      expect.arrayContaining([expect.objectContaining({ requestId: fixture.jobWaitRequestId })]),
    )
    expect(JSON.stringify(jobBody)).not.toContain('PRIVATE_JOB_WAIT_PAYLOAD')
    expect(Object.keys(jobItems[0]).some((key) => /payload/i.test(key))).toBe(false)

    const panel = await openWaitPanel(page, fixture, true)
    const calendarRow = panel
      .getByRole('row')
      .filter({ hasText: fixture.calendarCode })
      .filter({ hasText: fixture.calendarWaitDate })
    const reason = `G02 real acceptance ${randomUUID()}`
    await calendarRow.getByRole('button', { name: e2eText('dependencyWaits.actions.SKIP') }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.locator('textarea').fill(reason)
    const actionResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/console/calendar-dependency-waits/manual-action') &&
        response.request().method() === 'POST',
    )
    await dialog.getByRole('button', { name: e2eText('dependencyWaits.actions.SKIP') }).click()
    const actionResponse = await actionResponsePromise
    expect(actionResponse.status()).toBe(200)
    await expect(panel.getByText(reason, { exact: true })).toBeVisible()
    const afterAction = fixture.schedulerWaitState()
    expect(afterAction).toMatchObject({
      calendarStatus: 'WAITING',
      manualAction: 'SKIP',
      manualReason: reason,
      manualOperatorPresent: true,
    })

    await panel.getByRole('tab', { name: e2eText('dependencyWaits.jobTab') }).click()
    await expect(panel.getByRole('cell', { name: fixture.jobWaitCode, exact: true })).toBeVisible()
    await expect(
      panel.getByRole('cell', { name: fixture.jobWaitRequestId, exact: true }),
    ).toBeVisible()
    await expect(page.getByText('PRIVATE_JOB_WAIT_PAYLOAD')).toHaveCount(0)

    const tenantAdminCross = await readerContext.request.get(
      '/api/console/calendar-dependency-waits',
      {
        params: { tenantId: 'system' },
        headers: ownHeaders,
        failOnStatusCode: false,
      },
    )
    const auditorCalendar = await auditorContext.request.get(
      '/api/console/calendar-dependency-waits',
      { params: ownQuery, headers: ownHeaders },
    )
    const auditorJob = await auditorContext.request.get('/api/console/job-dependency-waits', {
      params: ownQuery,
      headers: ownHeaders,
    })
    const userCalendar = await userContext.request.get('/api/console/calendar-dependency-waits', {
      params: ownQuery,
      headers: ownHeaders,
      failOnStatusCode: false,
    })
    const anonymousCalendar = await anonymous.get('/api/console/calendar-dependency-waits', {
      params: ownQuery,
      headers: ownHeaders,
      failOnStatusCode: false,
    })
    expect(tenantAdminCalendar.status()).toBe(200)
    expect(tenantAdminJob.status()).toBe(200)
    expect(tenantAdminCross.status()).toBe(403)
    expect(auditorCalendar.status()).toBe(200)
    expect(auditorJob.status()).toBe(200)
    expect(userCalendar.status()).toBe(403)
    expect(anonymousCalendar.status()).toBe(401)

    const tenantAdminAction = await manualActionRequest(
      readerContext.request,
      fixture,
      'tenant admin must not write',
    )
    const auditorAction = await manualActionRequest(
      auditorContext.request,
      fixture,
      'auditor must not write',
    )
    const tenantUserAction = await manualActionRequest(
      userContext.request,
      fixture,
      'tenant user must not write',
    )
    expect(tenantAdminAction.status()).toBe(403)
    expect(auditorAction.status()).toBe(403)
    expect(tenantUserAction.status()).toBe(403)

    const configSyncExportBody = {
      sourceTenantId: fixture.tenantId,
      sourceEnv: 'default',
      targetEnv: 'default',
    }
    const deniedConfigSyncExports = await Promise.all(
      [readerContext, auditorContext, userContext].map((context) =>
        fixture.mutate(context.request, '/api/console/config/sync/export', configSyncExportBody),
      ),
    )
    expect(deniedConfigSyncExports.map((response) => response.status())).toEqual([403, 403, 403])

    const readerPage = await readerContext.newPage()
    const readerPanel = await openWaitPanel(readerPage, fixture, true)
    await expect(
      readerPanel.getByRole('button', { name: e2eText('dependencyWaits.actions.RELEASE') }),
    ).toHaveCount(0)
    await expect(
      readerPanel.getByRole('button', { name: e2eText('dependencyWaits.actions.SKIP') }),
    ).toHaveCount(0)
    await testInfo.attach('scheduler-waits-tenant-admin.png', {
      body: await readerPage.screenshot(),
      contentType: 'image/png',
    })

    const auditorPage = await auditorContext.newPage()
    const auditorPanel = await openWaitPanel(auditorPage, fixture, true)
    await expect(
      auditorPanel.getByRole('button', { name: e2eText('dependencyWaits.actions.RELEASE') }),
    ).toHaveCount(0)
    await expect(
      auditorPanel.getByRole('button', { name: e2eText('dependencyWaits.actions.SKIP') }),
    ).toHaveCount(0)
    await testInfo.attach('scheduler-waits-auditor.png', {
      body: await auditorPage.screenshot(),
      contentType: 'image/png',
    })

    const userPage = await userContext.newPage()
    await openWaitPanel(userPage, fixture, false)
    await userPage.goto('/config/management?tab=sync')
    await expect(
      userPage.getByRole('tab', { name: e2eText('configManagement.tabSync'), exact: true }),
    ).toHaveCount(0)
    await expect(
      userPage.getByRole('tab', { name: e2eText('configManagement.tabSyncLogs'), exact: true }),
    ).toHaveCount(0)
    await testInfo.attach('scheduler-waits-admin.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await testInfo.attach('scheduler-waits-access.json', {
      body: JSON.stringify(
        {
          calendarStatus: afterAction.calendarStatus,
          calendarManualAction: afterAction.manualAction,
          operatorRecorded: afterAction.manualOperatorPresent,
          jobWaitStatus: jobItems[0].waitStatus,
          calendarPayloadExcluded: !JSON.stringify(calendarItems).includes(
            'PRIVATE_JOB_WAIT_PAYLOAD',
          ),
          jobPayloadExcluded: !JSON.stringify(jobBody).includes('PRIVATE_JOB_WAIT_PAYLOAD'),
          tenantAdminCalendarStatus: tenantAdminCalendar.status(),
          tenantAdminJobStatus: tenantAdminJob.status(),
          tenantAdminCrossTenantStatus: tenantAdminCross.status(),
          auditorCalendarStatus: auditorCalendar.status(),
          auditorJobStatus: auditorJob.status(),
          tenantUserStatus: userCalendar.status(),
          anonymousStatus: anonymousCalendar.status(),
          tenantAdminActionStatus: tenantAdminAction.status(),
          auditorActionStatus: auditorAction.status(),
          tenantUserActionStatus: tenantUserAction.status(),
          nonAdminConfigSyncExportStatuses: deniedConfigSyncExports.map((response) =>
            response.status(),
          ),
        },
        null,
        2,
      ),
      contentType: 'application/json',
    })

    await readerPage.goto('/config/management?tab=sync')
    await expect(
      readerPage.getByRole('tab', { name: e2eText('configManagement.tabSync'), exact: true }),
    ).toHaveCount(0)
    await expect(
      readerPage.getByRole('tab', { name: e2eText('configManagement.tabSyncLogs'), exact: true }),
    ).toHaveCount(0)
    await expect(readerPage).toHaveURL(/tab=logs/)

    await auditorPage.goto('/config/management?tab=syncLogs')
    await expect(
      auditorPage.getByRole('tab', { name: e2eText('configManagement.tabSync'), exact: true }),
    ).toHaveCount(0)
    await expect(
      auditorPage.getByRole('tab', { name: e2eText('configManagement.tabSyncLogs'), exact: true }),
    ).toHaveCount(0)
    await expect(auditorPage).toHaveURL(/tab=logs/)

    await page.goto('/config/management?tab=sync')
    await expect(
      page.getByRole('tab', { name: e2eText('configManagement.tabSync'), exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('tab', { name: e2eText('configManagement.tabSyncLogs'), exact: true }),
    ).toBeVisible()
    await testInfo.attach('sensitive-page-role-visibility.json', {
      body: JSON.stringify(
        {
          tenantAdminConfigSyncTabs: 'hidden',
          auditorConfigSyncTabs: 'hidden',
          adminConfigSyncTabs: 'visible',
          directRouteFallback: 'change-logs',
        },
        null,
        2,
      ),
      contentType: 'application/json',
    })

    fixture.makeCalendarSkipDue()
    await expect
      .poll(
        () => {
          const state = fixture.schedulerWaitState()
          return {
            calendarStatus: state.calendarStatus,
            batchDayRows: state.batchDayRows,
            batchDayStatus: state.batchDayStatus,
          }
        },
        { timeout: 90_000, intervals: [1000, 2000, 5000] },
      )
      .toEqual({ calendarStatus: 'SKIPPED', batchDayRows: 1, batchDayStatus: 'SKIPPED' })
    const consumedState = fixture.schedulerWaitState()
    await testInfo.attach('scheduler-waits-consumption.json', {
      body: JSON.stringify(
        {
          manualAction: consumedState.manualAction,
          manualReasonRecorded: consumedState.manualReason === reason,
          calendarWaitStatus: consumedState.calendarStatus,
          skippedBatchDayCount: consumedState.batchDayRows,
          skippedBatchDayStatus: consumedState.batchDayStatus,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    })

    fixture.seedCalendarReleaseWait()
    const releaseReason = `G02 real RELEASE acceptance ${randomUUID()}`
    const releaseAction = await manualActionRequest(
      page.request,
      fixture,
      releaseReason,
      'RELEASE',
      fixture.releaseWaitDate,
    )
    expect(releaseAction.status(), await releaseAction.text()).toBe(200)
    expect(fixture.schedulerWaitState()).toMatchObject({
      releaseCalendarStatus: 'WAITING',
      releaseManualAction: 'RELEASE',
      releaseManualReason: releaseReason,
      releaseManualOperatorPresent: true,
    })
    fixture.makeCalendarReleaseDue()
    await expect
      .poll(
        () => {
          const state = fixture.schedulerWaitState()
          return {
            waitStatus: state.releaseCalendarStatus,
            batchDayRows: state.releaseBatchDayRows,
            batchDayStatus: state.releaseBatchDayStatus,
            operationReason: state.releaseBatchOperationReason,
            operatedByPresent: state.releaseBatchOperatedByPresent,
          }
        },
        { timeout: 90_000, intervals: [1000, 2000, 5000] },
      )
      .toEqual({
        waitStatus: 'OPENED',
        batchDayRows: 1,
        batchDayStatus: 'OPEN',
        operationReason: `MANUAL_CALENDAR_DEPENDENCY_RELEASE:${releaseReason}`,
        operatedByPresent: true,
      })
    const releasedState = fixture.schedulerWaitState()
    await testInfo.attach('scheduler-waits-release-consumption.json', {
      body: JSON.stringify(
        {
          manualAction: releasedState.releaseManualAction,
          manualReasonRecorded: releasedState.releaseManualReason === releaseReason,
          operatorRecorded: releasedState.releaseManualOperatorPresent,
          calendarWaitStatus: releasedState.releaseCalendarStatus,
          openedBatchDayCount: releasedState.releaseBatchDayRows,
          openedBatchDayStatus: releasedState.releaseBatchDayStatus,
          operationReason: releasedState.releaseBatchOperationReason,
          operatedByRecorded: releasedState.releaseBatchOperatedByPresent,
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
    for (const context of [readerContext, auditorContext, userContext]) {
      if (!context) continue
      try {
        await context.request.post('/api/console/auth/logout', {
          headers: { 'X-Tenant-Id': fixture.tenantId },
        })
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    try {
      if (prepared) {
        const cleanup = await fixture.finish(page.request, readerContext?.request)
        await testInfo.attach('scheduler-waits-cleanup.json', {
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
        throw new AggregateError([primaryError, ...cleanupErrors], 'Scheduler wait cleanup failed')
      throw new AggregateError(cleanupErrors, 'Scheduler wait cleanup failed')
    }
  }
})
