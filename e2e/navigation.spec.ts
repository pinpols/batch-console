import { expect, test } from '@playwright/test'
import { STORAGE_KEYS } from './support/storage'

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })

function response(data: unknown) {
  return { code: 'SUCCESS', message: 'ok', data }
}

test.describe('navigation and tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((keys) => {
      localStorage.setItem(keys.session, '1')
      localStorage.setItem(keys.tenantId, 'ta')
      localStorage.setItem(keys.locale, 'zh-CN')
      localStorage.setItem(keys.onboardingDone, '1')
    }, STORAGE_KEYS)
    await page.route('**/api/console/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const data =
        path === '/api/console/auth/me'
          ? { username: 'navigation-admin', tenantId: 'ta', authorities: ['ROLE_ADMIN'] }
          : path === '/api/console/tenants'
            ? { items: [{ tenantId: 'ta', tenantName: 'Tenant A', status: 'ACTIVE' }], total: 1 }
            : path === '/api/console/ops/summary'
              ? {
                  tenantId: 'ta',
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
                }
              : { items: [], total: 0, pageNo: 1, pageSize: 20 }
      await route.fulfill({ status: 200, json: response(data) })
    })
    await page.goto('/ops/summary')
    await expect(page).toHaveURL(/\/ops\/summary/)
    await expect(page.locator('.page-header .title').first()).toBeVisible()
  })

  test('侧边栏导航可切换到关键页面', async ({ page }) => {
    // 2026-07 侧栏按设计原稿原生重写(弃 el-menu):分组头 .nav__group-hd(可折叠,
    // 默认只展开当前路由所在组)+ RouterLink .nav__item;1280 宽 > 1024 阈值,默认展开标签栏。
    await page.locator('.nav__group-hd', { hasText: '跟踪运行' }).click()
    await page
      .getByRole('link', { name: /工作流运行|Workflow Run/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/monitor\/workflow-runs/)

    await expect(page.getByRole('progressbar').first()).toBeHidden()
    await page.locator('.nav__group-hd', { hasText: '处理异常' }).click()
    await page
      .getByRole('link', { name: /^告警事件$|^事件告警$|^告警$|^Alerts?$/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/observability\/alerts/)
  })

  test('侧边栏分组和页面入口可通过键盘操作', async ({ page }) => {
    const group = page.getByRole('button', { name: '跟踪运行' })
    await group.focus()
    await expect(group).toBeFocused()
    await page.keyboard.press('Enter')

    const workflowLink = page.getByRole('link', { name: /工作流运行|Workflow Run/ }).first()
    await expect(workflowLink).toBeVisible()
    await workflowLink.focus()
    await expect(workflowLink).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/monitor\/workflow-runs/)
  })

  test('命令面板可以打开和关闭', async ({ page }) => {
    await page.getByRole('button', { name: '打开命令面板' }).click()
    await expect(page.getByPlaceholder(/搜索页面/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder(/搜索页面/)).toBeHidden()
  })
})
