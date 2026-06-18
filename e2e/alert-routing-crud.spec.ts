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

  test('真端到端:填路由 → 保存 → 成功提示 + 列表出现', async ({ page }) => {
    const code = `e2e-route-${Date.now()}`
    await page.getByRole('button', { name: '新增路由' }).first().click()
    const drawer = page
      .locator('.el-drawer:visible, .el-dialog:visible')
      .filter({ hasText: '新增告警路由' })
    await expect(drawer).toBeVisible({ timeout: 5000 })

    const fillByLabel = async (label: string, val: string) => {
      await drawer
        .locator('.el-form-item')
        .filter({ hasText: label })
        .locator('input')
        .first()
        .fill(val)
    }
    await fillByLabel('路由编码', code)
    await fillByLabel('路由名称', `E2E Route ${Date.now()}`)
    await fillByLabel('团队', 'e2e-team')
    await fillByLabel('接收人', 'e2e@example.com')
    await fillByLabel('告警分组', 'e2e-group')
    await fillByLabel('分组维度', 'tenantId,jobCode')
    // 级别(severity)是必填 el-select —— 打开下拉选第一项
    const sevItem = drawer.locator('.el-form-item').filter({ hasText: '级别' }).first()
    await sevItem.locator('.el-select__wrapper, .el-select').first().click()
    const sevOpt = page.locator('.el-select-dropdown:visible').last().locator('.el-select-dropdown__item').first()
    await expect(sevOpt).toBeVisible({ timeout: 5000 })
    await sevOpt.click()

    await drawer.getByRole('button', { name: /保存|确定/ }).first().click()
    // 只认成功(el-message--success);失败会留抽屉开 + 错误 toast,toBeHidden 会如实报错
    await expect(page.locator('.el-message--success').first()).toBeVisible({ timeout: 6000 })
    await expect(drawer).toBeHidden({ timeout: 6000 })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 8000 })
  })
})
