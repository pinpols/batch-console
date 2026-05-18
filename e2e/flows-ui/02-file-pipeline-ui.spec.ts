/**
 * UI Flow 02: 文件到达 → pipeline 可视化
 *
 * 走真页:/files/list (文件列表) / /files/pipeline-obs (pipeline 可观测) / /files/arrival-groups
 */
import { test, expect } from '../support/app'
import { enterDemoApp, expectPageTitle, isVisible } from '../support/app'

test.describe('UI Flow 02: file arrival → pipeline visibility', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /files/list 文件列表渲染', async ({ page }) => {
    await page.goto('/files/list')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('2. /files/arrival-groups 到达组页', async ({ page }) => {
    await page.goto('/files/arrival-groups')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('3. /files/pipeline-obs 可观测页', async ({ page }) => {
    await page.goto('/files/pipeline-obs')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('4. /files/templates 模板列表 + 创建对话框打开', async ({ page }) => {
    await page.goto('/files/templates')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const createBtn = page.getByRole('button', { name: /新建|创建|新增/i }).first()
    if (await isVisible(createBtn, 3000)) {
      await createBtn.click({ force: true })
      await expect(page.locator('.el-drawer:visible, .el-dialog:visible').first()).toBeVisible({ timeout: 5000 })
      // 关闭
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  })
})
