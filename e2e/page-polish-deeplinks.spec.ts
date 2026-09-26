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
  await expect(page.locator('.pipeline-stage--danger')).toContainText('invalid file header')
  await expect(page.locator('.pro-table__table').first()).toContainText('JOB_FILE')
  await page.locator('.pipeline-stage--danger').click()
  await expect(page.getByRole('tab', { name: '阶段明细' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.pipeline-stage--danger')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#pane-steps .pro-table__table')).toContainText('PARSE_FILE')
})
