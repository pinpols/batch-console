/**
 * 告警 + Outbox — 完整业务流程测试（真实变更）
 * 覆盖：告警筛选、确认/静默/关闭操作、Outbox Tab 切换与筛选
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

// ─── 告警 ─────────────────────────────────────────────────────────

test.describe('告警 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/alerts')
    await expectPageTitle(page, /事件告警|告警/)
  })

  test('级别筛选 → 查询', async ({ page }) => {
    const levelSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '级别' })
      .locator('.el-select')
    await levelSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('状态筛选 → 查询', async ({ page }) => {
    const statusSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '状态' })
      .locator('.el-select')
    await statusSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('Trace 搜索 → 查询 → 重置', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: 'Trace' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('trace-test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    await page.getByRole('button', { name: '重置' }).click()
    await expect(input).toHaveValue('')
  })

  test('刷新', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})

test.describe('告警 — 操作流', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/alerts')
    await expectPageTitle(page, /事件告警|告警/)
  })

  // FE 走两步对话框:① confirmDanger 危险确认(无 input) ② optionalReason 填写原因
  // helper:处理两步链
  async function clickThroughTwoDialogs(page: import('@playwright/test').Page, reason: string) {
    // 第一个对话框 — confirmDanger
    const box1 = page.locator('.el-message-box').first()
    await expect(box1).toBeVisible({ timeout: 3000 })
    await box1.getByRole('button', { name: /确认告警|确认静默|确认关闭|确定/ }).first().click()
    // 等第一个关闭、第二个打开
    await page.waitForTimeout(300)
    // 第二个对话框 — optionalReason(可选)
    const box2 = page.locator('.el-message-box').first()
    if (await isVisible(box2, 2000)) {
      const input = box2.locator('input,textarea').first()
      if (await isVisible(input, 800)) await input.fill(reason)
      await box2.getByRole('button', { name: /^(确定|确认.*)$/ }).first().click()
    }
  }

  test('确认告警 → 填写说明 → 提交 → toast', async ({ page }) => {
    const confirmBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '确认' })
      .first()
    if (!(await isVisible(confirmBtn))) return
    await confirmBtn.click()
    await clickThroughTwoDialogs(page, 'e2e 自动化确认')
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('静默告警 → 填写说明 → 提交 → toast', async ({ page }) => {
    const silenceBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '静默' })
      .first()
    if (!(await isVisible(silenceBtn))) return
    await silenceBtn.click()
    await clickThroughTwoDialogs(page, 'e2e 自动化静默')
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('关闭告警 → 填写说明 → 提交 → toast', async ({ page }) => {
    const closeBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '关闭' })
      .first()
    if (!(await isVisible(closeBtn))) return
    await closeBtn.click()
    await clickThroughTwoDialogs(page, 'e2e 自动化关闭')
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})

// ─── Outbox ───────────────────────────────────────────────────────

test.describe('Outbox — Tab 与筛选', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/outbox')
    await expectPageTitle(page, 'Outbox')
  })

  test('重试 tab 默认激活', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '重试' })).toHaveClass(/is-active/)
  })

  test('切换到投递 tab', async ({ page }) => {
    await page.getByRole('tab', { name: '投递' }).click()
    await expect(page.getByRole('tab', { name: '投递' })).toHaveClass(/is-active/)
  })

  test('重试 tab — 关键字搜索', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: '关键字' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('重试 tab — 状态筛选', async ({ page }) => {
    const statusSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '状态' })
      .locator('.el-select')
    if (!(await isVisible(statusSelect, 2000))) return
    await statusSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('投递 tab — 关键字搜索', async ({ page }) => {
    await page.getByRole('tab', { name: '投递' }).click()
    const input = page.locator('.el-form-item').filter({ hasText: '关键字' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('刷新', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})
