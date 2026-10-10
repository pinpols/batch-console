import { STORAGE_KEYS } from './support/storage'
import { expect, test } from './support/app'

test.use({ serviceWorkers: 'block' })

function response(data: unknown) {
  return { code: 'SUCCESS', message: 'ok', data }
}

const jobs = [
  {
    id: 91001,
    tenantId: 'tc',
    jobCode: 'JOB_MONITOR_CRON_SAMPLE',
    jobName: '每日客户导入',
    jobType: 'IMPORT',
    scheduleType: 'CRON',
    scheduleExpr: '0 0 2 * * ?',
    timezone: 'Asia/Shanghai',
    enabled: true,
    softRuntimeSeconds: 1200,
    softRuntimeSeverity: 'WARN',
    startGraceSeconds: 300,
    startGraceSeverity: 'ERROR',
    completionDeadlineLocalTime: '04:00:00',
    completionDeadlineDayOffset: 0,
    completionDeadlineSeverity: 'CRITICAL',
  },
  {
    id: 91002,
    tenantId: 'tc',
    jobCode: 'JOB_MONITOR_FIXED_RATE_SAMPLE',
    jobName: '定时清理任务',
    jobType: 'GENERAL',
    scheduleType: 'FIXED_RATE',
    scheduleExpr: '300',
    timezone: 'Asia/Shanghai',
    enabled: true,
    softRuntimeSeconds: 1200,
    startGraceSeconds: 300,
  },
  {
    id: 91003,
    tenantId: 'tc',
    jobCode: 'JOB_MONITOR_MANUAL_SAMPLE',
    jobName: '手工补数任务',
    jobType: 'GENERAL',
    scheduleType: 'MANUAL',
    enabled: true,
    softRuntimeSeconds: 1200,
    startGraceSeconds: 0,
  },
  {
    id: 91004,
    tenantId: 'tc',
    jobCode: 'JOB_MONITOR_DEPENDENT_SAMPLE',
    jobName: '结算后下游汇总',
    jobType: 'PROCESS',
    scheduleType: 'MANUAL',
    dependsOnJobCode: 'UPSTREAM_SETTLE',
    timezone: 'Asia/Shanghai',
    enabled: true,
    softRuntimeSeconds: 600,
    startGraceSeconds: 300,
    dependencyCompletionWindowSeconds: 900,
  },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(STORAGE_KEYS.session, '1')
    localStorage.setItem(STORAGE_KEYS.tenantId, 'tc')
    localStorage.setItem(STORAGE_KEYS.locale, 'zh-CN')
    localStorage.setItem(STORAGE_KEYS.onboardingDone, '1')
  })
  await page.route('**/api/console/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let data: unknown
    if (path === '/api/console/auth/me') {
      data = { username: 'monitoring-e2e', tenantId: 'tc', authorities: ['ROLE_ADMIN'] }
    } else if (path === '/api/console/meta/enums') {
      data = {
        scheduleType: [
          { code: 'CRON', label: 'Cron 表达式' },
          { code: 'FIXED_RATE', label: '固定频率' },
          { code: 'MANUAL', label: '手动' },
        ],
      }
    } else if (path === '/api/console/tenants') {
      data = { items: [{ tenantId: 'tc' }], total: 1, pageNo: 1, pageSize: 1 }
    } else {
      data = { items: [], total: 0, pageNo: 1, pageSize: 15 }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response(data)),
    })
  })
})

test('shows scheduled and manual monitoring rules and filters scheduled jobs on the server', async ({
  page,
}) => {
  let queriedScheduleType: string | null = null
  await page.route('**/api/console/queries/job-definitions*', async (route) => {
    const url = new URL(route.request().url())
    queriedScheduleType = url.searchParams.get('scheduleType')
    const filteredJobs = queriedScheduleType
      ? jobs.filter((job) => job.scheduleType === queriedScheduleType)
      : jobs
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        response({ items: filteredJobs, total: filteredJobs.length, pageNo: 1, pageSize: 15 }),
      ),
    })
  })

  await page.goto('/observability/job-monitoring-policies')

  const cronRow = page.locator('tr', { hasText: 'JOB_MONITOR_CRON_SAMPLE' })
  await expect(cronRow).toContainText('Cron')
  await expect(cronRow).toContainText('20 分钟')
  await expect(cronRow).toContainText('5 分钟')
  await expect(cronRow).toContainText('计划日当日 04:00')
  await expect(cronRow).toContainText('CRITICAL')

  const fixedRateRow = page.locator('tr', { hasText: 'JOB_MONITOR_FIXED_RATE_SAMPLE' })
  await expect(fixedRateRow).toContainText('固定间隔')
  await expect(fixedRateRow).toContainText('20 分钟')
  await expect(fixedRateRow).toContainText('仅耗时监控')

  const manualRow = page.locator('tr', { hasText: 'JOB_MONITOR_MANUAL_SAMPLE' })
  await expect(manualRow).toContainText('手动')
  await expect(manualRow).toContainText('仅耗时监控')

  const dependentRow = page.locator('tr', { hasText: 'JOB_MONITOR_DEPENDENT_SAMPLE' })
  await expect(dependentRow).toContainText('手动')
  await expect(dependentRow).toContainText('10 分钟')
  await expect(dependentRow).toContainText('5 分钟')
  await expect(dependentRow).toContainText('15 分钟')

  const scheduleFilter = page.locator('.query-form .el-form-item').filter({ hasText: '调度类型' })
  await scheduleFilter.locator('.el-select').click()
  await page.locator('.el-select-dropdown:visible').getByText('Cron (CRON)', { exact: true }).click()
  await page.getByRole('button', { name: '搜索' }).click()

  await expect.poll(() => queriedScheduleType).toBe('CRON')
  await expect(cronRow).toBeVisible()
  await expect(fixedRateRow).toHaveCount(0)
  await expect(manualRow).toHaveCount(0)
  await expect(dependentRow).toHaveCount(0)
})

test('saves monitoring thresholds through the job-definition update API', async ({ page }) => {
  let updateRequest: { method: string; body: Record<string, unknown> } | undefined

  await page.route('**/api/console/queries/job-definitions*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response({ items: [jobs[0]], total: 1, pageNo: 1, pageSize: 15 })),
    })
  })
  await page.route('**/api/console/job-definitions/91001', async (route) => {
    updateRequest = {
      method: route.request().method(),
      body: route.request().postDataJSON() as Record<string, unknown>,
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response(null)),
    })
  })

  await page.goto('/observability/job-monitoring-policies')
  const cronRow = page.locator('tr', { hasText: 'JOB_MONITOR_CRON_SAMPLE' })
  await cronRow.getByRole('button').click()

  const runtimeThreshold = page.locator('.el-drawer .el-input-number input').first()
  await runtimeThreshold.fill('1800')
  await runtimeThreshold.press('Tab')
  await page.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => updateRequest?.method).toBe('PUT')
  expect(updateRequest?.body).toMatchObject({
    tenantId: 'tc',
    softRuntimeSeconds: 1800,
    startGraceSeconds: 300,
    completionDeadlineLocalTime: '04:00',
    completionDeadlineDayOffset: 0,
    completionDeadlineEnabled: true,
  })
})
