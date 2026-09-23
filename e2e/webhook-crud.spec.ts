/**
 * Webhook 独立 CRUD 测试
 * 覆盖:POST/PUT/DELETE /api/console/webhooks (在 system 租户 + 通知与投递 → Webhook tab)
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

// 不要 module-level Date.now,并行 worker 可能撞 ms
let uniqueName: string

test.describe('Webhook CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/notifications')
    await expectPageTitle(page, '通知与投递')
    await page.getByRole('tab', { name: 'Webhook' }).click()
    await expect(page.getByRole('tab', { name: 'Webhook' })).toHaveClass(/is-active/)
  })

  test('新增 Webhook → 列表出现 → 删除清理', async ({ page }) => {
    uniqueName = `test-webhook-${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    // —— 新增 ——
    const addBtn = page.getByRole('button', { name: /^新增/ }).first()
    await addBtn.click()
    await expect(page.getByText(/新增 Webhook/).first()).toBeVisible()
    await page.waitForTimeout(400) // 等 dialog 进场动画

    // 名称 / URL / 事件类型 — 用 form-item filter 定位,避开 getByLabel 在列表筛选区的歧义
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible')
    await dialog.locator('.el-form-item').filter({ hasText: '名称' }).locator('input').first().fill(uniqueName)
    await dialog.locator('.el-form-item').filter({ hasText: 'URL' }).locator('input').first().fill('https://example.com/test-hook')
    await dialog.locator('.el-form-item').filter({ hasText: '事件类型' }).locator('input,textarea').first().fill('JOB_SUCCEEDED')

    // 验证 fill 成功(debug 防御:如果输入失败,提前明确报错)
    await expect(dialog.locator('.el-form-item').filter({ hasText: '名称' }).locator('input').first()).toHaveValue(uniqueName)

    // 保存 — 在 dialog 的 footer 内定位避免歧义
    await dialog.getByRole('button', { name: /保存|创建/ }).click({ force: true })
    await expect(page.locator('.el-message--success').first()).toBeVisible({ timeout: 8000 })
    await expect(dialog).toBeHidden({ timeout: 6000 })

    // —— 列表验证 ——
    const row = page.locator('tr', { hasText: uniqueName })
    await expect(row).toHaveCount(1)

    // —— 删除清理 ——
    const deleteBtn = row.getByRole('button', { name: /删除|吊销/ }).first()
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /^(确定|确认.*)$/ })
      .click()
    await expect(page.locator('.el-message--success').first()).toBeVisible({ timeout: 8000 })
    await expect(row).toHaveCount(0)
  })

  test('Webhook 列表展示 + 刷新', async ({ page }) => {
    // 列表存在(空数据时是 EmptyState)
    await expect(
      page.locator('.el-table, .empty-state, .table-skeleton').first()
    ).toBeAttached({ timeout: 8000 })
    // 刷新可点
    await expect(page.locator('.el-tab-pane:visible').getByRole('button', { name: '刷新' }).first()).toBeVisible()
  })
})
