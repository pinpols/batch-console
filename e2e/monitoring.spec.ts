import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('monitoring pages', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Job Instance 列表支持基础筛选控件', async ({ page }) => {
    await page.goto('/monitor/job-instances')
    await expectPageTitle(page, 'Job Instance 列表')
    await expect(page.getByText('Job Code').first()).toBeVisible()
    await expect(page.getByText('状态').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })

  test('Job Step Instance 页面可打开', async ({ page }) => {
    await page.goto('/monitor/job-steps')
    await expectPageTitle(page, /Job Step Instance/)
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })

  test('Workflow Run 列表支持查询与详情入口列', async ({ page }) => {
    await page.goto('/monitor/workflow-runs')
    await expectPageTitle(page, 'Workflow Run 列表')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Run Id|Def Id/ }).first()).toBeVisible()
  })

  test('调度与批次日页面可打开', async ({ page }) => {
    await page.goto('/scheduler/snapshot')
    await expect(page).toHaveURL(/scheduler\/snapshot/, { timeout: 10_000 })

    await page.goto('/scheduler/batch-days')
    await expect(page).toHaveURL(/scheduler\/batch-days/, { timeout: 10_000 })
  })

  test('批次日窗口页面可通过日期参数打开', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0]
    await page.goto(`/scheduler/batch-days/${today}`)
    await expect(page).toHaveURL(new RegExp(`/scheduler/batch-days/${today}`))
    await expect(page.locator('.page-header .title').first()).toHaveText(/批次日窗口/, { timeout: 15_000 })
  })
})
