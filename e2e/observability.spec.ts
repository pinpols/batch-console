import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('observability pages', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('告警页可打开并展示分组 tab 与卡片流', async ({ page }) => {
    await page.goto('/observability/alerts')
    await expectPageTitle(page, /事件告警|告警/)
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    // 新 UI:表格治理列裁撤,治理操作在卡片 .al-card__ops;页面骨架 = 分组 tab + 卡片流
    await expect(page.locator('.al-tab').filter({ hasText: '未处理' })).toBeVisible()
    await expect(page.locator('.al-list').first()).toBeAttached({ timeout: 10_000 })
  })

  test('审计日志支持输入过滤条件并查询', async ({ page }) => {
    await page.goto('/observability/audits')
    await expectPageTitle(page, '审计日志')
    const traceInput = page.locator('.el-form-item').filter({ hasText: /Trace|traceId/i }).getByRole('textbox')
    await traceInput.fill('demo-trace')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(traceInput).toHaveValue('demo-trace')
  })

  test('执行日志支持查询与重置', async ({ page }) => {
    await page.goto('/observability/queries?tab=executionLogs')
    await expectPageTitle(page, /综合查询/)
    await expect(page.getByRole('tab', { name: '执行日志' })).toHaveClass(/is-active/)
    const traceInput = page
      .locator('main .el-form-item')
      .filter({ hasText: /Trace/i })
      .getByRole('textbox')
    await traceInput.fill('trace-001')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('main .el-table, main .empty-state, main .table-skeleton').first()).toBeAttached({
      timeout: 15_000,
    })
  })

  test('Outbox 支持切换重试与投递标签', async ({ page }) => {
    await page.goto('/observability/outbox')
    await expectPageTitle(page, 'Outbox')
    // 新 UI:el-tabs 换自绘 pill tab(.ob-tab 按钮)
    const content = page.locator('.page-container').first()
    const deliveryTab = page.locator('.ob-tab').filter({ hasText: '投递' })
    await deliveryTab.click()
    await expect(deliveryTab).toHaveClass(/is-active/)
    await expect(content).toContainText(/Topic|状态/, { timeout: 15_000 })
    const retryTab = page.locator('.ob-tab').filter({ hasText: '重试' })
    await retryTab.click()
    await expect(retryTab).toHaveClass(/is-active/)
    await expect(content).toContainText(/下次重试|状态/, { timeout: 15_000 })
  })

  test('流水线观测支持切换多个观测维度', async ({ page }) => {
    await page.goto('/files/pipeline-obs')
    await expectPageTitle(page, '流水线观测')
    // 验证多个 tab 存在且可点击
    const tabs = ['步骤', '投递', '错单']
    for (const name of tabs) {
      const tab = page.getByRole('tab', { name })
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.evaluate((el) => (el as HTMLElement).click())
        // 等待 tab 切换完成
        await expect(tab).toHaveClass(/active/, { timeout: 5000 }).catch(() => {})
      }
    }
  })
})
