import { test, expect } from './support/fixtures'
import { seedBrowserStorage } from './support/storage'
import { installE2eLocale, e2eText } from './support/i18n'

test.use({ storageState: { cookies: [], origins: [] } })
// 夹具证明页面渲染/推送与日期隔离；不代替真实后端调度验收。
test('daily progress keeps five scopes and incomplete plan denominators visible', async ({
  page,
}) => {
  await installE2eLocale(page)
  await seedBrowserStorage(page, { session: '1', tenantId: 'daily-fixture', onboardingDone: '1' })
  const observedDates: string[] = []
  const missingScopeWarnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' && /dailyProgress\.undefined/.test(message.text()))
      missingScopeWarnings.push(message.text())
  })
  await page.route('**/api/console/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    let data: unknown = { items: [], total: 0, pageNo: 1, pageSize: 15 }
    if (path.endsWith('/auth/me'))
      data = {
        username: 'daily-fixture',
        tenantId: 'daily-fixture',
        authorities: ['ROLE_TENANT_ADMIN'],
        mustChangePassword: false,
      }
    if (path.endsWith('/stream/ticket')) data = { ticket: 'fixture-ticket' }
    if (path.endsWith('/ops/summary'))
      data = { pendingApprovals: 0, openAlerts: 0, runningJobs: 2, failedJobs: 1 }
    if (path.includes('/dashboard/daily-progress')) {
      const date = url.searchParams.get('bizDate')!
      observedDates.push(date)
      const nextDay = date === '2040-04-06'
      const snapshot = {
        tenantId: 'daily-fixture',
        bizDate: date,
        generatedAt: new Date().toISOString(),
        coverage: { scheduledDefinitions: 2, uncoveredDefinitions: nextDay ? 0 : 1 },
        counts: [
          { scope: 'SCHEDULED_OCCURRENCE', status: 'RUN_SUCCESS', count: 3 },
          { scope: 'WORKFLOW_RUN', status: 'SUCCESS', count: nextDay ? 8 : 2 },
          { scope: 'WORKFLOW_RUN', status: 'FAILED', count: 1 },
          { scope: 'JOB_TASK', status: 'RUNNING', count: 20 },
        ],
      }
      if (path.endsWith('/events')) {
        const pushed = {
          ...snapshot,
          counts: snapshot.counts.map((count) =>
            count.scope === 'JOB_TASK' ? { ...count, status: 'SUCCESS' } : count,
          ),
        }
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `event: ready\ndata: {}\n\nevent: daily-progress\ndata: ${JSON.stringify({ data: pushed })}\n\n`,
        })
        return
      }
      data = snapshot
    }
    await route.fulfill({ json: { code: 'SUCCESS', message: 'ok', data } })
  })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/ops/summary')
  const panel = page.locator('.section-card').filter({ hasText: e2eText('dailyProgress.title') })
  await expect(panel.locator('.el-table__row')).toHaveCount(5, { timeout: 30_000 })
  const tableViewport = panel.getByRole('region', { name: e2eText('dailyProgress.tableCaption') })
  await expect(tableViewport).toBeVisible()
  await expect
    .poll(() => tableViewport.evaluate((element) => element.scrollWidth > element.clientWidth))
    .toBe(true)
  const plan = panel
    .locator('.el-table__row')
    .filter({ hasText: e2eText('dailyProgress.SCHEDULED_OCCURRENCE') })
  await expect(plan).toContainText(e2eText('dailyProgress.unknown'))
  const tasks = panel
    .locator('.el-table__row')
    .filter({ hasText: e2eText('dailyProgress.JOB_TASK') })
  await expect(tasks).toContainText('100%')
  await expect(tasks.locator('td').nth(3)).toHaveText('20')
  const tourClose = page.locator('.driver-popover-close-btn')
  if (await tourClose.isVisible()) await tourClose.click()
  await expect(panel.locator('canvas').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/tenant-daily-progress-desktop.png', fullPage: true })
  await assertLastColumnCanBeReached(tableViewport)
  const dateInput = panel.locator('#daily-progress-date')
  await dateInput.fill('2040-04-06')
  await dateInput.press('Enter')
  await dateInput.blur()
  await expect.poll(() => observedDates.includes('2040-04-06')).toBe(true)
  const workflow = panel
    .locator('.el-table__row')
    .filter({ hasText: e2eText('dailyProgress.WORKFLOW_RUN') })
  await expect(workflow.locator('td').nth(1)).toHaveText('9')
  await expect(plan).toContainText('100%')
  await page.setViewportSize({ width: 768, height: 1000 })
  if (await tourClose.isVisible()) {
    await tourClose.evaluate((element) => (element as HTMLButtonElement).click())
  }
  await expect(panel.locator('.el-table__row')).toHaveCount(5)
  await page.screenshot({ path: 'test-results/tenant-daily-progress-narrow.png', fullPage: true })
  await assertLastColumnCanBeReached(tableViewport)
  await tableViewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  await page.screenshot({
    path: 'test-results/tenant-daily-progress-last-columns.png',
    fullPage: true,
  })
  expect(missingScopeWarnings).toEqual([])
})

async function assertLastColumnCanBeReached(
  viewport: import('@playwright/test').Locator,
): Promise<void> {
  await viewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  const lastColumnVisible = await viewport.evaluate((element) => {
    const lastColumn = element.querySelector('th:last-child')?.getBoundingClientRect()
    const viewportBounds = element.getBoundingClientRect()
    return lastColumn != null && lastColumn.right <= viewportBounds.right + 1
  })
  expect(lastColumnVisible).toBe(true)
  await viewport.evaluate((element) => {
    element.scrollLeft = 0
  })
}
