import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('navigation and tabs', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('侧边栏导航可切换到关键页面', async ({ page }) => {
    await page.getByText('执行与观测').click()
    await page.getByRole('menuitem', { name: 'Workflow Run' }).click()
    await expect(page).toHaveURL(/\/monitor\/workflow-runs/)
    await expectPageTitle(page, 'Workflow Run 列表')

    await page.getByRole('menuitem', { name: 'Outbox' }).click()
    await expect(page).toHaveURL(/\/observability\/outbox/)
    await expectPageTitle(page, 'Outbox')
  })

  test('打开多个页面后会显示页签', async ({ page }) => {
    test.skip(true, '页签组件已重构，待更新选择器')
    await page.goto('/ops/summary')
    await page.goto('/monitor/job-instances')
    await page.goto('/observability/alerts')

    // Hover over the floating tabs to reveal all tabs (non-active tabs are hidden until hover)
    await page.locator('.floating-tabs').hover()
    await expect(page.locator('.page-tab__title', { hasText: '运营概览' })).toBeVisible()
    await expect(page.locator('.page-tab__title', { hasText: 'Job Instance 列表' })).toBeVisible()
    await expect(page.locator('.page-tab__title', { hasText: '告警' })).toBeVisible()
  })

  test('关闭当前页签后回退到其他已打开页面', async ({ page }) => {
    test.skip(true, '页签组件已重构，待更新选择器')
    await page.goto('/ops/summary')
    await page.goto('/monitor/job-instances')
    await page.goto('/observability/alerts')

    await page.locator('.floating-tabs').hover()
    await page.locator('.page-tab.page-tab--active .page-tab__close').click()
    await expect(page).toHaveURL(/\/monitor\/job-instances/)
    await expectPageTitle(page, 'Job Instance 列表')
  })

  test('命令面板可以打开和关闭', async ({ page }) => {
    await page.getByRole('button', { name: '打开命令面板' }).click()
    await expect(page.getByPlaceholder('搜索菜单、最近页面；纯数字可跳 Job 实例详情')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder('搜索菜单、最近页面；纯数字可跳 Job 实例详情')).toBeHidden()
  })
})
