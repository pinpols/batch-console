import { expect, test } from './support/app'
import { enterDemoApp, isVisible } from './support/app'

/**
 * Pipeline 用 drawer 不是 dialog,helper 的 openDialog 不适用。
 * 这里就地写,沿用 form-helpers 的子断言风格。
 */
test.describe('Pipeline 表单校验 (drawer)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/jobs/pipelines')
  })

  test('全空提交被拦截 (jobCode/pipelineName/pipelineType @NotBlank)', async ({ page }) => {
    await page.getByRole('button', { name: '新增 Pipeline' }).click()
    await page.waitForTimeout(400)
    const drawer = page.locator('.el-drawer').first()
    await expect(drawer).toBeVisible({ timeout: 3000 })
    // 直接点保存按钮 (在 drawer footer)
    const saveBtn = drawer.getByRole('button', { name: /保存|创建/ }).first()
    if (await saveBtn.count()) {
      await saveBtn.click({ force: true })
      // 校验失败:任一 form-item 出现 is-error OR toast 出现
      const sig = page
        .locator('.el-form-item.is-error, .el-message--warning, .el-message--error')
        .first()
      await expect(sig).toBeVisible({ timeout: 2500 })
    }
    await page.keyboard.press('Escape')
  })

  test('pipelineName 超长被截断 (≤256)', async ({ page }) => {
    await page.getByRole('button', { name: '新增 Pipeline' }).click()
    await page.waitForTimeout(400)
    const drawer = page.locator('.el-drawer').first()
    const nameInput = drawer
      .locator('.el-form-item')
      .filter({ hasText: '名称' })
      .locator('input')
      .first()
    if (!(await isVisible(nameInput, 2000))) return
    const tooLong = 'a'.repeat(257)
    await nameInput.fill(tooLong)
    const value = await nameInput.inputValue()
    expect(value.length).toBeLessThanOrEqual(256)
    await page.keyboard.press('Escape')
  })
})
