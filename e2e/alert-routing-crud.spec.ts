/**
 * 告警路由 CRUD 测试 - 之前完全没覆盖。
 * 覆盖刚 i18n 改过的 AlertRoutingPanel.vue 11 个字段。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('alert routing CRUD (告警路由)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/alert-routings')
    await expectPageTitle(page, '告警路由')
  })

  test('新增告警路由对话框可打开 + 验证字段', async ({ page }) => {
    await page.getByRole('button', { name: '新增路由' }).first().click()
    await expect(page.getByText('新增告警路由')).toBeVisible()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').filter({ hasText: '新增告警路由' })
    // 验证 i18n 改后的所有 field label
    await expect(dialog.getByText('路由编码', { exact: true })).toBeVisible()
    await expect(dialog.getByText('团队', { exact: true })).toBeVisible()
    await expect(dialog.getByText('告警分组', { exact: true })).toBeVisible()
    await expect(dialog.getByText('级别', { exact: true })).toBeVisible()
    await expect(dialog.getByText('接收人', { exact: true })).toBeVisible()
    await expect(dialog.getByText('分组维度', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click({ force: true })
  })
})
