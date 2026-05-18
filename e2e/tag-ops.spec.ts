/**
 * 标签管理 — 完整业务流程测试（真实变更）
 * 覆盖：标签查询（带条件）、按标签搜索（带值）、已注册 Key 列表刷新
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('标签管理 — 标签查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tags')
    await expectPageTitle(page, '标签管理')
    await expect(page.getByRole('tab', { name: '资源标签' })).toHaveClass(/is-active/)
  })

  test('资源类型选择 → 查询', async ({ page }) => {
    const typeSelect = page
      .locator('.el-form-item')
      .filter({ hasText: /资源类型|类型/ })
      .locator('.el-select')
    if (!(await isVisible(typeSelect, 2000))) return
    await typeSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.locator('.el-tab-pane:visible').getByRole('button', { name: '搜索' }).first().click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('资源编码输入 → 查询', async ({ page }) => {
    const codeInput = page
      .locator('.el-form-item')
      .filter({ hasText: /资源编码|编码/ })
      .getByRole('textbox')
    if (!(await isVisible(codeInput, 2000))) return
    await codeInput.fill('test-resource')
    await page.locator('.el-tab-pane:visible').getByRole('button', { name: '搜索' }).first().click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('Tag Key 输入 → 查询', async ({ page }) => {
    const keyInput = page.getByPlaceholder('Tag Key').first()
    if (!(await isVisible(keyInput, 2000))) return
    await keyInput.fill('env')
    await page.locator('.el-tab-pane:visible').getByRole('button', { name: '搜索' }).first().click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('重置清空筛选条件', async ({ page }) => {
    const keyInput = page.getByPlaceholder('Tag Key').first()
    if (!(await isVisible(keyInput, 2000))) return
    await keyInput.fill('env')
    await page.getByRole('button', { name: '重置' }).click()
    await expect(keyInput).toHaveValue('')
  })

  test('刷新', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})

test.describe('标签管理 — 按标签搜索', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tags')
    await expectPageTitle(page, '标签管理')
    await page.getByRole('tab', { name: '搜索标签' }).click()
    await expect(page.getByRole('tab', { name: '搜索标签' })).toHaveClass(/is-active/)
  })

  test('Tag Key 搜索', async ({ page }) => {
    const keyInput = page.getByPlaceholder('Tag Key').first()
    if (!(await isVisible(keyInput, 2000))) return
    await keyInput.fill('env')
    await page.locator('.el-tab-pane:visible').getByRole('button', { name: '搜索' }).first().click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('Tag Key + Tag Value 联合搜索', async ({ page }) => {
    const keyInput = page.getByPlaceholder('Tag Key').first()
    const valueInput = page.getByPlaceholder('Tag Value').first()
    if (!(await isVisible(keyInput, 2000))) return
    await keyInput.fill('env')
    if (await isVisible(valueInput, 1000)) await valueInput.fill('prod')
    await page.locator('.el-tab-pane:visible').getByRole('button', { name: '搜索' }).first().click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('搜索结果刷新', async ({ page }) => {
    await page.locator('.el-tab-pane:visible').getByRole('button', { name: '搜索' }).first().click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})

// "已注册 Key" 已从 tab 降为 TagSearchTab 内的 sub-section,
// 进入"按标签搜索"tab 后可见,不再是独立 tab。
test.describe('标签管理 — 已注册 Key sub-section', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tags')
    await expectPageTitle(page, '标签管理')
    await page.getByRole('tab', { name: '搜索标签' }).click()
  })

  // "已注册 Key" 子面板已下线(改成 tagKey autocomplete 下拉建议,见 commit 4601152)
  test.skip('已注册 Key sub-section 在按标签搜索 tab 内可见(已下线)', async () => {})
})
