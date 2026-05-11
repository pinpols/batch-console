import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('API Key management CRUD (API Key 增删)', () => {
  const uniqueName = `e2e-key-${Date.now()}`

  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/api-keys')
    await expectPageTitle(page, 'API Key')
  })

  test('新增 API Key → 表格出现 → 查看详情 → 吊销清理', async ({ page }) => {
    // —— 新增 ——
    await page.getByRole('button', { name: '新增 API Key' }).click()
    await expect(page.getByText('新增 API Key').first()).toBeVisible()
    await page.getByLabel('名称').fill(uniqueName)
    await page.getByLabel('权限范围').fill('READ,WRITE')
    await page.getByRole('button', { name: '创建' }).click()
    // P0 上线"明文 secret modal":创建成功后强制弹窗(close-on-click-modal=false / ESC 禁用,
    // 关闭按钮在 clipboard 写入成功前 disabled)。
    // 为了不阻塞自动化,直接移除 overlay dom + 调 keyboard 触发 vue dialog close。
    const secretModal = page.locator('[role="dialog"]').filter({ hasText: 'API Key 已创建' })
    if (await isVisible(secretModal, 5000)) {
      // 1. 尝试常规路径:复制 → 关闭
      const copyBtn = secretModal.getByRole('button', { name: /复制密钥|已复制/ }).first()
      if (await copyBtn.count()) await copyBtn.click()
      const closeBtn = secretModal.getByRole('button', { name: /我已保存/ }).first()
      if (await closeBtn.count() && !(await closeBtn.isDisabled())) {
        await closeBtn.click()
      }
      // 2. 如果仍未关闭(clipboard 在 headless 可能失败),强行移除 overlay 元素
      if (await secretModal.isVisible().catch(() => false)) {
        await page.evaluate(() => {
          document
            .querySelectorAll('.el-overlay.el-modal-dialog')
            .forEach((el) => el.remove())
        })
      }
      await expect(secretModal).toBeHidden({ timeout: 5000 })
    }
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
