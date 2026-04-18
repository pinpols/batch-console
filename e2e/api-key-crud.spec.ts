import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('API Key management CRUD (API Key 增删)', () => {
  const uniqueName = `e2e-key-${Date.now()}`

  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/api-keys')
    await expectPageTitle(page, 'API Key 管理')
  })

  test('新增 API Key → 表格出现 → 查看详情 → 吊销清理', async ({ page }) => {
    // —— 新增 ——
    await page.getByRole('button', { name: '新增 API Key' }).click()
    await expect(page.getByText('新增 API Key').first()).toBeVisible()
    await page.getByLabel('名称').fill(uniqueName)
    await page.getByLabel('权限范围').fill('READ,WRITE')
    await page.getByRole('button', { name: '创建' }).click()
    // 等表格刷新
    await expect(page.getByRole('cell', { name: uniqueName })).toBeVisible({ timeout: 5000 })

    // —— 详情 ——
    const row = page.locator('tr', { hasText: uniqueName })
    await row.getByRole('button', { name: '详情' }).click()
    await expect(page.getByText('API Key 详情')).toBeVisible()
    // 关闭详情弹窗
    await page.keyboard.press('Escape')

    // —— 吊销清理（避免遗留测试数据）——
    const revokeBtn = page.locator('tr', { hasText: uniqueName }).getByRole('button', { name: '吊销' })
    if (await isVisible(revokeBtn, 2000)) {
      await revokeBtn.click()
      const confirmBtn = page.getByRole('button', { name: '确定' })
      if (await isVisible(confirmBtn, 2000)) {
        await confirmBtn.click()
      }
      await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    }
  })

  test('吊销任意已有 API Key', async ({ page }) => {
    // 如果有可吊销的 Key 则验证吊销流程
    const revokeBtn = page.locator('.table-actions').getByRole('button', { name: '吊销' }).first()
    if (!(await isVisible(revokeBtn))) return
    await revokeBtn.click()
    const confirmBtn = page.getByRole('button', { name: '确定' })
    if (await isVisible(confirmBtn, 2000)) {
      await confirmBtn.click()
    }
    // 吊销后页面不崩溃
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })
})
