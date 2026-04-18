import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('self-service forms (自助服务表单)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/self-service')
    await expectPageTitle(page, '自助服务')
  })

  test('配额变更表单可填写并提交', async ({ page }) => {
    await page.getByRole('tab', { name: '配额变更' }).click()
    await expect(page.getByRole('tab', { name: '配额变更' })).toHaveClass(/is-active/)

    await page.getByLabel('配额键').fill('maxConcurrentJobs')
    await page.getByLabel('期望值').fill('10')
    await page.getByRole('textbox', { name: '原因' }).first().fill('E2E 测试配额变更')
    await expect(page.getByRole('button', { name: '提交申请' })).toBeEnabled()
  })

  test('重跑申请表单可填写', async ({ page }) => {
    await page.getByRole('tab', { name: '重跑申请' }).click()
    await expect(page.getByRole('tab', { name: '重跑申请' })).toHaveClass(/is-active/)

    await page.getByRole('textbox', { name: 'Job Code' }).first().fill('e2e_test_job')
    await page.getByRole('textbox', { name: '原因' }).first().fill('E2E 测试重跑')
    await expect(page.getByRole('button', { name: '提交重跑申请' })).toBeVisible()
  })

  test('补偿申请表单可填写', async ({ page }) => {
    await page.getByRole('tab', { name: '补偿申请' }).click()
    await expect(page.getByRole('tab', { name: '补偿申请' })).toHaveClass(/is-active/)

    await page.getByRole('textbox', { name: 'Job Code' }).first().fill('e2e_test_job')
    await page.getByRole('textbox', { name: '原因' }).first().fill('E2E 测试补偿')
    await expect(page.getByRole('button', { name: '提交补偿申请' })).toBeVisible()
  })

  test('配额与用量 tab 展示当前配额和用量', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '配额与用量' })).toHaveClass(/is-active/)
    await expect(page.getByText('当前配额')).toBeVisible()
    await expect(page.getByText('当前用量')).toBeVisible()
  })
})
