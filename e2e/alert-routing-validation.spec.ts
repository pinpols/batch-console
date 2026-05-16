import { expect, test } from './support/app'
import { enterDemoApp } from './support/app'
import {
  openDialog,
  cancelDialog,
  expectRequiredBlocked,
  expectMaxLength,
  fieldInput,
} from './support/form-helpers'

test.describe('alert routing 表单校验', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/alert-routings')
  })

  test('全空提交被拦截 (@NotBlank: routeCode/team/severity/receiver)', async ({ page }) => {
    const dialog = await openDialog(page, '新增路由')
    await expectRequiredBlocked(dialog)
    await cancelDialog(dialog)
  })

  test('routeCode 超长被截断', async ({ page }) => {
    const dialog = await openDialog(page, '新增路由')
    await expectMaxLength(dialog, '路由编码', 128)
    await cancelDialog(dialog)
  })

  test('receiver 超长被截断 (≤256)', async ({ page }) => {
    const dialog = await openDialog(page, '新增路由')
    await fieldInput(dialog, '路由编码').fill('e2e-r')
    await fieldInput(dialog, '团队').fill('e2e')
    await expectMaxLength(dialog, '接收人', 256)
    await cancelDialog(dialog)
  })
})
