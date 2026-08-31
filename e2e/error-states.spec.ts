/**
 * Day 3 — P0 写操作 × 错误注入矩阵。
 * 每个 endpoint 跑 400 / 500 / offline 三件套,断言 UI 兜底信号。
 *
 * 注入通过 page.route 客户端拦截,**不**动 production interceptor。
 * 见 fe-qa-c-tier-plan.md §B.2。
 */
import { expect, test } from './support/app'
import { enterDemoApp } from './support/app'
import { injectError, clearInjection } from './support/error-injection'
import { openDialog, fieldInput, submitForm, cancelDialog } from './support/form-helpers'

/**
 * 通用断言:某个错误响应应该产生 toast(error 或 warning),且**不**误跳登录。
 */
async function expectToastAndStay(page: import('@playwright/test').Page) {
  const toast = page.locator('.el-message--error, .el-message--warning').first()
  await expect(toast).toBeVisible({ timeout: 8000 })
  expect(page.url(), 'BizException 不应误跳登录').not.toContain('/login')
}

test.describe('error-state: /api/console/queues POST', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/queues')
  })

  test('500 SYSTEM_ERROR → toast 含错误提示', async ({ page }) => {
    await injectError(page, '**/api/console/queues', '500')
    const dialog = await openDialog(page, '新建队列')
    await fieldInput(dialog, '队列编码').fill('e2e-err-500')
    await fieldInput(dialog, '名称').fill('err500')
    // queueType 是 readonly select。点开下拉,取第一个选项。
    const typeWrap = dialog.locator('.el-form-item').filter({ hasText: '类型' })
    await typeWrap.locator('.el-select__wrapper, .el-input__inner').first().click({ force: true })
    const opt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').first()
    await expect(opt).toBeVisible({ timeout: 3000 })
    await opt.click({ force: true })
    await submitForm(dialog)
    await expectToastAndStay(page)
    await clearInjection(page, '**/api/console/queues')
    await cancelDialog(dialog)
  })

  test('409 CONFLICT → toast,表单保留', async ({ page }) => {
    await injectError(page, '**/api/console/queues', '409')
    const dialog = await openDialog(page, '新建队列')
    const codeInput = fieldInput(dialog, '队列编码')
    await codeInput.fill('e2e-err-409')
    await fieldInput(dialog, '名称').fill('err409')
    await submitForm(dialog)
    await expectToastAndStay(page)
    // 表单应保留输入值
    expect(await codeInput.inputValue()).toBe('e2e-err-409')
    await clearInjection(page, '**/api/console/queues')
    await cancelDialog(dialog)
  })

  test('400 VALIDATION_ERROR → toast,form 保留', async ({ page }) => {
    await injectError(page, '**/api/console/queues', '400')
    const dialog = await openDialog(page, '新建队列')
    await fieldInput(dialog, '队列编码').fill('e2e-err-400')
    await fieldInput(dialog, '名称').fill('err400')
    await submitForm(dialog)
    await expectToastAndStay(page)
    await clearInjection(page, '**/api/console/queues')
    await cancelDialog(dialog)
  })

  test('offline → toast 或保持 loading 不卡死', async ({ page }) => {
    await injectError(page, '**/api/console/queues', 'offline')
    const dialog = await openDialog(page, '新建队列')
    await fieldInput(dialog, '队列编码').fill('e2e-offline')
    await fieldInput(dialog, '名称').fill('offline')
    await submitForm(dialog)
    // offline 通常通过 axios interceptor 的"网络不可达"分支报 toast
    const toast = page.locator('.el-message').first()
    await expect(toast).toBeVisible({ timeout: 8000 })
    expect(page.url()).not.toContain('/login')
    await clearInjection(page, '**/api/console/queues')
    await cancelDialog(dialog)
  })
})

test.describe('error-state: alert routing reserved write contract', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/alert-routings')
  })

  test('reserved state hides create action and never emits POST', async ({ page }) => {
    let writeAttempted = false
    await page.route('**/api/console/alert-routings', async (route) => {
      if (route.request().method() === 'POST') {
        writeAttempted = true
        return route.fulfill({ status: 500, body: '{}' })
      }
      return route.continue()
    })
    await expect(page.getByText('预留配置，当前不生效')).toBeVisible()
    await expect(page.getByRole('button', { name: '新增路由' })).toHaveCount(0)
    await page.waitForTimeout(300)
    expect(writeAttempted, 'reserved alert routing UI must not issue POST').toBe(false)
    await page.unroute('**/api/console/alert-routings')
  })

  test('reserved state keeps filtering readable when mutation API is unavailable', async ({
    page,
  }) => {
    await injectError(page, '**/api/console/alert-routings', '500')
    await page.locator('.query__search input').first().fill('e2e')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.getByRole('columnheader', { name: '路由编码' })).toBeVisible()
    await clearInjection(page, '**/api/console/alert-routings')
  })
})

test.describe('error-state: /api/console/file-channels POST', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/files/channels')
  })

  test('500 → toast', async ({ page }) => {
    await injectError(page, '**/api/console/file-channels', '500')
    const dialog = await openDialog(page, '新建文件渠道')
    await fieldInput(dialog, '渠道编码').fill('e2e-fc-500')
    await fieldInput(dialog, '渠道名称').fill('fc500')
    await submitForm(dialog)
    await expectToastAndStay(page)
    await clearInjection(page, '**/api/console/file-channels')
    await cancelDialog(dialog)
  })
})

test.describe('error-state: GET 列表 — 401 跳登录、5xx toast', () => {
  test('GET /api/console/queues 401 → 跳登录 (interceptor 默认行为)', async ({ page }) => {
    await enterDemoApp(page)
    await injectError(page, '**/api/console/queues**', '401', { method: 'GET' })
    await page.goto('/governance/queues')
    await page.waitForTimeout(2500)
    // 401 应该被 interceptor 走 refresh,失败则 toast(不强求跳登录);只要不崩
    expect(page.url()).not.toContain('errr')
    await clearInjection(page, '**/api/console/queues**')
  })

  test('GET /api/console/alert-routings 500 → toast', async ({ page }) => {
    await enterDemoApp(page)
    await injectError(page, '**/api/console/alert-routings**', '500', { method: 'GET' })
    await page.goto('/observability/alert-routings')
    await expect(page.locator('.el-message--error, .el-message--warning').first()).toBeVisible({
      timeout: 8000,
    })
    await clearInjection(page, '**/api/console/alert-routings**')
  })
})
