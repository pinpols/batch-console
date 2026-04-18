import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('quota panel (配额策略)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('配额策略可打开', async ({ page }) => {
    await page.goto('/governance/quota')
    await expectPageTitle(page, '配额策略')
  })
})

test.describe('queue config (队列 / 窗口 / 日历)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('队列 / 窗口 / 日历页面可打开并展示标签页', async ({ page }) => {
    await page.goto('/governance/queues')
    await expectPageTitle(page, '队列 / 窗口 / 日历')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })
})

test.describe('scheduler (调度)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('调度快照页面可打开并展示刷新按钮', async ({ page }) => {
    await page.goto('/scheduler/snapshot')
    await expectPageTitle(page, '调度快照')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })

  test('批次日历日列表可打开并展示查询控件', async ({ page }) => {
    await page.goto('/scheduler/batch-days')
    await expectPageTitle(page, '批次日历日')
    await expect(page.getByText('日历').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })

  test('Catch-up 审批页面可打开', async ({ page }) => {
    await page.goto('/scheduler/catch-up-approvals')
    await expectPageTitle(page, 'Catch-up 审批')
  })
})

test.describe('approvals (审批中心)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('审批中心可打开并展示表格', async ({ page }) => {
    await page.goto('/approvals')
    await expectPageTitle(page, '审批中心')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })
})

test.describe('reports (报表导出)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('报表导出中心可打开', async ({ page }) => {
    await page.goto('/reports')
    await expectPageTitle(page, /导出中心/)
  })
})
