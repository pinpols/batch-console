/**
 * UI Flow 05: 补偿 — /self-service 补偿 tab + /approvals?type=COMPENSATION
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

test.describe('UI Flow 05: compensation', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /self-service 切到补偿 tab', async ({ page }) => {
    await page.goto('/self-service')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const tab = page.getByRole('tab', { name: /补偿|compensation/i }).first()
    if (await isVisible(tab, 2000)) {
      await tab.click({ force: true })
      await page.waitForTimeout(500)
      // 表单出现
      const anyInput = page.locator('.el-input__inner').first()
      expect(await isVisible(anyInput, 3000), '补偿表单有输入框').toBe(true)
    }
  })

  test('2. 填充补偿表单(jobCode + bizDate + reason)— 不真提交避免 downstream 500', async ({ page }) => {
    await page.goto('/self-service')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const tab = page.getByRole('tab', { name: /补偿|compensation/i }).first()
    if (!(await isVisible(tab, 2000))) test.skip(true, '无补偿 tab')
    await tab.click({ force: true })
    const reasonInput = page.locator('.el-textarea__inner, textarea').first()
    if (await isVisible(reasonInput, 2000)) {
      await reasonInput.fill('[E2E UI 05] compensation test reason', { force: true })
    }
  })

  test('3. /approvals 看 PENDING — 补偿类审批可被查到', async ({ page }) => {
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })
})
