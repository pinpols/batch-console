/**
 * Day 2 — 队列/窗口/日历对话框表单校验子矩阵
 * 来源:fe-qa-c-tier-plan.md §B + 附录 A
 */
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

test.describe('queue 表单校验', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/queues')
  })

  test('全空提交被拦截', async ({ page }) => {
    const dialog = await openDialog(page, '新建队列')
    await expectRequiredBlocked(dialog)
    await cancelDialog(dialog)
  })

  test('queueCode 超过 128 字符被截断或报错', async ({ page }) => {
    const dialog = await openDialog(page, '新建队列')
    // 先填合法值,再测目标字段
    await fieldInput(dialog, '名称').fill('e2e-test-name')
    await expectMaxLength(dialog, '队列编码', 128)
    await cancelDialog(dialog)
  })

  test('maxRunningJobs 数字框拒收字母', async ({ page }) => {
    const dialog = await openDialog(page, '新建队列')
    await expectNumericRejection(dialog, '并发上限')
    await cancelDialog(dialog)
  })

  test('取消后再开,表单 reset', async ({ page }) => {
    const dialog1 = await openDialog(page, '新建队列')
    await fieldInput(dialog1, '队列编码').fill('e2e-residue-check')
    await cancelDialog(dialog1)
    await page.waitForTimeout(200)
    const dialog2 = await openDialog(page, '新建队列')
    const value = await fieldInput(dialog2, '队列编码').inputValue()
    expect(value).toBe('')
    await cancelDialog(dialog2)
  })
})

test.describe('window 表单校验', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/windows')
  })

  test('全空提交被拦截', async ({ page }) => {
    const dialog = await openDialog(page, '新建批次窗口')
    await expectRequiredBlocked(dialog)
    await cancelDialog(dialog)
  })

  test('windowCode 超长被截断', async ({ page }) => {
    const dialog = await openDialog(page, '新建批次窗口')
    await expectMaxLength(dialog, '窗口编码', 128)
    await cancelDialog(dialog)
  })
})

test.describe('calendar 表单校验', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/calendars')
  })

  test('全空提交被拦截', async ({ page }) => {
    const dialog = await openDialog(page, '新建业务日历')
    await expectRequiredBlocked(dialog)
    await cancelDialog(dialog)
  })

  test('calendarCode 超长被截断', async ({ page }) => {
    const dialog = await openDialog(page, '新建业务日历')
    await expectMaxLength(dialog, '日历编码', 128)
    await cancelDialog(dialog)
  })

  test('catchUpMaxDays 数字框拒收字母', async ({ page }) => {
    const dialog = await openDialog(page, '新建业务日历')
    await expectNumericRejection(dialog, 'Catch-up 最大天数')
    await cancelDialog(dialog)
  })
})
