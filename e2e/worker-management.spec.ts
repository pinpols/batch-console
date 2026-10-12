import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('worker management (Worker 管理)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Worker 管理页面可打开并展示 2 个标签页', async ({ page }) => {
    await page.goto('/workers/management')
    await expectPageTitle(page, 'Worker 管理')
    await expect(page.getByRole('tab', { name: 'Worker 列表' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '文件渠道' })).toBeVisible()
  })

  test('Worker 列表标签页展示查询控件与表格', async ({ page }) => {
    await page.goto('/workers/management')
    await expect(page.getByRole('tab', { name: 'Worker 列表' })).toHaveClass(/is-active/)
    await expect(page.getByRole('button', { name: '刷新' }).first()).toBeVisible()
    await expect(page.locator('.ops-toolbar')).toContainText(/实时|刚刚更新|\d+ 秒前更新|\d+ 分钟前更新/)
  })

  test('文件渠道仅在打开标签后加载', async ({ page }) => {
    let channelRequests = 0
    await page.route('**/api/console/queries/file-channels*', async (route) => {
      channelRequests += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'OK', data: { items: [], total: 0 } }),
      })
    })

    await page.goto('/workers/management')
    await expect(page.getByRole('tab', { name: 'Worker 列表' })).toHaveClass(/is-active/)
    expect(channelRequests).toBe(0)

    await page.getByRole('tab', { name: '文件渠道' }).click()
    await expect.poll(() => channelRequests).toBe(1)
  })

  test('Worker 查询失败时显示错误态而不是误报暂无注册', async ({ page }) => {
    await page.route('**/api/console/queries/workers*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'system error', data: null }),
      }),
    )
    await page.goto('/workers/management')
    await expect(page.getByText('Worker 数据加载失败')).toBeVisible()
    await expect(page.getByText('当前租户暂无 Worker 注册')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
  })

  test('页面加载图标将品牌蚂蚁置于旋转圆环中央', async ({ page }) => {
    await page.route('**/api/console/queries/workers*', () => new Promise(() => {}))
    await page.goto('/workers/management')
    const spinner = page.locator('.wk-grid .el-loading-mask .el-loading-spinner')
    await expect(spinner).toBeVisible()

    const spinnerStyle = await spinner.evaluate((element) => ({
      ring: getComputedStyle(element, '::before'),
      icon: getComputedStyle(element, '::after'),
      bounds: element.getBoundingClientRect(),
    }))
    expect(spinnerStyle.ring.borderRadius).toBe('50%')
    expect(spinnerStyle.ring.animationName).toBe('brand-loading-spin')
    expect(spinnerStyle.icon.backgroundImage).toMatch(/icon-192(?:-maskable)?\.png/)
    expect(spinnerStyle.icon.top).toBe('26px')
    expect(spinnerStyle.icon.left).toBe('26px')
    expect(spinnerStyle.bounds.width).toBe(52)
    expect(spinnerStyle.bounds.height).toBe(52)
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
