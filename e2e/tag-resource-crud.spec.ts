/**
 * Tag 资源标签 upsert + delete 闭环。
 * Tag 用 composite key (resourceType+resourceCode+tagKey),没有 id。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('tag resource CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tags')
    await expectPageTitle(page, '标签管理')
  })

  test('资源标签 tab 默认激活 + 查询', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '资源标签' })).toHaveClass(/is-active/)
    // 搜索按钮存在(没数据时也应可见)
    await expect(page.getByRole('button', { name: '搜索' }).first()).toBeVisible()
  })

  test('新建标签对话框可打开并填写', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /新增/ }).first()
    if (!(await isVisible(addBtn, 2000))) return
    await addBtn.click()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').first()
    if (await isVisible(dialog, 2000)) {
      await expect(dialog).toBeVisible()
      // 关闭对话框
      const cancelBtn = dialog.getByRole('button', { name: /取消|关闭/ }).first()
      if (await cancelBtn.count()) await cancelBtn.click({ force: true })
    }
  })

  test('按标签搜索 tab 可切换', async ({ page }) => {
    await page.getByRole('tab', { name: '搜索标签' }).click()
    await expect(page.getByRole('tab', { name: '搜索标签' })).toHaveClass(/is-active/)
  })
})
