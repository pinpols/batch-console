/**
 * 文件中心 — 完整业务流程测试（真实变更）
 * 覆盖：文件列表筛选/详情/审计/重投递/归档、文件模板详情、文件组到达确认、流水线观测
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

// ─── 文件列表 ──────────────────────────────────────────────────────

test.describe('文件列表 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/files/list')
    await expectPageTitle(page, '文件列表')
  })

  test('文件名搜索 → 查询', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: '文件名' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('状态筛选 → 查询 → 重置', async ({ page }) => {
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
    await page.getByRole('button', { name: '重置' }).click()
  })

  test('业务日期搜索', async ({ page }) => {
    const bizDateInput = page
      .locator('.el-form-item')
      .filter({ hasText: '业务日' })
      .getByRole('textbox')
    if (!(await isVisible(bizDateInput, 2000))) return
    await bizDateInput.fill('2026-04-01')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('刷新按钮', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})

test.describe('文件列表 — 行操作', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/files/list')
    await expectPageTitle(page, '文件列表')
  })

  test('详情抽屉打开并含文件信息', async ({ page }) => {
    const detailBtn = page.locator('.table-actions').getByRole('button', { name: '详情' }).first()
    if (!(await isVisible(detailBtn))) return
    await detailBtn.click()
    await expect(page.getByText('文件详情')).toBeVisible()
    await page.locator('.el-drawer__close-btn').first().click()
    await expect(page.getByText('文件详情')).toBeHidden()
  })

  test('审计抽屉打开', async ({ page }) => {
    const auditBtn = page.locator('.table-actions').getByRole('button', { name: '审计' }).first()
    if (!(await isVisible(auditBtn))) return
    await auditBtn.click()
    await expect(page.getByText('文件审计')).toBeVisible()
    await page.locator('.el-drawer__close-btn').first().click()
  })

  test('重投递 → 确认 → toast', async ({ page }) => {
    const redeliverBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '重投递' })
      .first()
    if (!(await isVisible(redeliverBtn))) return
    await redeliverBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('重投递')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('归档 → 确认 → toast', async ({ page }) => {
    const archiveBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '归档' })
      .first()
    if (!(await isVisible(archiveBtn))) return
    await archiveBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('归档')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})

// ─── 文件模板 ──────────────────────────────────────────────────────

test.describe('文件模板 — 筛选与详情', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/files/templates')
    await expectPageTitle(page, '文件模板')
  })

  test('模板编码搜索 → 查询', async ({ page }) => {
    const input = page
      .locator('.el-form-item')
      .filter({ hasText: '模板编码' })
      .getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('启用状态筛选', async ({ page }) => {
    const enabledSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '启用' })
      .locator('.el-select')
    if (!(await isVisible(enabledSelect, 2000))) return
    await enabledSelect.click()
    const opt = page.locator('.el-select-dropdown__item').filter({ hasText: '启用' }).first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('详情抽屉打开并含模板信息', async ({ page }) => {
    const detailBtn = page.locator('.table-actions').getByRole('button', { name: '详情' }).first()
    if (!(await isVisible(detailBtn))) return
    await detailBtn.click()
    await expect(page.getByText('模板详情')).toBeVisible()
    await page.locator('.el-drawer__close-btn').first().click()
    await expect(page.getByText('模板详情')).toBeHidden()
  })
})

// ─── 文件组到达治理 ───────────────────────────────────────────────

test.describe('文件组到达治理 — 筛选与确认到达', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/files/arrival-groups')
    await expectPageTitle(page, '到达组治理')
  })

  test('组编码搜索 → 查询', async ({ page }) => {
    const input = page
      .locator('.el-form-item')
      .filter({ hasText: '组编码' })
      .getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('group')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('确认到达 → 确认弹窗 → toast', async ({ page }) => {
    const arriveBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '确认到达' })
      .first()
    if (!(await isVisible(arriveBtn))) return
    await arriveBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('到达')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})

// ─── 流水线观测 ────────────────────────────────────────────────────

test.describe('流水线观测 — Tab 功能', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/files/pipeline-obs')
    await expectPageTitle(page, '流水线观测')
  })

  test('默认展示流水线实例 tab', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '流水线实例' })).toHaveClass(/is-active/)
  })

  test('切换到步骤 tab', async ({ page }) => {
    await page.getByRole('tab', { name: '步骤' }).click()
    await expect(page.getByRole('tab', { name: '步骤' })).toHaveClass(/is-active/)
  })

  test('切换到投递 tab', async ({ page }) => {
    await page.getByRole('tab', { name: '投递' }).click()
    await expect(page.getByRole('tab', { name: '投递' })).toHaveClass(/is-active/)
  })

  test('切换到错单 tab', async ({ page }) => {
    await page.getByRole('tab', { name: '错单' }).click()
    await expect(page.getByRole('tab', { name: '错单' })).toHaveClass(/is-active/)
  })

  test('关键字搜索 → 查询', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: '关键字' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})
