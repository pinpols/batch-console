import { expect, test } from './support/app'
import { FRONTEND_ORIGIN } from './support/config'
import { enterDemoApp } from './support/app'
import { openDialog, cancelDialog, expectRequiredBlocked, expectMaxLength } from './support/form-helpers'

test.describe('API Key 表单校验', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: FRONTEND_ORIGIN,
    })
    await enterDemoApp(page)
    await page.goto('/system/api-keys')
  })

  test('全空提交被拦截 (keyName @NotBlank)', async ({ page }) => {
    const dialog = await openDialog(page, '新增 API Key')
    await expectRequiredBlocked(dialog)
    await cancelDialog(dialog)
  })

  test('keyName 超长被截断 (≤128)', async ({ page }) => {
    const dialog = await openDialog(page, '新增 API Key')
    await expectMaxLength(dialog, '名称', 128)
    await cancelDialog(dialog)
  })
})
