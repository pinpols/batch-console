/**
 * 执行日志（审计检索）— 完整操作测试
 * 覆盖：页面加载、Trace 筛选、操作类型筛选、结果筛选、重置、刷新、自动刷新开关、URL 参数预填
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('执行日志 — 页面基础', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/logs')
    await expectPageTitle(page, /执行日志/)
  })

  test('页面正常打开并展示表格', async ({ page }) => {
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
  })

  test('刷新按钮可用', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
  })
})

test.describe('执行日志 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/logs')
    await expectPageTitle(page, /执行日志/)
  })

  test('Trace 筛选 → 查询 → 重置', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: 'Trace' }).getByRole('textbox')
    await input.fill('trace-test-e2e')
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
    await page.getByRole('button', { name: '重置' }).click()
    await expect(input).toHaveValue('')
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
  })

  test('Trace 输入框回车触发查询', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: 'Trace' }).getByRole('textbox')
    await input.fill('trace-enter-test')
    await input.press('Enter')
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
  })

  test('操作类型筛选 → 查询', async ({ page }) => {
    const select = page
      .locator('.el-form-item')
      .filter({ hasText: '操作类型' })
      .locator('.el-select')
    await select.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 3000)) {
      await opt.click()
      await page.getByRole('button', { name: '查询' }).click()
      await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('结果筛选 → 查询', async ({ page }) => {
    const select = page
      .locator('.el-form-item')
      .filter({ hasText: '结果' })
      .locator('.el-select')
    await select.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 3000)) {
      await opt.click()
      await page.getByRole('button', { name: '查询' }).click()
      await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('多条件组合筛选 → 重置清空所有条件', async ({ page }) => {
    const traceInput = page
      .locator('.el-form-item')
      .filter({ hasText: 'Trace' })
      .getByRole('textbox')
    await traceInput.fill('combined-test')
    await page.getByRole('button', { name: '查询' }).click()
    await page.getByRole('button', { name: '重置' }).click()
    await expect(traceInput).toHaveValue('')
  })
})

test.describe('执行日志 — 自动刷新', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/logs')
    await expectPageTitle(page, /执行日志/)
  })

  test('自动刷新开关默认关闭', async ({ page }) => {
    const switchEl = page.locator('.el-switch')
    await expect(switchEl).toBeVisible()
    await expect(switchEl).not.toHaveClass(/is-checked/)
  })

  test('开启自动刷新开关', async ({ page }) => {
    const switchEl = page.locator('.el-switch')
    await switchEl.click()
    await expect(switchEl).toHaveClass(/is-checked/)
    // 关闭，避免影响后续测试
    await switchEl.click()
    await expect(switchEl).not.toHaveClass(/is-checked/)
  })
})

test.describe('执行日志 — URL 参数预填', () => {
  test('traceId URL 参数预填 Trace 输入框并自动查询', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/logs?traceId=url-trace-test-123')
    await expectPageTitle(page, /执行日志/)
    const input = page.locator('.el-form-item').filter({ hasText: 'Trace' }).getByRole('textbox')
    await expect(input).toHaveValue('url-trace-test-123')
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
  })
})
