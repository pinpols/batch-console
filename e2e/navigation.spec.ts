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
    await page.locator('.nav__group-hd', { hasText: '运行监控' }).click()
    await page
      .getByRole('link', { name: /工作流运行|Workflow Run/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/monitor\/workflow-runs/)

    await expect(page.getByRole('progressbar').first()).toBeHidden()
    await page.locator('.nav__group-hd', { hasText: '告警与投递' }).click()
    await page
      .getByRole('link', { name: /^告警事件$|^事件告警$|^告警$|^Alerts?$/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/observability\/alerts/)
  })

  test('侧边栏分组和页面入口可通过键盘操作', async ({ page }) => {
    const group = page.getByRole('button', { name: '运行监控' })
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

  test('权限自查位于平台管理并以树形结构展示菜单', async ({ page }) => {
    await page.locator('.nav__group-hd', { hasText: '平台管理' }).click()
    await page.getByRole('link', { name: '权限自查' }).click()
    await expect(page).toHaveURL(/\/system\/users/)
    await expect(page.getByText('菜单权限树')).toBeVisible()
    await expect(page.getByRole('tree')).toBeVisible()
    await expect(page.getByPlaceholder('搜索菜单或路由')).toBeVisible()
  })

  test('命令面板可以打开和关闭', async ({ page }) => {
    await page.getByRole('button', { name: '打开命令面板' }).click()
    await expect(page.getByPlaceholder(/搜索页面/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder(/搜索页面/)).toBeHidden()
  })

  test('业务引导中心展示可执行任务并支持稍后继续', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '完成平台首条可运行链路' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '确定工作租户' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '创建作业配置' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '完成首个成功运行' })).toBeVisible()
    await expect(page.getByRole('button', { name: /新建作业/ })).toBeVisible()

    await expect(page.getByText('第一步:选择租户')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: '稍后提醒' }).click()
    await expect(page.getByRole('button', { name: '继续配置' })).toBeVisible()

    await page.getByRole('button', { name: /navigation-admin.*平台管理员/ }).click()
    await page.getByRole('menuitem', { name: '业务引导中心' }).click()
    await expect(page).toHaveURL(/\/ops\/summary\?onboarding=1/)
    await expect(page.getByRole('heading', { name: '完成平台首条可运行链路' })).toBeVisible()
  })
})
