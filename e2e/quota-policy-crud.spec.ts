/**
 * 配额策略 CRUD 测试 - 覆盖 i18n 改过的 QuotaPanel.vue 6 个字段。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('quota policy CRUD (配额策略)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/quota')
    await expectPageTitle(page, /配额策略|租户配额/)
  })

  test('新增配额策略对话框可打开 + 验证字段', async ({ page }) => {
    await page.getByRole('button', { name: '新增策略' }).first().click()
    await expect(page.getByText('新增配额策略')).toBeVisible()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').filter({ hasText: '新增配额策略' })
    await expect(dialog.getByText('策略编码', { exact: true })).toBeVisible()
    await expect(dialog.getByText('租户并发上限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('租户分片上限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('租户 QPS 上限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('公平权重', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click({ force: true })
  })

  test('真端到端:填真实值 → 保存 → 成功提示 + 列表出现新策略', async ({ page }) => {
    const code = `e2e-quota-${Date.now()}`
    await page.getByRole('button', { name: '新增策略' }).first().click()
    const drawer = page
      .locator('.el-drawer:visible, .el-dialog:visible')
      .filter({ hasText: '新增配额策略' })
    await expect(drawer).toBeVisible({ timeout: 5000 })

    // 策略编码(el-input)
    await drawer
      .locator('.el-form-item')
      .filter({ hasText: '策略编码' })
      .locator('input')
      .first()
      .fill(code)
    // 4 个 el-input-number:并发 / 分片 / QPS / 公平权重(填真实数值)
    const setNum = async (label: string, val: string) => {
      const inp = drawer.locator('.el-form-item').filter({ hasText: label }).locator('input').first()
      await inp.click()
      await inp.fill(val)
      await inp.blur().catch(() => {})
    }
    await setNum('租户并发上限', '20')
    await setNum('租户分片上限', '100')
    await setNum('QPS', '50')
    await setNum('公平权重', '5')

    // 保存 → 成功提示 + 抽屉关闭
    await drawer.getByRole('button', { name: /保存|确定/ }).first().click()
    await expect(page.locator('.el-message--success').first()).toBeVisible({
      timeout: 6000,
    })
    await expect(drawer).toBeHidden({ timeout: 6000 })

    // 列表出现新策略(reload 后)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 8000 })
  })
})
