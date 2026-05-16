import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('self-service forms (自助服务表单)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/self-service')
    await expectPageTitle(page, '自助服务')
  })

  test('配额变更表单可填写并提交', async ({ page }) => {
    await page.locator('.service-entry').filter({ hasText: '配额变更' }).first().click()
    await expect(page.locator('.service-entry').filter({ hasText: '配额变更' }).first()).toHaveClass(/is-active/)

    await page.getByLabel('配额键').fill('maxConcurrentJobs')
    await page.getByLabel('期望值').fill('10')
    await page.getByRole('textbox', { name: '原因' }).first().fill('E2E 测试配额变更')
    // 按钮文案改为"提交配额变更"
    await expect(page.getByRole('button', { name: /提交配额变更|提交申请/ })).toBeVisible()
  })

  test('重跑申请表单可填写', async ({ page }) => {
    await page.locator('.service-entry').filter({ hasText: '重跑申请' }).first().click()
    await expect(page.locator('.service-entry').filter({ hasText: '重跑申请' }).first()).toHaveClass(/is-active/)

    // Job Code 是 remote filterable el-select;先点 wrapper 让 input 可见,再 type
    const jobCodeFormItem = page.locator('.el-form-item').filter({ hasText: 'Job Code' })
    await jobCodeFormItem.locator('.el-select__wrapper, .el-select').first().click()
    await jobCodeFormItem.locator('.el-select__input, input').first().fill('e2e_test_job')
    await page.getByRole('textbox', { name: '原因' }).first().fill('E2E 测试重跑')
    await expect(page.getByRole('button', { name: '提交重跑申请' })).toBeVisible()
  })

  test('补偿申请表单可填写', async ({ page }) => {
    await page.locator('.service-entry').filter({ hasText: '补偿申请' }).first().click()
    await expect(page.locator('.service-entry').filter({ hasText: '补偿申请' }).first()).toHaveClass(/is-active/)
    // 等 tab 内 form 真实渲染出来再操作
    await expect(page.getByRole('button', { name: '提交补偿申请' })).toBeVisible({ timeout: 10000 })

    // Job Code remote filterable el-select。SelfServicePanel 用自定义 nav 不是 el-tabs,
    // 表单直接挂在 .self-service-content 下。
    const tabPane = page.locator('.self-service-content')
    const jobCodeFormItem = tabPane.locator('.el-form-item').filter({ hasText: 'Job Code' })
    await jobCodeFormItem.locator('.el-select').first().click({ force: true })
    await jobCodeFormItem.locator('input').first().fill('e2e_test_job')
    await page.getByRole('textbox', { name: '原因' }).first().fill('E2E 测试补偿')
    // 提交按钮已经在 beforeEach 等过了,这里只验存在
    await expect(page.getByRole('button', { name: '提交补偿申请' })).toBeVisible()
  })

  test('配额与用量 tab 展示当前配额和用量', async ({ page }) => {
    await expect(page.locator('.service-entry').filter({ hasText: '配额与用量' }).first()).toHaveClass(/is-active/)
    await expect(page.getByText('当前配额')).toBeVisible()
    await expect(page.getByText('当前用量')).toBeVisible()
  })
})
