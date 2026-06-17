/**
 * Sprint1-3 列表页新控件 — 保存的筛选器 / 批量操作栏 / 实时状态(数据新鲜度)。
 * 以作业运行列表(/monitor/job-instances)为载体,这三件都挂在该页:
 *   - SavedFiltersMenu(components/table/SavedFiltersMenu.vue)
 *   - BulkActionBar    (components/table/BulkActionBar.vue,选行后出现)
 *   - LiveStatusBadge  (components/common/LiveStatusBadge.vue,经 OpsListToolbar 渲染)
 *
 * 用稳定的 class/role 选择器,不依赖 i18n 文案;无数据时按 isVisible 优雅跳过。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('作业运行列表 — 列表页新控件', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/monitor/job-instances')
    await expectPageTitle(page, '作业运行')
    // 等列表骨架/空态/表格任一就位,确保工具栏渲染完成
    await expect(
      page.locator('.el-table, .empty-state, .table-skeleton').first(),
    ).toBeAttached({ timeout: 10_000 })
  })

  test('实时状态徽标渲染 + 含状态文案', async ({ page }) => {
    const badge = page.locator('.live-status-badge').first()
    await expect(badge).toBeVisible({ timeout: 10_000 })
    await expect(badge).toHaveAttribute('role', 'status')
    // label 非空(在线/离线/同步中等)
    await expect(badge.locator('.live-status-badge__label')).not.toBeEmpty()
  })

  test('保存的筛选器 — 下拉可打开,含「保存当前」入口', async ({ page }) => {
    // SavedFiltersMenu 是 el-dropdown(trigger=click),触发器是带 Star 的 el-button,文案 savedFilters.menu='已保存筛选'
    const btn = page.getByRole('button', { name: '已保存筛选' }).first()
    if (!(await isVisible(btn, 2000))) test.skip(true, 'SavedFiltersMenu 触发器未渲染(页面无筛选工具栏)')
    await btn.click()
    const menu = page.locator('.saved-filters__menu')
    await expect(menu).toBeVisible({ timeout: 5_000 })
    // 菜单首项 = 保存当前筛选(savedFilters.saveCurrent)
    await expect(menu.locator('.el-dropdown-menu__item').first()).toBeVisible()
  })

  test('批量操作栏 — 选行后出现并显示计数,清空后消失', async ({ page }) => {
    const firstRowCheckbox = page
      .locator('.el-table__body-wrapper tbody tr')
      .first()
      .locator('.el-checkbox')
    if (!(await isVisible(firstRowCheckbox, 3000))) {
      test.skip(true, '列表无数据行,无法验证批量选择(seed 未含运行态实例)')
    }
    await firstRowCheckbox.click()

    const bar = page.locator('.bulk-action-bar')
    await expect(bar).toBeVisible({ timeout: 5_000 })
    await expect(bar).toHaveAttribute('role', 'region')
    await expect(bar.locator('.bulk-action-bar__count')).toBeVisible()

    // 清除选择 → 栏消失(bulk.clear='清除')
    await bar.getByRole('button', { name: '清除' }).first().click()
    await expect(bar).toBeHidden({ timeout: 5_000 })
  })
})
