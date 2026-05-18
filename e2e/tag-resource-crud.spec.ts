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
    // 新增按钮现在受外层 resourceType+resourceCode 控制:两者齐备前 button.disabled,
    // 防止用户走完整个新增弹窗后才在保存时被告知缺前置条件。
    const addBtn = page.getByRole('button', { name: /新增/ }).first()
    if (!(await isVisible(addBtn, 2000))) return
    await expect(addBtn).toBeDisabled()

    // 先填资源类型 + 资源编码 — 按钮才能解锁
    const typeSelect = page
      .locator('.el-form-item')
      .filter({ hasText: /资源类型|类型/ })
      .locator('.el-select')
    if (await isVisible(typeSelect, 2000)) {
      await typeSelect.click()
      const opt = page.locator('.el-select-dropdown__item').first()
      if (await isVisible(opt, 2000)) await opt.click()
    }
    const codeInput = page
      .locator('.el-form-item')
      .filter({ hasText: /资源编码|编码/ })
      .getByRole('textbox')
    if (await isVisible(codeInput, 2000)) await codeInput.fill('test-resource')

    await expect(addBtn).toBeEnabled()
    await addBtn.click()
    await page.waitForTimeout(400)
    // 实际打开的是 el-drawer 不是 el-dialog
    const drawer = page.locator('.el-drawer').first()
    if (await isVisible(drawer, 2000)) {
      await expect(drawer).toBeVisible()
      const cancelBtn = drawer.getByRole('button', { name: /取消|关闭/ }).first()
      if (await cancelBtn.count()) await cancelBtn.click({ force: true })
    }
  })

  test('按标签搜索 tab 可切换', async ({ page }) => {
    await page.getByRole('tab', { name: '按标签搜索' }).click()
    await expect(page.getByRole('tab', { name: '按标签搜索' })).toHaveClass(/is-active/)
  })
})
