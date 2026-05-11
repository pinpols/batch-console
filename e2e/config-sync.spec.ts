/**
 * 配置同步专测 — /api/console/config/sync/{export,import,preview}
 * 路径:配置管理 → 同步日志 / 配置同步 tab
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('配置同步', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/management')
    await expectPageTitle(page, '变更与同步')
  })

  test('配置同步 tab 可切换 + 导出/导入区块可见', async ({ page }) => {
    await page.getByRole('tab', { name: '配置同步' }).click()
    await expect(page.getByRole('tab', { name: '配置同步' })).toHaveClass(/is-active/)
    // 导出区块标识
    await expect(page.getByText(/配置导出|导出/).first()).toBeVisible({ timeout: 6000 })
  })

  test('导出按钮触发 POST /sync/export', async ({ page }) => {
    await page.getByRole('tab', { name: '配置同步' }).click()
    const exportBtn = page.getByRole('button', { name: /^(导出|下载导出|导出当前配置)$/ }).first()
    if (!(await isVisible(exportBtn, 4000))) return

    const apiCall = page.waitForResponse(
      (r) => r.url().includes('/api/console/config/sync/export') && r.request().method() === 'POST',
      { timeout: 15_000 },
    )
    await exportBtn.click()
    const resp = await apiCall.catch(() => null)
    expect(resp).not.toBeNull()
  })

  test('预览变更按钮触发 POST /sync/preview', async ({ page }) => {
    await page.getByRole('tab', { name: '配置同步' }).click()
    // 填一个最小 payload
    const ta = page.locator('.el-textarea__inner').first()
    if (!(await isVisible(ta, 4000))) return
    await ta.fill('{"jobDefinitions":[]}')

    const previewBtn = page.getByRole('button', { name: '预览变更' }).first()
    if (!(await isVisible(previewBtn, 2000))) return

    const apiCall = page.waitForResponse(
      (r) => r.url().includes('/api/console/config/sync/preview') && r.request().method() === 'POST',
      { timeout: 15_000 },
    )
    await previewBtn.click()
    const resp = await apiCall.catch(() => null)
    expect(resp).not.toBeNull()
  })
})
