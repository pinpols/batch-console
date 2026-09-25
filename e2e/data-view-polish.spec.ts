import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('data-heavy pages use the intended primary views', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/console/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: {
            username: 'admin',
            tenantId: 'system',
            authorities: ['ROLE_ADMIN'],
          },
        }),
      }),
    )
    await page.route('**/api/console/tenants?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: {
            items: [{ tenantId: 'ta', tenantName: 'Test tenant', status: 'ACTIVE' }],
            total: 1,
            pageNo: 1,
            pageSize: 1,
          },
        }),
      }),
    )
    await page.route('**/api/console/ops/summary*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: {
            pendingApprovals: 0,
            openAlerts: 0,
            criticalAlerts: 0,
            runningJobs: 0,
            failedJobs: 0,
            slaBreaches: 0,
            onlineWorkers: 0,
            drainingWorkers: 0,
            offlineWorkers: 0,
            outboxRetryBacklog: 0,
            outboxDeliveryFailures: 0,
          },
        }),
      }),
    )
    await enterDemoApp(page)
  })

  test('batch days defaults to calendar and keeps a detail table mode', async ({ page }) => {
    await page.goto('/scheduler/batch-days')
    await expectPageTitle(page, '批次日与窗口')
    await expect(page.getByText('日历视图', { exact: true })).toBeVisible()
    await expect(page.locator('.el-calendar')).toBeVisible()

    await page
      .getByRole('radiogroup', { name: 'segmented' })
      .getByText('明细表格', { exact: true })
      .click()
    await expect(page.getByRole('columnheader', { name: '业务日' })).toBeVisible()
  })

  test('empty batch month keeps navigation context and offers the detail view', async ({
    page,
  }) => {
    await page.route('**/api/console/queries/batch-days?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: { items: [], total: 0, pageNo: 1, pageSize: 100 },
        }),
      }),
    )
    await page.goto('/scheduler/batch-days')
    await expect(page.getByText('当前月份暂无批次数据', { exact: true })).toBeVisible()
    await expect(page.locator('.el-calendar')).toBeVisible()
    await expect(
      page.locator('.batch-calendar__empty').getByRole('button', { name: '明细表格' }),
    ).toBeVisible()
  })

  test('event catalog defaults to master-detail and exposes dense mode', async ({ page }) => {
    await page.goto('/system/event-catalog')
    await expectPageTitle(page, '事件目录')
    await expect(page.getByText('目录视图', { exact: true })).toBeVisible()
    await expect(page.locator('.catalog-workbench')).toBeVisible()

    await page.getByText('密集表格', { exact: true }).click()
    await expect(page.getByRole('columnheader', { name: '事件类型' })).toBeVisible()
  })

  test('event catalog explains missing metadata instead of rendering placeholders', async ({
    page,
  }) => {
    await page.route('**/api/console/event-catalog/event-types*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: [{ eventType: 'JOB_EMPTY', description: '', category: '', schema: '' }],
        }),
      }),
    )
    await page.route('**/api/console/event-catalog/topics*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'SUCCESS', message: 'ok', data: [] }),
      }),
    )

    await page.goto('/system/event-catalog')
    await expect(page.getByText('未登记分类', { exact: true })).toBeVisible()
    await expect(page.getByText('Schema 未登记', { exact: true })).toBeVisible()
    await expect(page.getByText('未登记描述信息。', { exact: true })).toBeVisible()
  })

  test('worker fingerprints and arrival groups show summaries above detail tables', async ({
    page,
  }) => {
    await page.goto('/ops/worker-fingerprints')
    await expectPageTitle(page, 'Worker fingerprint 看板')
    await expect(page.getByText('主版本', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('版本漂移', { exact: true })).toBeVisible()

    await page.goto('/files/arrival-groups')
    await expectPageTitle(page, '到达组治理')
    await expect(page.getByText('文件到达进度', { exact: true })).toBeVisible()
    await expect(page.getByText('超时组', { exact: true })).toBeVisible()
  })

  test('capacity profile keeps refresh in the filter toolbar and renders analytical views', async ({
    page,
  }) => {
    await page.goto('/ops/capacity-profile')
    await expectPageTitle(page, '容量画像')
    await expect(page.getByRole('button', { name: '刷新' })).toHaveCount(1)
    await expect(page.getByText('运行量趋势', { exact: true })).toBeVisible()
    await expect(page.getByText('吞吐排行(记录/秒)', { exact: true })).toBeVisible()
    await expect(page.getByText('平均耗时与 P95', { exact: true })).toBeVisible()
  })

  test('approval rows open the compact detail drawer when data is available', async ({ page }) => {
    await page.goto('/approvals')
    await expectPageTitle(page, '审批中心')
    const detailButton = page.getByRole('button', { name: '详情' }).first()
    if (!(await isVisible(detailButton, 3000))) return

    await detailButton.click()
    await expect(page.getByRole('heading', { name: '审批详情' })).toBeVisible()
    await expect(page.getByText('请求载荷', { exact: true })).toBeVisible()
  })

  test('approval empty state explains what appears next and offers refresh', async ({ page }) => {
    await page.route('**/api/console/queries/approvals?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: { items: [], total: 0, pageNo: 1, pageSize: 15 },
        }),
      }),
    )
    await page.goto('/approvals')
    await expect(page.getByText('当前租户暂无审批记录', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '刷新' }).last()).toBeVisible()
  })

  test('top bar groups low-frequency utilities under one named control', async ({ page }) => {
    const tools = page.getByRole('button', { name: '工具菜单' })
    await expect(tools).toBeVisible()
    await tools.click()
    await expect(page.getByText('移动端预览', { exact: true })).toBeVisible()
    await expect(page.getByText('打开文档', { exact: true })).toBeVisible()
  })
})
