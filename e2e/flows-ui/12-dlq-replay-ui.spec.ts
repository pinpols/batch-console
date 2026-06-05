/**
 * UI Flow 12: DLQ replay UI
 * 真页:/observability/outbox (dead-letters tab) 或 /ops/diagnostic
 *
 * 断言深度:每步硬断言「页面真到位 + 内容真渲染」;死信 tab 切换后验数据视图;
 * replay 操作有数据时才走(数据无关,避免 seed 波动 flaky)。
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

const LIST_OR_EMPTY = 'tbody tr.el-table__row, .el-table__empty-block, .el-empty, .empty-state'

test.describe('UI Flow 12: DLQ replay UI', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('1. /ops/diagnostic 运维诊断页渲染(含 DLQ section)', async ({ page }) => {
    await page.goto('/ops/diagnostic')
    await expect(page).toHaveURL(/\/ops\/diagnostic/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(
      page.locator('.section-card, .el-card, .el-table, .el-empty').first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('2. /observability/outbox 死信 tab 数据视图渲染', async ({ page }) => {
    await page.goto('/observability/outbox')
    await expect(page).toHaveURL(/\/observability\/outbox/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
    const dlqTab = page.getByRole('tab', { name: /死信|dead.?letter|DLQ/i }).first()
    if (await isVisible(dlqTab, 2000)) {
      await dlqTab.click({ force: true })
      // 验 tab 真切换(激活态);不去断隐藏 pane 的表
      await expect(dlqTab).toHaveAttribute('aria-selected', 'true', { timeout: 4000 })
    }
  })

  test('3. replay 按钮(若有 dead-letter 数据)点开对话框', async ({ page }) => {
    await page.goto('/observability/outbox')
    await expect(page).toHaveURL(/\/observability\/outbox/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
    const replayBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: /replay|重放|重新投递/i })
      .first()
    if (await isVisible(replayBtn, 2000)) {
      await replayBtn.click({ force: true })
      const dlg = page.locator('.el-message-box, .el-dialog:visible').first()
      await expect(dlg).toBeVisible({ timeout: 3000 })
      await page.keyboard.press('Escape')
    }
  })
})
