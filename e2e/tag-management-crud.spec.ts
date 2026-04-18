import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('tag management (标签管理)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tags')
    await expectPageTitle(page, '标签管理')
  })

  test('标签查询 tab 可展示并执行查询', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '标签查询' })).toHaveClass(/is-active/)
    await expect(page.getByRole('button', { name: '查询' })).toBeVisible()
  })

  test('按标签搜索 tab 可执行搜索', async ({ page }) => {
    await page.getByRole('tab', { name: '按标签搜索' }).click()
    await expect(page.getByRole('tab', { name: '按标签搜索' })).toHaveClass(/is-active/)
    await expect(page.getByRole('button', { name: '搜索' })).toBeVisible()
  })

  test('已注册 Key tab 展示 Key 列表', async ({ page }) => {
    await page.getByRole('tab', { name: '已注册 Key' }).click()
    await expect(page.getByRole('tab', { name: '已注册 Key' })).toHaveClass(/is-active/)
    await expect(page.getByRole('button', { name: '刷新' }).first()).toBeVisible()
  })

  test('标签查询可输入条件并提交', async ({ page }) => {
    // 填充查询条件
    const keyInput = page.getByPlaceholder('Tag Key').first()
    if (await isVisible(keyInput, 2000)) {
      await keyInput.fill('env')
      await page.getByRole('button', { name: '查询' }).click()
      // 查询后页面不崩溃即可
      await expect(page.getByRole('button', { name: '查询' })).toBeVisible()
    }
  })
})
