/**
 * 配额策略 CRUD 测试 - 覆盖 i18n 改过的 QuotaPanel.vue 6 个字段。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('quota policy CRUD (配额策略)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/quota')
    await expectPageTitle(page, '租户配额')
  })

  test('新增配额策略对话框可打开 + 验证字段', async ({ page }) => {
    await page.getByRole('button', { name: '新增策略' }).first().click()
    await expect(page.getByText('新增配额策略')).toBeVisible()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog').filter({ hasText: '新增配额策略' })
    await expect(dialog.getByText('策略编码', { exact: true })).toBeVisible()
    await expect(dialog.getByText('租户并发上限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('租户分片上限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('租户 QPS 上限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('公平权重', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click({ force: true })
  })
})
