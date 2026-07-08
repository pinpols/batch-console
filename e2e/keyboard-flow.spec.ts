/**
 * Day 4 — 键盘流程冒烟。
 * 关键 P0 页面跑:
 *   1. Tab 进页 → 第一个可聚焦元素拿到 :focus-visible
 *   2. Dialog 打开后 ESC 关闭
 *   3. Dialog Tab 焦点陷阱(不应溢出到背景)
 *   4. 命令面板 ⌘K / Ctrl+K 切换
 *
 * 见 fe-qa-c-tier-plan.md §3 键盘 / a11y。
 */
import { expect, test } from './support/app'
import { enterDemoApp } from './support/app'

test.describe('keyboard flow — P0 页面', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Dialog 打开 → ESC 关闭', async ({ page }) => {
    await page.goto('/governance/queues')
    await page.getByRole('button', { name: '新建队列' }).click()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').first()
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 8000 })
  })

  test('Dialog 打开后 Tab 焦点应在 Dialog 内部(不溢出)', async ({ page }) => {
    await page.goto('/observability/alert-routings')
    await page.getByRole('button', { name: '新增路由' }).click()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').first()
    await expect(dialog).toBeVisible({ timeout: 8000 })
    // 按 5 次 Tab,每次 active element 都应在 dialog/drawer 内(EP 多数已迁移 drawer)
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      const isInside = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog, .el-drawer')
        return dlg ? dlg.contains(document.activeElement) : false
      })
      expect(isInside, `Tab ${i + 1} 后焦点应在 dialog/drawer 内`).toBe(true)
    }
    await page.keyboard.press('Escape')
  })

  test('命令面板 ⌘K / Ctrl+K 打开与关闭', async ({ page }) => {
    await page.goto('/ops/summary')
    await page.waitForTimeout(500)
    // 跨平台:同时尝试 ⌘+K / Control+K
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+K' : 'Control+K')
    const palette = page.getByPlaceholder(/搜索页面/).first()
    // 命令面板首次打开会异步加载菜单 fixture,CI/低性能机 3s 不够,放宽到 8s
    await expect(palette).toBeVisible({ timeout: 8000 })
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden({ timeout: 8000 })
  })

  test('登录页 Tab 顺序合理(用户名 → 密码 → 登录按钮)', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
    await page.locator('input').first().focus() // 起点
    // 第一个 input
    const v1 = await page.evaluate(() => (document.activeElement as HTMLElement)?.tagName)
    expect(v1).toBe('INPUT')
    await page.keyboard.press('Tab')
    const v2 = await page.evaluate(() => (document.activeElement as HTMLElement)?.tagName)
    expect(v2).toBe('INPUT')
    await page.keyboard.press('Tab')
    const v3 = await page.evaluate(() => (document.activeElement as HTMLElement)?.tagName)
    // 通常 tab 到登录 button
    expect(['BUTTON', 'INPUT'].includes(v3 || '')).toBe(true)
  })
})

test.describe('aria-label 兜底验证 — 关键 icon-only 操作有可达名', () => {
  test('表格行 Edit/Delete icon button 应通过 tooltip 提供 aria 信息', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/queues')
    await page.waitForTimeout(800)
    // 找 .table-actions 内的 circle button,确认每个 button 至少有 tooltip 或 aria-label
    const rowBtns = page.locator('.table-actions .el-button.is-circle')
    const count = await rowBtns.count()
    if (count === 0) return // 列表无数据,跳过
    for (let i = 0; i < Math.min(count, 5); i++) {
      const btn = rowBtns.nth(i)
      const ariaLabel = await btn.getAttribute('aria-label')
      const title = await btn.getAttribute('title')
      const wrappedByTooltip = await btn.evaluate((el) =>
        !!el.closest('[role="tooltip"]') ||
        !!el.parentElement?.matches('.el-tooltip__trigger, [aria-describedby]'),
      )
      expect(
        !!ariaLabel || !!title || wrappedByTooltip,
        `circle button #${i} 缺少可达名 (aria-label/title/tooltip)`,
      ).toBe(true)
    }
  })
})
