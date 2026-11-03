/**
 * 租户切换入口：
 * - 未选租户时横幅不再放第二个搜索框，“选择租户”按钮直接展开顶栏切换器。
 * - 输入 `ta` 时完全匹配的 `ta` 排在第一位。
 */
import { STORAGE_KEYS } from './support/storage'
import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/role-admin.json' })

test('未选租户时横幅按钮展开顶栏切换器，完全匹配的租户排第一', async ({ page }) => {
  await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.page-header').first()).toBeVisible({ timeout: 15_000 })
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEYS.tenantId)
  await page.reload()

  const banner = page.locator('.no-tenant-banner')
  await expect(banner).toBeVisible({ timeout: 15_000 })
  // 横幅里只有按钮，没有第二个租户搜索框
  await expect(banner.locator('.el-select')).toHaveCount(0)

  await banner.getByRole('button', { name: '选择租户' }).click()
  const popper = page
    .locator('.el-select__popper.tenant-select-popper--header')
    .filter({ visible: true })
  await expect(popper).toBeVisible()

  await page.keyboard.type('ta')
  const firstOption = popper.locator('.el-select-dropdown__item').first()
  await expect(firstOption.locator('.tenant-option__id')).toHaveText('ta', { timeout: 10_000 })
})
