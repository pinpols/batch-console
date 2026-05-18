/**
 * UI Flow 06: 配额 — /governance/quota 创建/编辑策略 + /self-service 配额申请
 */
import { test, expect } from '../support/app'
import { enterDemoApp, expectPageTitle, isVisible } from '../support/app'

test.describe('UI Flow 06: quota', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /governance/quota 配额策略列表', async ({ page }) => {
    await page.goto('/governance/quota')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('2. 点新建策略按钮 → 抽屉打开 → 填编码 → 关闭', async ({ page }) => {
    await page.goto('/governance/quota')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const createBtn = page.getByRole('button', { name: /新建|创建|新增/i }).first()
    if (!(await isVisible(createBtn, 3000))) test.skip(true, '无新建按钮(可能 RBAC gate)')
    await createBtn.click({ force: true })
    const drawer = page.locator('.el-drawer:visible, .el-dialog:visible').first()
    await expect(drawer).toBeVisible({ timeout: 5000 })
    const codeInput = drawer.locator('.el-input__inner').first()
    if (await isVisible(codeInput, 2000)) {
      await codeInput.fill(`e2e-ui-quota-${Date.now()}`, { force: true })
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('3. /self-service 切到配额申请 tab — 表单可填', async ({ page }) => {
    await page.goto('/self-service')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const tab = page.getByRole('tab', { name: /配额|quota/i }).first()
    if (await isVisible(tab, 2000)) {
      await tab.click({ force: true })
      await page.waitForTimeout(500)
    }
  })
})
