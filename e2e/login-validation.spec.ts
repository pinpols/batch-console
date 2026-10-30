import { STORAGE_KEYS } from './support/storage'
import { FRONTEND_BASE_URL } from './support/config'
import { E2E_DEFAULT_LOCALE, installE2eLocale } from './support/i18n'
import { expect, test } from '@playwright/test'

/**
 * 登录页表单校验。覆盖全局 storageState,先 clear cookies 再访问 /login。
 */
test.describe('login form validation', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await installE2eLocale(page)
  })

  test('OIDC 启用时显示企业登录入口', async ({ page, context }) => {
    await context.clearCookies()
    await page.route('**/api/console/auth/oidc/provider', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'success',
          data: { enabled: true, registrationId: 'pilot-tenant' },
          meta: {},
        }),
      }),
    )
    await page.goto('/login', { waitUntil: 'networkidle' })

    await expect(page.getByRole('button', { name: '企业登录' })).toBeVisible({ timeout: 8000 })
  })

  test('OIDC callback 错误重定向留在前端 origin', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/login/oauth2/code/pilot-tenant?error=access_denied', {
      waitUntil: 'networkidle',
    })

    await expect(page).toHaveURL(/\/login\?authError=oidc$/)
  })

  test('全空提交不发请求', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/login', { waitUntil: 'networkidle' })
    let posted = false
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/auth/login')) posted = true
    })
    const loginBtn = page.getByRole('button', { name: /登\s*录/ }).first()
    await expect(loginBtn).toBeVisible({ timeout: 8000 })
    await loginBtn.click()
    // 负观察窗口：确认空表单校验后未异步发起登录请求。
    await page.waitForTimeout(800)
    expect(posted, '全空 submit 不应触发 /auth/login POST').toBe(false)
  })

  test('错误密码触发 error toast', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page
      .getByPlaceholder(/用户名/)
      .first()
      .fill('admin')
    await page
      .getByPlaceholder(/密码/)
      .first()
      .fill('wrong-password-xyz')
    await page
      .getByRole('button', { name: /登\s*录/ })
      .first()
      .click()
    const toast = page.locator('.el-message--error, .el-message--warning').first()
    await expect(toast).toBeVisible({ timeout: 8000 })
  })

  test('登录页语言切换同步更新表单文案', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.evaluate(
      ({ localeKey, locale }) => localStorage.setItem(localeKey, locale),
      { localeKey: STORAGE_KEYS.locale, locale: E2E_DEFAULT_LOCALE },
    )
    await page.reload({ waitUntil: 'networkidle' })

    const localeToggle = page.getByRole('button', { name: '切换语言' })
    await expect(localeToggle).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: 'Switch language' }).click()

    await expect(page.getByRole('heading', { name: 'Sign in to the console' })).toBeVisible()
    await expect(page.getByPlaceholder('Enter tenant username')).toBeVisible()
    await expect(page.getByPlaceholder('Enter tenant password')).toBeVisible()

    await localeToggle.click()
    await expect(page.getByRole('heading', { name: '登录控制台' })).toBeVisible()
    await expect(page.getByPlaceholder('请输入租户账号')).toBeVisible()
    await expect(page.getByPlaceholder('请输入租户密码')).toBeVisible()
  })
})
