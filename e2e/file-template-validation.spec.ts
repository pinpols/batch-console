import { expect, test } from './support/app'
import { enterDemoApp } from './support/app'
import {
  openDialog,
  cancelDialog,
  expectRequiredBlocked,
  expectMaxLength,
  expectNumericRejection,
} from './support/form-helpers'

test.describe('file template 表单校验', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/files/templates')
  })

  test('全空提交被拦截', async ({ page }) => {
    const dialog = await openDialog(page, '新建文件模板')
    await expectRequiredBlocked(dialog)
    await cancelDialog(dialog)
  })

  test('templateCode 超长被截断', async ({ page }) => {
    const dialog = await openDialog(page, '新建文件模板')
    await expectMaxLength(dialog, '模板编码', 128)
    await cancelDialog(dialog)
  })

  test('version 数字框拒收字母', async ({ page }) => {
    const dialog = await openDialog(page, '新建文件模板')
    await expectNumericRejection(dialog, '版本')
    await cancelDialog(dialog)
  })
})

test.describe('file channel 表单校验', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/files/channels')
  })

  test('全空提交被拦截', async ({ page }) => {
    const dialog = await openDialog(page, '新建文件渠道')
    await expectRequiredBlocked(dialog)
    await cancelDialog(dialog)
  })

  test('channelCode 超长被截断', async ({ page }) => {
    const dialog = await openDialog(page, '新建文件渠道')
    await expectMaxLength(dialog, '渠道编码', 128)
    await cancelDialog(dialog)
  })

  test('timeoutSeconds 数字框拒收字母', async ({ page }) => {
    const dialog = await openDialog(page, '新建文件渠道')
    await expectNumericRejection(dialog, '超时(秒)')
    await cancelDialog(dialog)
  })
})
