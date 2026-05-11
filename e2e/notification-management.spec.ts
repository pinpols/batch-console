import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('notification management (通知与投递)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('通知与投递页面可打开并展示 4 个标签页', async ({ page }) => {
    await page.goto('/system/notifications')
    await expectPageTitle(page, '通知与投递')
    await expect(page.getByRole('tab', { name: '通知渠道' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '订阅规则' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Webhook' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '投递日志' })).toBeVisible()
  })

  test('通知渠道标签页展示表格与新增按钮', async ({ page }) => {
    await page.goto('/system/notifications')
    await expect(page.getByRole('tab', { name: '通知渠道' })).toHaveClass(/is-active/)
    // 按钮文案简化为单字"新增"(在 tab pane 内 prepend 插槽)
    await expect(page.locator('.el-tab-pane:visible').getByRole('button', { name: /^新增$/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '刷新' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '渠道编码' })).toBeVisible()
  })

  test('订阅规则标签页展示表格与新增按钮', async ({ page }) => {
    await page.goto('/system/notifications')
    await page.getByRole('tab', { name: '订阅规则' }).click()
    await expect(page.locator('.el-tab-pane:visible').getByRole('button', { name: /^新增$/ }).first()).toBeVisible()
  })

  test('投递日志标签页展示表格', async ({ page }) => {
    await page.goto('/system/notifications')
    await page.getByRole('tab', { name: '投递日志' }).click()
    await expect(page.getByRole('columnheader', { name: '事件类型' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '状态' })).toBeVisible()
  })

  test('Webhook 标签页展示表格与新增按钮', async ({ page }) => {
    await page.goto('/system/notifications')
    await page.getByRole('tab', { name: 'Webhook' }).click()
    await expect(page.getByRole('button', { name: /新增/ })).toBeVisible()
  })

  test('旧 webhooks 路由重定向', async ({ page }) => {
    await page.goto('/system/webhooks')
    await expect(page).toHaveURL(/\/system\/notifications/)
  })
})
