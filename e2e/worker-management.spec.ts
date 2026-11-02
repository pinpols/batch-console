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
    await expect(page.locator('.ops-toolbar')).toContainText(
      /实时|刚刚更新|\d+ 秒前更新|\d+ 分钟前更新/,
    )
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

  test('页面加载图标与进度光带居中且使用品牌标识', async ({ page }) => {
    await page.route('**/api/console/queries/workers*', () => new Promise(() => {}))
    await page.goto('/workers/management')
    const spinner = page.locator('.wk-grid .el-loading-mask .el-loading-spinner')
    await expect(spinner).toBeVisible()

    const spinnerStyle = await spinner.evaluate((element) => {
      const mask = element.closest('.el-loading-mask')!.getBoundingClientRect()
      const bounds = element.getBoundingClientRect()
      const icon = getComputedStyle(element, '::before')
      const track = getComputedStyle(element, '::after')
      return {
        icon: icon.backgroundImage,
        animation: track.animationName,
        offset: Math.abs(bounds.top + bounds.height / 2 - (mask.top + mask.height / 2)),
      }
    })
    expect(spinnerStyle.icon).toContain('batch-mark-foreground.svg')
    expect(spinnerStyle.animation).toBe('brand-loading-travel')
    expect(spinnerStyle.offset).toBeLessThan(2)
  })

  test('小区域加载遮罩在明暗主题中保留完整图标和提示', async ({ page }) => {
    const layouts = await page.evaluate(() => {
      const host = document.createElement('div')
      host.style.cssText = 'position: relative; width: 240px; height: 50px;'
      const mask = document.createElement('div')
      mask.className = 'el-loading-mask'
      const spinner = document.createElement('div')
      spinner.className = 'el-loading-spinner'
      const circular = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      circular.classList.add('circular')
      const label = document.createElement('p')
      label.className = 'el-loading-text'
      label.textContent = 'Loading'
      spinner.append(circular, label)
      mask.append(spinner)
      host.append(mask)
      document.body.append(host)

      const wasDark = document.documentElement.classList.contains('dark')
      try {
        return [false, true].map((dark) => {
          document.documentElement.classList.toggle('dark', dark)
          const area = mask.getBoundingClientRect()
          const mark = spinner.getBoundingClientRect()
          const labelBounds = label.getBoundingClientRect()
          return {
            top: mark.top - area.top,
            bottom: area.bottom - labelBounds.bottom,
            iconSize: parseFloat(getComputedStyle(spinner, '::before').width),
            iconBackground: getComputedStyle(spinner, '::before').backgroundImage,
          }
        })
      } finally {
        document.documentElement.classList.toggle('dark', wasDark)
        host.remove()
      }
    })
    for (const layout of layouts) {
      expect(layout.top).toBeGreaterThanOrEqual(0)
      expect(layout.bottom).toBeGreaterThanOrEqual(0)
      expect(layout.iconSize).toBeGreaterThan(0)
    }
    expect(layouts[0].iconBackground).not.toBe(layouts[1].iconBackground)
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
