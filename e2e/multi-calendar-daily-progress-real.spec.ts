import { request as requestFactory } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { MultiCalendarProgressFixture } from './fixtures/runtime-progress/multiCalendarProgressFixture'
import type { DailyProgress } from '@/api/dailyProgress'

const enabled = process.env.E2E_MULTI_CALENDAR_PROGRESS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns identities and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(360_000)
test.skip(!enabled, 'Requires isolated authenticated WDI services with Quartz enabled')

test('多定义双日历CRON及FIXED_RATE按业务日统计并推送，缺覆盖不显示完整比例', async ({
  page,
}, testInfo) => {
  const fixture = new MultiCalendarProgressFixture()
  const reader = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  const snapshots: DailyProgress[] = []
  const dailyGets: string[] = []
  let prepared = false
  let primaryError: unknown
  try {
    fixture.prepare()
    prepared = true
    expect(fixture.configureCurrentBusinessCalendar()).toEqual({ updatedRows: 1 })
    fixture.prepareSecondCalendar()
    await fixture.login(page.request)
    await fixture.login(reader, true)
    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.setViewportSize({ width: 1600, height: 1200 })
    await page.exposeFunction('captureMixedDailyProgress', (data: DailyProgress) =>
      snapshots.push(data),
    )
    await page.addInitScript(() => {
      const Native = window.EventSource
      window.EventSource = class extends Native {
        constructor(url: string | URL, options?: EventSourceInit) {
          super(url, options)
          this.addEventListener('daily-progress', (event) => {
            void (
              window as unknown as { captureMixedDailyProgress: (data: unknown) => Promise<void> }
            ).captureMixedDailyProgress(JSON.parse((event as MessageEvent).data).data)
          })
        }
      }
    })
    const target = new Date(Date.now() + 120_000)
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(target)
    const part = (key: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === key)!.value)
    const cron = `${part('second')} ${part('minute')} ${part('hour')} ${part('day')} ${part('month')} ?`
    const definitions = [
      { code: fixture.codes[0], type: 'CRON', expression: cron, calendar: fixture.calendarCode },
      {
        code: fixture.codes[1],
        type: 'CRON',
        expression: cron,
        calendar: fixture.secondCalendarCode,
      },
      {
        code: `${fixture.tenantId}-C`,
        type: 'FIXED_RATE',
        expression: '86400',
        calendar: fixture.secondCalendarCode,
      },
    ]
    const savedIds: number[] = []
    for (const definition of definitions) {
      const response = await fixture.mutate(page.request, '/api/console/workflow-definitions', {
        tenantId: fixture.tenantId,
        workflowCode: definition.code,
        workflowName: `Mixed daily progress ${definition.type}`,
        workflowType: 'DAG',
        enabled: true,
        scheduleType: definition.type,
        scheduleExpr: definition.expression,
        timezone: 'Asia/Shanghai',
        triggerMode: 'SCHEDULED',
        calendarCode: definition.calendar,
        nodes: [
          { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
          { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 1, enabled: true },
        ],
        edges: [{ fromNodeCode: 'START', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true }],
      })
      expect(response.status(), await response.text()).toBe(200)
      const id = Number((await response.json()).data.id)
      savedIds.push(id)
      fixture.rememberScheduledWorkflow(id)
      const enabledResponse = await fixture.mutate(
        page.request,
        `/api/console/workflow-definitions/${id}/schedule-enabled`,
        { tenantId: fixture.tenantId, enabled: true },
        'PATCH',
      )
      expect(enabledResponse.status(), await enabledResponse.text()).toBe(200)
    }
    await expect
      .poll(() => fixture.multiCalendarState().coverage.length, { timeout: 90_000 })
      .toBe(3)
    await expect
      .poll(
        () =>
          fixture.multiCalendarState().occurrences.filter((row) => row.workflowId === savedIds[0])
            .length,
        { timeout: 90_000 },
      )
      .toBe(1)
    const planned = fixture.multiCalendarState()
    const bizDate = planned.occurrences.find((row) => row.workflowId === savedIds[0])!.bizDate
    expect(
      planned.occurrences
        .filter((row) => savedIds.slice(0, 2).includes(row.workflowId))
        .map((row) => row.status),
    ).toEqual(['PLANNED', 'PLANNED'])
    const query = (date: string) => ({
      params: { tenantId: fixture.tenantId, bizDate: date },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    const getDaily = async (date: string) => {
      const response = await reader.get('/api/console/dashboard/daily-progress', query(date))
      expect(response.status(), await response.text()).toBe(200)
      return (await response.json()).data as DailyProgress
    }
    await expect
      .poll(async () => (await getDaily(bizDate)).coverage, { timeout: 60_000 })
      .toEqual({ scheduledDefinitions: 3, uncoveredDefinitions: 0 })
    await expect
      .poll(
        () =>
          fixture
            .multiCalendarState()
            .runs.filter((row) => row.workflowId === savedIds[2] && row.status === 'SUCCESS')
            .length,
        { timeout: 45_000 },
      )
      .toBe(1)
    await page.addLocatorHandler(page.locator('.driver-popover-close-btn'), async (closeButton) => {
      await closeButton.click()
    })
    await page.goto('/ops/summary')
    const panel = page.locator('.section-card').filter({ hasText: e2eText('dailyProgress.title') })
    const dateInput = panel.locator('#daily-progress-date')
    const selectDate = async (date: string) => {
      await dateInput.fill(date)
      await dateInput.press('Enter')
      await dateInput.blur()
      await expect.poll(() => dateInput.inputValue()).toBe(date)
    }
    const row = (scope: string) =>
      panel.locator('.el-table__row').filter({ hasText: e2eText(`dailyProgress.${scope}`) })
    await selectDate(bizDate)
    await expect(panel.locator('.live-status-badge--live')).toBeVisible()
    await expect(panel.locator('.daily-progress__chart')).toBeVisible()
    await expect(row('SCHEDULED_OCCURRENCE').locator('td').nth(1)).toHaveText('3')
    await expect(row('SCHEDULED_OCCURRENCE').locator('td').nth(3)).toHaveText('1')
    await expect(row('SCHEDULED_OCCURRENCE')).toContainText('33%')
    await expect(row('WORKFLOW_RUN').locator('td').nth(1)).toHaveText('1')
    await expect(page.locator('.driver-overlay')).toHaveCount(0)
    await testInfo.attach('mixed-daily-planned.png', {
      body: await panel.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
    await expect
      .poll(
        () => fixture.multiCalendarState().runs.filter((run) => run.status === 'SUCCESS').length,
        { timeout: 180_000, intervals: [1000, 2000] },
      )
      .toBe(3)
    await expect
      .poll(
        () =>
          snapshots.some(
            (snapshot) =>
              snapshot.bizDate === bizDate &&
              snapshot.counts.some(
                (count) =>
                  count.scope === 'SCHEDULED_OCCURRENCE' &&
                  count.status === 'RUN_SUCCESS' &&
                  count.count === 3,
              ),
          ),
        { timeout: 45_000 },
      )
      .toBe(true)
    const terminal = fixture.multiCalendarState()
    expect(terminal.definitions).toHaveLength(3)
    expect(new Set(terminal.definitions.map((definition) => definition.calendarCode)).size).toBe(2)
    for (const definition of terminal.definitions) {
      expect(terminal.coverage).toContainEqual(
        expect.objectContaining({
          workflowId: definition.id,
          calendarCode: definition.calendarCode,
          scheduleVersion: definition.version,
        }),
      )
      expect(terminal.runs.filter((run) => run.workflowId === definition.id)).toHaveLength(1)
    }
    expect(terminal.requests).toHaveLength(3)
    expect(new Set(terminal.requests.map((request) => request.requestId)).size).toBe(3)
    expect(terminal.jobInstances).toBe(0)
    for (const run of terminal.runs) {
      expect(run.bizDate).toBe(bizDate)
      const request = terminal.requests.find((request) => request.id === run.triggerRequestId)!
      expect(request).toMatchObject({ workflowId: run.workflowId, bizDate })
      expect(terminal.occurrences).toContainEqual(
        expect.objectContaining({
          workflowId: run.workflowId,
          bizDate,
          requestId: request.requestId,
          status: 'REQUESTED',
        }),
      )
    }
    for (const scope of ['SCHEDULED_OCCURRENCE', 'TRIGGER_REQUEST', 'WORKFLOW_RUN']) {
      await expect(row(scope).locator('td').nth(1)).toHaveText('3')
      await expect(row(scope).locator('td').nth(2)).toHaveText('3')
      await expect(row(scope).locator('td').nth(3)).toHaveText('3')
      await expect(row(scope)).toContainText('100%')
    }
    await expect(row('JOB_INSTANCE').locator('td').nth(1)).toHaveText('0')
    await expect(row('JOB_TASK').locator('td').nth(1)).toHaveText('0')
    const current = await getDaily(bizDate)
    expect(current.coverage).toEqual({ scheduledDefinitions: 3, uncoveredDefinitions: 0 })
    await expect(page.locator('.driver-overlay')).toHaveCount(0)
    await testInfo.attach('mixed-daily-completed.png', {
      body: await panel.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
    const nextDate = new Date(`${bizDate}T12:00:00Z`)
    nextDate.setUTCDate(nextDate.getUTCDate() + 1)
    const futureDate = nextDate.toISOString().slice(0, 10)
    const future = await getDaily(futureDate)
    expect(future.coverage).toEqual({ scheduledDefinitions: 3, uncoveredDefinitions: 3 })
    expect(future.counts).toEqual([{ scope: 'SCHEDULED_OCCURRENCE', status: 'PLANNED', count: 1 }])
    expect(terminal.days.filter((day) => day.bizDate === futureDate)).toEqual([])
    await selectDate(futureDate)
    await expect(row('SCHEDULED_OCCURRENCE').locator('td').nth(1)).toHaveText('1')
    await expect(row('SCHEDULED_OCCURRENCE')).toContainText(e2eText('dailyProgress.unknown'))
    await expect(row('WORKFLOW_RUN').locator('td').nth(1)).toHaveText('0')
    await expect(panel.locator('.el-alert')).toContainText('3 / 3')
    await expect(page.locator('.driver-overlay')).toHaveCount(0)
    await testInfo.attach('mixed-daily-incomplete.png', {
      body: await panel.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
    await selectDate(bizDate)
    await expect(row('SCHEDULED_OCCURRENCE').locator('td').nth(1)).toHaveText('3')
    await expect(row('SCHEDULED_OCCURRENCE')).toContainText('100%')
    await expect(panel.locator('.el-alert')).toHaveCount(0)
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname === '/api/console/dashboard/daily-progress'
      )
        dailyGets.push(request.url())
    })
    await page.waitForTimeout(4500)
    expect(dailyGets).toEqual([])
    await testInfo.attach('multi-calendar-daily-evidence.json', {
      body: JSON.stringify({
        bizDate,
        planned,
        terminal,
        current,
        future,
        snapshots,
        periodicGets: dailyGets.length,
      }),
      contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    if (prepared)
      await testInfo.attach('multi-calendar-daily-failure.json', {
        body: JSON.stringify(fixture.multiCalendarState()),
        contentType: 'application/json',
      })
    throw error
  } finally {
    await page.goto('about:blank')
    const cleanupErrors: unknown[] = []
    if (prepared) {
      try {
        await fixture.disableScheduledWorkflow(page.request)
      } catch (error) {
        cleanupErrors.push(error)
      }
      try {
        const cleanup = await fixture.finish(page.request, reader)
        await testInfo.attach('multi-calendar-daily-cleanup.json', {
          body: JSON.stringify(cleanup),
          contentType: 'application/json',
        })
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    await reader.dispose()
    if (cleanupErrors.length)
      throw new AggregateError(
        [...(primaryError ? [primaryError] : []), ...cleanupErrors],
        '多日历日进度验收或清理失败',
      )
  }
})
