import { chromium, type FullConfig } from '@playwright/test'

/**
 * 全局登录：用真实账号走一次认证，将 cookie / localStorage 保存到
 * e2e/.auth/user.json，后续所有测试通过 storageState 复用该 session。
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:5173'
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${baseURL}/login`)
  await page.getByPlaceholder('请输入用户名').fill('admin')
  await page.getByPlaceholder('请输入密码').fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/ops\/summary/, { timeout: 20_000 })

  // 2026-05 角色重设计后:admin 登录 (tenantId='system') 不再自动落 tenant store,
  // 首次登录由 FirstTenantPickerDialog 强制选业务租户。e2e 用 storageState 复用 session,
  // 这里显式落一个业务租户 (ta),避免每个测试启动时被 picker dialog 拦住 sidebar 点击。
  await page.evaluate(() => localStorage.setItem('batch-console-tenant-id', 'ta'))

  await page.context().storageState({ path: 'e2e/.auth/user.json' })
  await browser.close()
}
