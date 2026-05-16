import { expect, test } from '@playwright/test'

/**
 * 登录页表单校验。覆盖全局 storageState,先 clear cookies 再访问 /login。
 */
test.describe('login form validation', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('全空提交不发请求', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
    let posted = false
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/auth/login')) posted = true
    })
    const loginBtn = page.getByRole('button', { name: /登\s*录|Sign\s*in/i }).first()
    await expect(loginBtn).toBeVisible({ timeout: 8000 })
    await loginBtn.click()
    await page.waitForTimeout(800)
    expect(posted, '全空 submit 不应触发 /auth/login POST').toBe(false)
  })

  test('错误密码触发 error toast', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
    await page.getByPlaceholder(/用户名|username/i).first().fill('admin')
    await page.getByPlaceholder(/密码|password/i).first().fill('wrong-password-xyz')
    await page.getByRole('button', { name: /登\s*录|Sign\s*in/i }).first().click()
    const toast = page.locator('.el-message--error, .el-message--warning').first()
    await expect(toast).toBeVisible({ timeout: 8000 })
  })
})
