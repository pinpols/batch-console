import { request as requestFactory } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { QuartzDailyProgressFixture } from './fixtures/runtime-progress/fixture'

type DailyProgress = {
  tenantId?: string
  bizDate?: string
  counts?: Array<{ scope: string; status: string; count: number }>
  coverage?: { scheduledDefinitions: number; uncoveredDefinitions: number }
}
type PushedDailyProgress = { kind: 'daily'; data: DailyProgress }
const enabled = process.env.E2E_QUARTZ_PROGRESS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(240_000)
test.skip(
  !enabled,
  'Requires Trigger Quartz, integrated WDI services, enforced authentication and an exclusive acceptance slot',
)

test('真实 Quartz 计划、定时Workflow与租户当日进度经全快照推送闭环', async ({ page }, testInfo) => {
  const fixture = new QuartzDailyProgressFixture()
  const reader = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  const pushed: PushedDailyProgress[] = []
  let primaryError: unknown
  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
    fixture.prepare()
    expect(fixture.configureCurrentBusinessCalendar().updatedRows).toBe(1)
    await fixture.login(page.request)
    await fixture.login(reader, true)
    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.exposeFunction('recordDailyProgressSnapshot', (data: unknown) => {
      if (data && typeof data === 'object')
        pushed.push({ kind: 'daily', data: data as DailyProgress })
    })
    await page.addInitScript(() => {
      const NativeEventSource = window.EventSource
      window.EventSource = class extends NativeEventSource {
        constructor(url: string | URL, options?: EventSourceInit) {
          super(url, options)
          this.addEventListener('daily-progress', (event) => {
            try {
              const payload = JSON.parse((event as MessageEvent).data)
              const data =
                payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
              void (
                window as unknown as {
                  recordDailyProgressSnapshot: (value: unknown) => Promise<void>
                }
              ).recordDailyProgressSnapshot(data)
            } catch {
              // 忽略协议外消息；页面自身仍负责校验推送快照。
            }
          })
        }
      }
    })

    const target = new Date(Date.now() + 90_000)
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
    const part = (type: Intl.DateTimeFormatPartTypes) => {
      const value = parts.find((item) => item.type === type)?.value
      if (!value) throw new Error(`缺少 Quartz 计划时间字段: ${type}`)
      return Number(value)
    }
    const scheduleExpr = `${part('second')} ${part('minute')} ${part('hour')} ${part('day')} ${part('month')} ?`
    const create = await fixture.mutate(page.request, '/api/console/workflow-definitions', {
      tenantId: fixture.tenantId,
      workflowCode: fixture.codes[0],
      workflowName: 'Quartz daily progress acceptance',
      workflowType: 'DAG',
      enabled: true,
      scheduleType: 'CRON',
      scheduleExpr,
      timezone: 'Asia/Shanghai',
      triggerMode: 'SCHEDULED',
      calendarCode: fixture.calendarCode,
      nodes: [
        { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
        { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 1, enabled: true },
      ],
      edges: [{ fromNodeCode: 'START', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true }],
    })
    expect(create.status()).toBe(200)
    const created = fixture
      .state()
      .definitions.find((definition) => definition.workflowCode === fixture.codes[0])
    expect(created?.id).toBeGreaterThan(0)
    fixture.rememberScheduledWorkflow(created!.id)
    expect(
      (
        await fixture.mutate(
          page.request,
          `/api/console/workflow-definitions/${created!.id}/schedule-enabled`,
          { tenantId: fixture.tenantId, enabled: true },
          'PATCH',
        )
      ).status(),
    ).toBe(200)

    await expect
      .poll(() => fixture.quartzProgressState().occurrences.length, {
        timeout: 90_000,
        intervals: [1000, 2000, 3000],
      })
      .toBe(1)
    const planned = fixture.quartzProgressState()
    expect(planned.occurrences[0]?.status).toBe('PLANNED')
    expect(planned.definitionVersion).toBe(planned.coverage?.scheduleVersion)
    expect(planned.coverage).not.toBeNull()
    const bizDate = planned.occurrences[0]?.bizDate
    expect(bizDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const dailyGets: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname === '/api/console/dashboard/daily-progress'
      )
        dailyGets.push('daily')
    })
    await page.goto('/ops/summary')
    const tourClose = page.locator('.driver-popover-close-btn')
    if (await tourClose.isVisible().catch(() => false)) await tourClose.click()
    const panel = page.locator('.section-card').filter({ hasText: e2eText('dailyProgress.title') })
    const date = panel.locator('#daily-progress-date')
    await expect(date).toBeVisible()
    await date.fill(bizDate!)
    await date.press('Enter')
    await date.blur()
    await expect(panel.locator('.daily-progress__chart')).toBeVisible()
    await expect(panel.locator('.live-status-badge--live')).toBeVisible()
    await expect.poll(() => pushed.some((snapshot) => snapshot.data.bizDate === bizDate)).toBe(true)

    const query = {
      params: { tenantId: fixture.tenantId, bizDate: bizDate! },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    }
    const initialResponse = await reader.get('/api/console/dashboard/daily-progress', query)
    expect(initialResponse.status()).toBe(200)
    const initialEnvelope = (await initialResponse.json()) as { data?: DailyProgress }
    const initial = initialEnvelope.data ?? (initialEnvelope as unknown as DailyProgress)
    expect(initial.coverage?.scheduledDefinitions).toBe(1)
    expect([0, 1]).toContain(initial.coverage?.uncoveredDefinitions)
    const initialCoverage = initial.coverage
    if (initialCoverage?.uncoveredDefinitions === 1)
      await expect(panel.locator('.el-alert')).toBeVisible()
    expect(initial.counts).toContainEqual(
      expect.objectContaining({ scope: 'SCHEDULED_OCCURRENCE', status: 'PLANNED', count: 1 }),
    )

    await expect
      .poll(
        () => fixture.state().runs.find((run) => run.workflowDefinitionId === created!.id)?.status,
        { timeout: 180_000, intervals: [1000, 2000, 3000] },
      )
      .toBe('SUCCESS')
    await expect
      .poll(
        () =>
          pushed.some(
            (snapshot) =>
              snapshot.data.bizDate === bizDate &&
              snapshot.data.coverage?.scheduledDefinitions === 1 &&
              snapshot.data.coverage.uncoveredDefinitions === 0 &&
              snapshot.data.counts?.some(
                (item) =>
                  item.scope === 'SCHEDULED_OCCURRENCE' &&
                  item.status === 'RUN_SUCCESS' &&
                  item.count === 1,
              ),
          ),
        { timeout: 60_000, intervals: [1000, 2000, 3000] },
      )
      .toBe(true)

    const scheduledRow = panel
      .locator('.el-table__row')
      .filter({ hasText: e2eText('dailyProgress.SCHEDULED_OCCURRENCE') })
    await expect(scheduledRow.locator('td').nth(1)).toHaveText('1')
    await expect(scheduledRow.locator('td').nth(2)).toHaveText('1')
    await expect(scheduledRow.locator('td').nth(3)).toHaveText('1')
    await expect(scheduledRow).toContainText('100%')
    const workflowRow = panel
      .locator('.el-table__row')
      .filter({ hasText: e2eText('dailyProgress.WORKFLOW_RUN') })
    await expect(workflowRow.locator('td').nth(1)).toHaveText('1')
    await expect(workflowRow.locator('td').nth(2)).toHaveText('1')
    await expect(workflowRow.locator('td').nth(3)).toHaveText('1')
    await expect(workflowRow).toContainText('100%')

    const persisted = fixture.quartzProgressState()
    expect(persisted.occurrences).toHaveLength(1)
    expect(persisted.occurrences[0]?.status).toBe('REQUESTED')
    const dailyResponse = await reader.get('/api/console/dashboard/daily-progress', query)
    expect(dailyResponse.status()).toBe(200)
    const dailyEnvelope = (await dailyResponse.json()) as { data?: DailyProgress }
    const daily = dailyEnvelope.data ?? (dailyEnvelope as unknown as DailyProgress)
    expect(daily.coverage).toEqual({ scheduledDefinitions: 1, uncoveredDefinitions: 0 })
    await expect(panel.locator('.el-alert')).toHaveCount(0)
    expect(daily.counts).toContainEqual(
      expect.objectContaining({ scope: 'SCHEDULED_OCCURRENCE', status: 'RUN_SUCCESS', count: 1 }),
    )
    const dailyGetsAfterPush = dailyGets.length
    await page.waitForTimeout(4500)
    expect(dailyGets.length).toBe(dailyGetsAfterPush)

    await testInfo.attach('quartz-daily-progress-evidence.json', {
      body: JSON.stringify(
        {
          plannedOccurrencesBeforeFire: planned.occurrences.length,
          scheduleVersionCovered: planned.definitionVersion === planned.coverage?.scheduleVersion,
          initialCoverage,
          dailyCoverage: daily.coverage,
          occurrenceStatusAfterRun: persisted.occurrences[0]?.status,
          workflowRunStatus: 'SUCCESS',
          pushedRunStatus: 'RUN_SUCCESS',
          periodicDailyProgressGets: dailyGets.length - dailyGetsAfterPush,
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
    try {
      await fixture.disableScheduledWorkflow(page.request)
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError)
    }
    try {
      const cleanupEvidence = await fixture.finish(page.request, reader)
      await testInfo.attach('quartz-daily-progress-cleanup.json', {
        body: JSON.stringify(cleanupEvidence, null, 2),
        contentType: 'application/json',
      })
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError)
    }
    try {
      await reader.dispose()
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError)
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [...(primaryError ? [primaryError] : []), ...cleanupErrors],
        'Quartz progress acceptance or cleanup failed',
      )
    }
  }
})
