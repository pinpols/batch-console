import { expect, test } from '@playwright/test'
import { E2E_LOCALES, e2eText, installE2eLocale } from './support/i18n'
import { readBrowserStorage, STORAGE_KEYS } from './support/storage'

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })

for (const locale of E2E_LOCALES) {
  test(`主题按钮可通过键盘循环并提示状态 (${locale})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await installE2eLocale(page, locale)
    await page.addInitScript((keys) => {
      localStorage.setItem(keys.session, '1')
      localStorage.setItem(keys.tenantId, 'ta')
      localStorage.setItem(keys.onboardingDone, '1')
    }, STORAGE_KEYS)
    await page.route('**/api/console/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const data =
        path === '/api/console/auth/me'
          ? { username: 'theme-test', tenantId: 'ta', authorities: ['ROLE_ADMIN'] }
          : path === '/api/console/tenants'
            ? { items: [{ tenantId: 'ta', tenantName: 'Tenant A', status: 'ACTIVE' }], total: 1 }
            : { items: [], total: 0, pageNo: 1, pageSize: 15 }
      await route.fulfill({ status: 200, json: { code: 'SUCCESS', message: 'ok', data } })
    })
    await page.goto('/system/me')
    const label = (current: string, next: string) =>
      e2eText('nav.themeControlLabel', locale)
        .replace('{current}', e2eText(`nav.${current}`, locale))
        .replace('{next}', e2eText(`nav.${next}`, locale))
    const selected = (theme: string) =>
      e2eText('nav.themeSelected', locale).replace('{theme}', e2eText(`nav.${theme}`, locale))
    const theme = page.getByRole('button', { name: label('themeFollowSystem', 'themeDark') })
    await expect(theme).toBeVisible({ timeout: 30_000 })
    await theme.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: label('themeDark', 'themeLight') })).toBeFocused()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect.poll(() => readBrowserStorage(page, 'theme')).toBe('dark')
    await page.keyboard.press('Space')
    await expect(
      page.getByRole('button', { name: label('themeLight', 'themeFollowSystem') }),
    ).toBeFocused()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('button', { name: label('themeFollowSystem', 'themeDark') }),
    ).toBeFocused()
    await expect(page.getByText(selected('themeFollowSystem'))).toBeVisible()
    await expect.poll(() => readBrowserStorage(page, 'theme')).toBe('system')
    await page.reload()
    await expect(
      page.getByRole('button', { name: label('themeFollowSystem', 'themeDark') }),
    ).toBeVisible()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(
      page.getByRole('button', { name: label('themeFollowSystem', 'themeLight') }),
    ).toBeVisible()
  })
}
