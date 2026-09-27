import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

function response(data: unknown) {
  return { code: 'SUCCESS', message: 'ok', data }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('batch-console-session', '1')
    localStorage.setItem('batch-console-tenant-id', 'tc')
    localStorage.setItem('batch-console:locale', 'zh-CN')
    localStorage.setItem('batch-console-onboarding-done', '1')
  })
  await page.route('**/api/console/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const data =
      path === '/api/console/auth/me'
        ? { username: 'polish-e2e', tenantId: 'tc', authorities: ['ROLE_ADMIN'] }
        : { items: [], total: path === '/api/console/tenants' ? 1 : 0, pageNo: 1, pageSize: 15 }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response(data)),
    })
  })
})

test('opens an edit deep link outside the current job list page', async ({ page }) => {
  await page.route('**/api/console/job-definitions/42*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        response({
          id: 42,
          tenantId: 'tc',
          jobCode: 'JOB_OUTSIDE_PAGE',
          jobName: 'Deep link target',
          jobType: 'GENERAL',
          scheduleType: 'MANUAL',
          enabled: true,
        }),
      ),
    })
  })

  await page.goto('/ops/summary')
  await expect(page.getByRole('button', { name: /polish-e2e.*ADMIN/ })).toBeVisible()
  await page.goto('/jobs/definitions?action=edit&editId=42&tenantId=tc')
  await expect(page.locator('.jdd')).toBeVisible()
  await expect(page.locator('.jdd')).toContainText('JOB_OUTSIDE_PAGE')
  await expect(page).not.toHaveURL(/editId=/)
})

test('keeps governance workspace selection in sync with the URL', async ({ page }) => {
  await page.goto('/governance/queues')
  await expect(page.getByRole('button', { name: '新建队列' }).first()).toBeVisible()
  await page.locator('.governance-workspace').getByText('批次窗口').click()
  await expect(page).toHaveURL(/\/governance\/windows/)
  await expect(page.getByRole('button', { name: '新建批次窗口' }).first()).toBeVisible()
  await page.locator('.governance-workspace').getByText('业务日历').click()
  await expect(page).toHaveURL(/\/governance\/calendars/)
  await expect(page.getByRole('button', { name: '新建业务日历' }).first()).toBeVisible()
})

test('locates a pipeline run by its instance ID and shows its failed stage', async ({ page }) => {
  let stepsRequestUrl = ''
  await page.route('**/api/console/meta/pipeline-stages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        response({ IMPORT: ['RECEIVE', 'SANITIZE', 'PARSE', 'VALIDATE', 'LOAD', 'FEEDBACK'] }),
      ),
    })
  })
  await page.route('**/api/console/queries/file-pipelines*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        response({
          items: [
            {
              id: 42,
              tenantId: 'tc',
              jobCode: 'JOB_FILE',
              pipelineType: 'IMPORT',
              runStatus: 'FAILED',
              currentStage: 'PARSE',
            },
          ],
          total: 1,
          pageNo: 1,
          pageSize: 15,
        }),
      ),
    })
  })
  await page.route('**/api/console/queries/file-pipeline-steps*', async (route) => {
    stepsRequestUrl = route.request().url()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        response({
          items: [
            {
              id: 7,
              pipelineInstanceId: 42,
              stageCode: 'PARSE',
              stepCode: 'PARSE_FILE',
              stepStatus: 'FAILED',
              errorMessage: 'invalid file header',
            },
          ],
          total: 1,
          pageNo: 1,
          pageSize: 15,
        }),
      ),
    })
  })

  await page.goto('/files/pipeline-obs?pipelineInstanceId=42')
  await expect(page.locator('.pipeline-focus')).toContainText('42')
  expect(new URL(stepsRequestUrl).searchParams.get('pipelineInstanceId')).toBe('42')
  await expect(page.locator('.pipeline-stage').nth(1)).toContainText('SANITIZE')
  await expect(page.locator('.pipeline-stage--danger')).toContainText('invalid file header')
  await expect(page.locator('.pro-table__table').first()).toContainText('JOB_FILE')
  await page.locator('.pipeline-stage--danger').click()
  await expect(page.getByRole('tab', { name: '阶段明细' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.pipeline-stage--danger')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#pane-steps .pro-table__table')).toContainText('PARSE_FILE')
})

test('keeps admin governance routes unavailable to an auditor', async ({ page }) => {
  await page.route('**/api/console/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        response({ username: 'auditor-e2e', tenantId: 'tc', authorities: ['ROLE_AUDITOR'] }),
      ),
    })
  })
  await page.goto('/governance/queues')
  await expect(page).toHaveURL(/\/ops\/summary$/)
  await expect(page.getByRole('button', { name: '新建队列' })).toHaveCount(0)
})

test('filters user accounts on the server before applying pagination', async ({ page }) => {
  let usersRequestUrl = ''
  await page.route('**/api/console/users*', async (route) => {
    usersRequestUrl = route.request().url()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response({ items: [], total: 0, pageNo: 1, pageSize: 15 })),
    })
  })

  await page.goto('/system/user-accounts')
  await page.getByRole('radio', { name: '已停用' }).click()
  await expect.poll(() => new URL(usersRequestUrl).searchParams.get('enabled')).toBe('false')
  expect(new URL(usersRequestUrl).searchParams.get('pageNo')).toBe('1')
})

test('shows a retryable governance error instead of caching an empty result', async ({ page }) => {
  let requestCount = 0
  await page.route('**/api/console/queues*', async (route) => {
    requestCount += 1
    if (requestCount === 1) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        response({
          items: [
            {
              id: 12,
              tenantId: 'tc',
              queueCode: 'RECOVERED_QUEUE',
              queueName: 'Recovered queue',
              enabled: true,
            },
          ],
          total: 1,
          pageNo: 1,
          pageSize: 200,
        }),
      ),
    })
  })

  await page.goto('/governance/queues')
  await expect(page.getByText('治理配置加载失败,请重试')).toBeVisible()
  await page.locator('.governance-load-error').getByRole('button', { name: '重试' }).click()
  await expect(page.getByText('RECOVERED_QUEUE')).toBeVisible()
  expect(requestCount).toBe(2)
})

test('supports standard keyboard navigation for scheduler snapshot tabs', async ({ page }) => {
  await page.route('**/api/console/scheduler/snapshot*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        response({
          tenantId: 'tc',
          generatedAt: '2026-09-27T00:00:00Z',
          policies: [],
          queues: [],
          workers: [],
        }),
      ),
    })
  })
  await page.route('**/api/console/scheduler/snapshot/history*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response([])),
    })
  })
  await page.route('**/api/console/scheduler/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response({ status: 'RUNNING' })),
    })
  })

  await page.goto('/scheduler/snapshot')
  const policies = page.getByRole('tab', { name: /策略/ })
  const queues = page.getByRole('tab', { name: /队列/ })
  await policies.focus()
  await policies.press('ArrowRight')
  await expect(queues).toBeFocused()
  await expect(queues).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: /队列/ })).toBeVisible()
})
