import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('ops diagnostic (运维诊断)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('运维诊断页面可打开并展示 2 个标签页', async ({ page }) => {
    await page.goto('/ops/diagnostic')
    await expectPageTitle(page, '运维诊断')
    await expect(page.getByRole('tab', { name: '运维工具箱' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '集群诊断' })).toBeVisible()
  })

  test('运维工具箱标签页展示 Kafka Lag 与 Outbox 面板', async ({ page }) => {
    await page.goto('/ops/diagnostic')
    await expect(page.getByRole('tab', { name: '运维工具箱' })).toHaveClass(/is-active/)
    await expect(page.getByText('Kafka Lag').first()).toBeVisible()
    await expect(page.getByText('Outbox').first()).toBeAttached()
  })

  test('集群诊断标签页展示多个诊断区块', async ({ page }) => {
    await page.goto('/ops/diagnostic')
    await page.getByRole('tab', { name: '集群诊断' }).click()
    await expect(page.getByText('集群概览')).toBeVisible()
  })

  test('旧路由重定向到运维诊断', async ({ page }) => {
    await page.goto('/ops/toolbox')
    await expect(page).toHaveURL(/\/ops\/diagnostic/)

    await page.goto('/system/cluster-diagnostic')
    await expect(page).toHaveURL(/\/ops\/diagnostic/)
  })
})
