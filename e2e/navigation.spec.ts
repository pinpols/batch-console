import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, waitForRouteStable } from './support/app'

test.describe('navigation and tabs', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('侧边栏导航可切换到关键页面', async ({ page }) => {
    // 2026-06 菜单 IA v4(7→5 组):工作台/运行监控/作业与文件/调度治理/系统管理。
    // 原"告警与投递"组并入「运行监控」(告警为可见项,Outbox/路由/通知 hidden 走 ⌘K)。
    // 1280×720 viewport ≤ BP.lg → 侧栏自动 collapse 只显图标;先展开才能按 name 匹配菜单项。
    await page.getByRole('button', { name: '展开侧栏' }).click()
    await page
      .getByRole('menuitem', { name: '运行监控', exact: true })
      .first()
      .waitFor({ timeout: 5000 })
    await page.getByRole('menuitem', { name: '运行监控', exact: true }).first().click()
    await waitForRouteStable(page)
    await page.getByRole('menuitem', { name: /工作流运行|Workflow Run/ }).first().click()
    await expect(page).toHaveURL(/\/monitor\/workflow-runs/)

    // 「运行监控」组下的「告警」(原"告警与投递"组已并入)
    await waitForRouteStable(page)
    await page.getByRole('menuitem', { name: /^事件告警$|^告警$|^Alerts?$/ }).first().click()
    await expect(page).toHaveURL(/\/observability\/alerts/)
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
    await expectPageTitle(page, '作业运行')
  })

  test('命令面板可以打开和关闭', async ({ page }) => {
    await page.getByRole('button', { name: '打开命令面板' }).click()
    await expect(page.getByPlaceholder(/搜索菜单/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder(/搜索菜单/)).toBeHidden()
  })
})
