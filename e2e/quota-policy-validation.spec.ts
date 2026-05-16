import { expect, test } from './support/app'
import { enterDemoApp } from './support/app'
import {
  openDialog,
  cancelDialog,
  expectRequiredBlocked,
  expectMaxLength,
  expectNumericRejection,
  fieldInput,
} from './support/form-helpers'

test.describe('quota policy 表单校验', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/quota')
  })

  test('全空提交被拦截', async ({ page }) => {
    const dialog = await openDialog(page, '新增策略')
    await expectRequiredBlocked(dialog)
    await cancelDialog(dialog)
  })

  test('policyCode 超长被截断', async ({ page }) => {
    const dialog = await openDialog(page, '新增策略')
    await expectMaxLength(dialog, '策略编码', 128)
    await cancelDialog(dialog)
  })

  test('maxRunningJobsPerTenant 数字框拒收字母', async ({ page }) => {
    const dialog = await openDialog(page, '新增策略')
    await expectNumericRejection(dialog, '租户并发上限')
    await cancelDialog(dialog)
  })

  test('取消后 reset', async ({ page }) => {
    const dialog1 = await openDialog(page, '新增策略')
    await fieldInput(dialog1, '策略编码').fill('e2e-residue')
    await cancelDialog(dialog1)
    await page.waitForTimeout(200)
    const dialog2 = await openDialog(page, '新增策略')
    expect(await fieldInput(dialog2, '策略编码').inputValue()).toBe('')
    await cancelDialog(dialog2)
  })
})
