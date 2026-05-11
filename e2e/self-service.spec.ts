import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('self-service panel (自助服务)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('自助服务页面可打开并展示 4 个标签页', async ({ page }) => {
    await page.goto('/self-service')
    await expectPageTitle(page, '自助服务')
    await expect(page.getByRole('tab', { name: '配额与用量' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '配额变更' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '重跑申请' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '补偿申请' })).toBeVisible()
  })

  test('配额与用量标签展示刷新按钮与数据面板', async ({ page }) => {
    await page.goto('/self-service')
    await expect(page.getByRole('tab', { name: '配额与用量' })).toHaveClass(/is-active/)
    await expect(page.getByRole('button', { name: '刷新' }).first()).toBeVisible()
    await expect(page.getByText('当前配额')).toBeVisible()
  })

  test('配额变更标签展示表单', async ({ page }) => {
    await page.goto('/self-service')
    await page.getByRole('tab', { name: '配额变更' }).click()
    // 按钮文案改为"提交配额变更"
    await expect(page.getByRole('button', { name: /提交配额变更|提交申请/ })).toBeVisible()
  })

  test('重跑申请标签展示表单', async ({ page }) => {
    await page.goto('/self-service')
    await page.getByRole('tab', { name: '重跑申请' }).click()
    await expect(page.getByRole('button', { name: '提交重跑申请' })).toBeVisible()
  })

  test('补偿申请标签展示表单', async ({ page }) => {
    await page.goto('/self-service')
    await page.getByRole('tab', { name: '补偿申请' }).click()
    await expect(page.getByRole('button', { name: '提交补偿申请' })).toBeVisible()
  })

  test('旧路由重定向到自助服务', async ({ page }) => {
    await page.goto('/self-service/tenant')
    await expect(page).toHaveURL(/\/self-service/)

    await page.goto('/self-service/jobs')
    await expect(page).toHaveURL(/\/self-service/)
  })
})
