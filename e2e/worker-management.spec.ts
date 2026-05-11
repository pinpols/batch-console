import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('worker management (Worker 管理)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Worker 管理页面可打开并展示 2 个标签页', async ({ page }) => {
    await page.goto('/workers/management')
    await expectPageTitle(page, 'Worker')
    await expect(page.getByRole('tab', { name: 'Worker 列表' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '文件渠道' })).toBeVisible()
  })

  test('Worker 列表标签页展示查询控件与表格', async ({ page }) => {
    await page.goto('/workers/management')
    await expect(page.getByRole('tab', { name: 'Worker 列表' })).toHaveClass(/is-active/)
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })

  test('文件渠道标签页展示表格', async ({ page }) => {
    await page.goto('/workers/management')
    await page.getByRole('tab', { name: '文件渠道' }).click()
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })

  test('旧路由重定向到 Worker 管理', async ({ page }) => {
    await page.goto('/workers/list')
    await expect(page).toHaveURL(/\/workers\/management/)

    await page.goto('/workers/channels')
    await expect(page).toHaveURL(/\/workers\/management/)
  })
})
