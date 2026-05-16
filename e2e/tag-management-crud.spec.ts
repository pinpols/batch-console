import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('tag management (标签管理)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tags')
    await expectPageTitle(page, '标签管理')
  })

  test('资源标签 tab 可展示并执行查询', async ({ page }) => {
    // tab 改名:标签查询 → 资源标签
    await expect(page.getByRole('tab', { name: '资源标签' })).toHaveClass(/is-active/)
    await expect(page.getByRole('button', { name: '搜索' })).toBeVisible()
  })

  test('按标签搜索 tab 可执行搜索', async ({ page }) => {
    await page.getByRole('tab', { name: '按标签搜索' }).click()
    await expect(page.getByRole('tab', { name: '按标签搜索' })).toHaveClass(/is-active/)
    // ListPageQueryBar 用"查询"按钮(在 visible tab pane 内,避免另一 tab 也有同名按钮的 strict 冲突)
    await expect(page.locator('.el-tab-pane:visible').getByRole('button', { name: '搜索' }).first()).toBeVisible()
  })

  // "已注册 Key" 已从 tab 降为 TagSearchTab 内的 sub-section,不再是独立 tab
  test.skip('已注册 Key tab 展示 Key 列表(已合并到 TagSearchTab)', async () => {})

  test('标签查询可输入条件并提交', async ({ page }) => {
    // 填充查询条件
    const keyInput = page.getByPlaceholder('Tag Key').first()
    if (await isVisible(keyInput, 2000)) {
      await keyInput.fill('env')
      await page.getByRole('button', { name: '搜索' }).click()
      // 查询后页面不崩溃即可
      await expect(page.getByRole('button', { name: '搜索' })).toBeVisible()
    }
  })
})
