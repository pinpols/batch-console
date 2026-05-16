import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

/**
 * /runs 全局聚合页 + ⌘K Command Palette 冒烟
 *
 * 覆盖范围:
 * - /runs 渲染:两个 section(作业 / 工作流)、status filter chips、刷新按钮
 * - status filter 切换会触发请求(用 API 拦截观察 query param)
 * - 行点击跳详情(只检查 URL pattern,不依赖具体数据)
 * - palette ⌘K 触发、菜单匹配、纯数字 jump、关闭键
 *
 * 故意只做冒烟级别(不依赖具体 fixture 数据),因为本批改动多但
 * UI 形态稳定,主要防回归"挂了"而不是回归"细节飘了"。
 */

test.describe('/runs 全部运行聚合页', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('/runs 渲染基本元素', async ({ page }) => {
    await page.goto('/runs', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/runs/)
    await expectPageTitle(page, '全部运行')
    // 两个 section 标题(作业 / 工作流)都在
    await expect(page.getByText('最近作业运行')).toBeVisible()
    await expect(page.getByText('最近工作流运行')).toBeVisible()
    // status filter chips 三个
    await expect(page.getByRole('radio', { name: '全部' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '运行中' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '失败' })).toBeVisible()
  })

  test('点"失败"chip 触发 instanceStatus=FAILED 请求', async ({ page }) => {
    // 先到达页面,避免拦截 enter 阶段的请求
    await page.goto('/runs', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    // 监听后续请求
    const reqPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/console/queries/instances') &&
        req.url().includes('instanceStatus=FAILED'),
      { timeout: 5000 },
    )
    await page.locator('.el-radio-button').filter({ hasText: '失败' }).first().click()
    const req = await reqPromise
    expect(req.url()).toContain('instanceStatus=FAILED')
  })

  test('点"运行中"chip 触发 runStatus=RUNNING 请求(工作流端)', async ({ page }) => {
    await page.goto('/runs', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    const reqPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/console/queries/workflow-runs') &&
        req.url().includes('runStatus=RUNNING'),
      { timeout: 5000 },
    )
    await page.locator('.el-radio-button').filter({ hasText: '运行中' }).first().click()
    const req = await reqPromise
    expect(req.url()).toContain('runStatus=RUNNING')
  })

  test('"查看全部"链接跳到对应实体的完整列表', async ({ page }) => {
    await page.goto('/runs', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    // 找作业 section 的"查看全部 →"
    const moreLink = page.getByRole('link', { name: /查看全部/ }).first()
    if ((await moreLink.count()) > 0) {
      await moreLink.click()
      await expect(page).toHaveURL(/\/monitor\/(job-instances|workflow-runs)/)
    }
  })
})

test.describe('⌘K Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Ctrl/Meta + K 打开 palette', async ({ page, browserName }) => {
    await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    const modifier = browserName === 'webkit' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+KeyK`)
    // palette 输入框可见
    const input = page.locator('.command-palette .el-input__inner').first()
    await expect(input).toBeVisible({ timeout: 3000 })
  })

  test('搜菜单项 + 回车跳转', async ({ page, browserName }) => {
    await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    const modifier = browserName === 'webkit' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+KeyK`)
    const input = page.locator('.command-palette .el-input__inner').first()
    await expect(input).toBeVisible({ timeout: 3000 })

    await input.fill('告警')
    // 等候列表渲染
    await page.waitForTimeout(200)
    // 第一项应是"告警"菜单(或包含告警)
    const firstItem = page.locator('.command-palette .cp-item').first()
    await expect(firstItem).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/observability\/alerts/, { timeout: 5000 })
  })

  test('纯数字触发"作业实例 #N"跳转项', async ({ page, browserName }) => {
    await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    const modifier = browserName === 'webkit' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+KeyK`)
    const input = page.locator('.command-palette .el-input__inner').first()
    await expect(input).toBeVisible({ timeout: 3000 })

    await input.fill('123')
    await page.waitForTimeout(200)
    // 快捷跳转 section 应出现
    await expect(page.getByText(/作业实例 #123/)).toBeVisible()
  })

  test('Escape 关闭 palette', async ({ page, browserName }) => {
    await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    const modifier = browserName === 'webkit' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+KeyK`)
    const input = page.locator('.command-palette .el-input__inner').first()
    await expect(input).toBeVisible({ timeout: 3000 })

    await page.keyboard.press('Escape')
    await expect(input).not.toBeVisible({ timeout: 3000 })
  })
})
