import { STORAGE_KEYS } from './support/storage'
import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(STORAGE_KEYS.session, '1')
    localStorage.setItem(STORAGE_KEYS.tenantId, 'ta')
    localStorage.setItem(STORAGE_KEYS.locale, 'zh-CN')
    localStorage.setItem(STORAGE_KEYS.onboardingDone, '1')
  })
  await page.route('**/api/console/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path === '/api/console/auth/me'
      ? { username: 'batch-admin', tenantId: 'ta', authorities: ['ROLE_ADMIN'] }
      : path === '/api/console/tenants'
        ? { items: [{ tenantId: 'ta', tenantName: 'Tenant A', status: 'ACTIVE' }], total: 1, pageNo: 1, pageSize: 15 }
        : { items: [], total: 0, pageNo: 1, pageSize: 15 }
    await route.fulfill({ status: 200, json: { code: 'SUCCESS', message: 'ok', data } })
  })
})

test('批量开户预览修正后提交，关闭即清除一次性密码', async ({ page }, testInfo) => {
  await page.route('**/api/console/users/batch/preview', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        code: 'SUCCESS',
        message: 'ok',
        data: {
          previewToken: 'preview-test',
          version: 1,
          sourceDigest: 'sample',
          totalRows: 1,
          validRows: 0,
          rows: [{ rowNo: 2, tenantId: 'ta', username: 'alice', displayName: 'Alice', role: 'ROLE_TENANT_USER' }],
          issues: [{ rowNo: 2, username: 'alice', errorCode: 'USERNAME_EXISTS', message: 'USERNAME_EXISTS' }],
        },
      },
    })
  })
  await page.route('**/api/console/users/batch/preview/preview-test/patch', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        code: 'SUCCESS',
        message: 'ok',
        data: {
          previewToken: 'preview-test',
          version: 2,
          sourceDigest: 'sample',
          totalRows: 1,
          validRows: 1,
          rows: [{ rowNo: 2, tenantId: 'ta', username: 'alice2', displayName: 'Alice', role: 'ROLE_TENANT_USER' }],
          issues: [],
        },
      },
    })
  })
  await page.route('**/api/console/users/batch/apply/preview-test', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        code: 'SUCCESS',
        message: 'ok',
        data: {
          operationId: 'test-operation',
          accountCount: 1,
          credentials: [{ accountId: 42, tenantId: 'ta', username: 'alice2', initialPassword: 'sample-password-123' }],
        },
      },
    })
  })

  await page.goto('/system/user-accounts')
  await page.getByRole('button', { name: '批量开户' }).click()
  const dialog = page.getByRole('dialog', { name: '批量开户', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '确认开户' })).toHaveCount(0)

  await dialog.locator('input[type=file]').setInputFiles({
    name: 'accounts.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('preview-fixture'),
  })
  await expect(dialog.locator('.batch-desktop-table').getByText('用户名已存在')).toBeVisible()
  await expect(dialog.getByRole('button', { name: '确认开户' })).toBeDisabled()
  await testInfo.attach('batch-preview.png', { body: await dialog.screenshot(), contentType: 'image/png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(dialog.getByRole('button', { name: '下载模板' })).toBeVisible()
  await expect(dialog.locator('.batch-mobile-rows').getByText('用户名已存在')).toBeVisible()
  await expect(dialog.locator('.batch-mobile-rows').getByRole('button', { name: '修正' })).toBeVisible()
  await testInfo.attach('batch-preview-mobile.png', { body: await page.screenshot(), contentType: 'image/png' })
  await page.setViewportSize({ width: 1280, height: 720 })

  await dialog.getByRole('button', { name: '修正' }).click()
  const editor = page.getByRole('dialog', { name: '修正预览行' })
  await editor.getByRole('textbox', { name: '用户名' }).fill('alice2')
  await editor.getByRole('button', { name: '保存' }).click()
  await expect(dialog.getByRole('button', { name: '确认开户' })).toBeEnabled()
  await dialog.getByRole('button', { name: '确认开户' }).click()
  await page.getByRole('button', { name: '确定' }).click()
  await expect(dialog.locator('.batch-desktop-table').getByText('sample-password-123')).toBeVisible()
  await testInfo.attach('batch-result.png', { body: await dialog.screenshot(), contentType: 'image/png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(dialog.locator('.batch-mobile-rows').getByText('sample-password-123')).toBeVisible()
  await expect(dialog.locator('.batch-mobile-rows').getByRole('button', { name: '复制密码' })).toBeVisible()
  await testInfo.attach('batch-result-mobile.png', { body: await page.screenshot(), contentType: 'image/png' })
  await page.setViewportSize({ width: 1280, height: 720 })
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '关闭并清除初始密码？' })).toBeVisible()
  await page.getByRole('button', { name: '确认关闭' }).click()
  await page.getByRole('button', { name: '批量开户' }).click()
  await expect(page.getByRole('dialog', { name: '批量开户', exact: true }).getByText('sample-password-123')).toHaveCount(0)
  await page.getByRole('dialog', { name: '批量开户', exact: true }).getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: '切换英文' }).click()
  await page.getByRole('button', { name: 'Bulk provisioning' }).click()
  const englishDialog = page.getByRole('dialog', { name: 'Bulk account provisioning' })
  await expect(englishDialog.getByRole('button', { name: 'Upload and preview' })).toBeVisible()
  await englishDialog.locator('input[type=file]').setInputFiles({
    name: 'accounts.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('preview-fixture'),
  })
  await expect(englishDialog.locator('.batch-desktop-table').getByText('Username already exists')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(englishDialog.locator('.batch-mobile-rows').getByText('Username already exists')).toBeVisible()
  await expect.poll(() => englishDialog.evaluate((element) => {
    const dialogBox = element.querySelector('.el-dialog')
    return dialogBox ? Math.ceil(dialogBox.getBoundingClientRect().width) : 0
  })).toBeLessThanOrEqual(390)
  await page.waitForTimeout(350)
  await testInfo.attach('batch-preview-mobile-en.png', { body: await page.screenshot(), contentType: 'image/png' })
})
