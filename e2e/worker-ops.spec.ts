/**
 * Worker 管理 — 完整业务流程测试（真实变更）
 * 覆盖：Worker 筛选、Drain / 强制下线 / 接管 / 预热、文件渠道详情
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('Worker 管理 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/workers/management')
    await expectPageTitle(page, 'Worker')
  })

  test('Worker 列表 tab 默认激活', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Worker 列表' })).toHaveClass(/is-active/)
    await expect(page.getByRole('columnheader', { name: /Worker|状态/ }).first()).toBeVisible()
  })

  test('状态筛选 → 查询', async ({ page }) => {
    const statusSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '状态' })
      .locator('.el-select')
    if (!(await isVisible(statusSelect, 2000))) return
    await statusSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '查询' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('Worker Code 搜索 → 查询 → 重置', async ({ page }) => {
    const input = page
      .locator('.el-form-item')
      .filter({ hasText: /Worker Code|关键字/ })
      .getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('worker')
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    await page.getByRole('button', { name: '重置' }).click()
    await expect(input).toHaveValue('')
  })

  test('刷新按钮', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})

test.describe('Worker 管理 — Worker 操作', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/workers/management')
    await expectPageTitle(page, 'Worker')
  })

  test('Drain → 确认 → toast', async ({ page }) => {
    const drainBtn = page.locator('.table-actions').getByRole('button', { name: 'Drain' }).first()
    if (!(await isVisible(drainBtn))) return
    await drainBtn.click()
    await expect(page.locator('.el-message-box')).toContainText('drain', { ignoreCase: true })
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })

  test('强制下线 → 确认 → toast', async ({ page }) => {
    const offlineBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '强制下线' })
      .first()
    if (!(await isVisible(offlineBtn))) return
    await offlineBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })

  test('接管 → 确认 → toast', async ({ page }) => {
    const takeoverBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '接管' })
      .first()
    if (!(await isVisible(takeoverBtn))) return
    await takeoverBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })

  test('预热 → toast（无确认弹窗）', async ({ page }) => {
    const warmupBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '预热' })
      .first()
    if (!(await isVisible(warmupBtn))) return
    await warmupBtn.click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Worker 管理 — 文件渠道', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/workers/management')
    await expectPageTitle(page, 'Worker')
    await page.getByRole('tab', { name: '文件渠道' }).click()
    await expect(page.getByRole('tab', { name: '文件渠道' })).toHaveClass(/is-active/)
  })

  test('文件渠道列表加载', async ({ page }) => {
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('渠道类型筛选', async ({ page }) => {
    const typeSelect = page
      .locator('.el-form-item')
      .filter({ hasText: /渠道类型|类型/ })
      .locator('.el-select')
    if (!(await isVisible(typeSelect, 2000))) return
    await typeSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '查询' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('详情抽屉打开并展示渠道信息', async ({ page }) => {
    const detailBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '详情' })
      .first()
    if (!(await isVisible(detailBtn))) return
    await detailBtn.click()
    await expect(page.getByText('渠道详情')).toBeVisible()
    await page.locator('.el-drawer__close-btn').first().click()
    await expect(page.getByText('渠道详情')).toBeHidden()
  })
})
