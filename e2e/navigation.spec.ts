import { expect, test } from './support/app'
import { enterDemoApp, waitForRouteStable } from './support/app'

test.describe('navigation and tabs', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('侧边栏导航可切换到关键页面', async ({ page }) => {
    // 2026-07 侧栏按设计原稿原生重写(弃 el-menu):分组头 .nav__group-hd(可折叠,
    // 默认只展开当前路由所在组)+ RouterLink .nav__item;1280 宽 > 1024 阈值,默认展开标签栏。
    await page.locator('.nav__group-hd', { hasText: '运行监控' }).click()
    await page
      .getByRole('link', { name: /工作流运行|Workflow Run/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/monitor\/workflow-runs/)

    await waitForRouteStable(page)
    await page.locator('.nav__group-hd', { hasText: '告警与投递' }).click()
    await page
      .getByRole('link', { name: /^事件告警$|^告警$|^Alerts?$/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/observability\/alerts/)
  })

  test('命令面板可以打开和关闭', async ({ page }) => {
    await page.getByRole('button', { name: '打开命令面板' }).click()
    await expect(page.getByPlaceholder(/搜索页面/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder(/搜索页面/)).toBeHidden()
  })
})
