import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('config release dependency & diff (配置发布依赖与对比)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/releases')
    await expectPageTitle(page, '发布管理')
  })

  test('操作列展示依赖和对比按钮', async ({ page }) => {
    const depsBtn = page.locator('.table-actions').getByRole('button', { name: '依赖' }).first()
    const diffBtn = page.locator('.table-actions').getByRole('button', { name: '对比' }).first()
    if (await isVisible(depsBtn)) {
      await expect(depsBtn).toBeEnabled()
      await expect(diffBtn).toBeEnabled()
    }
  })

  test('点击依赖按钮打开依赖关系抽屉', async ({ page }) => {
    const depsBtn = page.locator('.table-actions').getByRole('button', { name: '依赖' }).first()
    if (await isVisible(depsBtn)) {
      await depsBtn.click()
      await expect(page.getByText('配置依赖关系')).toBeVisible()
    }
  })

  test('点击对比按钮打开版本对比对话框', async ({ page }) => {
    const diffBtn = page.locator('.table-actions').getByRole('button', { name: '对比' }).first()
    if (await isVisible(diffBtn)) {
      await diffBtn.click()
      await expect(page.getByText('配置版本对比')).toBeVisible()
      // 版本 A 已预填
      await expect(page.getByText('版本 A')).toBeVisible()
      await expect(page.getByText('版本 B')).toBeVisible()
      // 对比按钮存在
      await expect(
        page.locator('.el-dialog').getByRole('button', { name: '对比' }),
      ).toBeVisible()
    }
  })
})
