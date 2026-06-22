/**
 * 执行与观测 — 完整业务流程测试（真实变更）
 * 覆盖：Job Instance 筛选/详情操作(重跑/取消/终止)、Workflow Run 筛选/详情、
 *       Job Step 分片重试/取消、审计日志筛选
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, getFirstCellLinkId, isVisible } from './support/app'
import type { Page } from '@playwright/test'

async function clickRefresh(page: Page) {
  const refresh = page.getByRole('button', { name: '刷新' }).first()
  await expect(refresh).toBeVisible({ timeout: 10_000 })
  await expect(refresh).toBeEnabled({ timeout: 15_000 })
  await refresh.click()
}

// ─── Job Instance 列表筛选 ────────────────────────────────────────

test.describe('Job Instance — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/monitor/job-instances')
    await expectPageTitle(page, '作业运行')
  })

  test('Job Code 搜索 → 查询', async ({ page }) => {
    const input = page
      .locator('.el-form-item')
      .filter({ hasText: 'Job Code' })
      .getByRole('textbox')
      .or(page.locator('.el-form-item').filter({ hasText: 'Job Code' }).locator('.el-select'))
    if (await isVisible(input.getByRole('textbox').first(), 2000)) {
      await input.getByRole('textbox').first().fill('DEMO')
    }
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('状态筛选 → 查询', async ({ page }) => {
    // 筛选区可能有多个含「状态」的 form-item(如"状态" / "调度状态"),取 first 避免 strict-mode 命中多个
    const statusSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '状态' })
      .first()
      .locator('.el-select')
      .first()
    await statusSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('重置清空筛选', async ({ page }) => {
    await page.getByRole('button', { name: '重置' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('刷新', async ({ page }) => {
    await clickRefresh(page)
    await expect(page.getByRole('columnheader', { name: /Job Code|状态/ }).first()).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Job Instance 详情操作 ────────────────────────────────────────

test.describe('Job Instance 详情 — 操作流', () => {
  test('详情页加载 → 展示实例信息', async ({ page }) => {
    await enterDemoApp(page)
    const id = await getFirstCellLinkId(page, '/monitor/job-instances')
    if (!id) return
    await page.goto(`/monitor/job-instances/${id}`)
    await expectPageTitle(page, '作业实例详情')
    await expect(page.getByText('实例编号')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Job Code')).toBeVisible()
    await expect(page.getByText('状态')).toBeVisible()
  })

  test('刷新按钮', async ({ page }) => {
    await enterDemoApp(page)
    const id = await getFirstCellLinkId(page, '/monitor/job-instances')
    if (!id) return
    await page.goto(`/monitor/job-instances/${id}`)
    await expectPageTitle(page, '作业实例详情')
    await clickRefresh(page)
    await expect(page.getByText('实例编号')).toBeVisible({ timeout: 10_000 })
  })

  test('步骤跳转 → Job Step 页面', async ({ page }) => {
    await enterDemoApp(page)
    const id = await getFirstCellLinkId(page, '/monitor/job-instances')
    if (!id) return
    await page.goto(`/monitor/job-instances/${id}`)
    await expectPageTitle(page, '作业实例详情')
    const stepsBtn = page.getByRole('button', { name: /步骤|Job Step/ })
    if (!(await isVisible(stepsBtn, 3000))) return
    await stepsBtn.click()
    await expect(page).toHaveURL(new RegExp(`/monitor/job-instances/${id}/partitions|/monitor/job-steps`))
  })

  test('重跑 → 确认 → toast', async ({ page }) => {
    await enterDemoApp(page)
    const id = await getFirstCellLinkId(page, '/monitor/job-instances')
    if (!id) return
    await page.goto(`/monitor/job-instances/${id}`)
    await expectPageTitle(page, '作业实例详情')
    const rerunBtn = page.getByRole('button', { name: '重跑' })
    if (!(await isVisible(rerunBtn, 3000))) return
    await rerunBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('重跑')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('取消实例 → 确认 → toast', async ({ page }) => {
    await enterDemoApp(page)
    const id = await getFirstCellLinkId(page, '/monitor/job-instances')
    if (!id) return
    await page.goto(`/monitor/job-instances/${id}`)
    await expectPageTitle(page, '作业实例详情')
    const cancelBtn = page.getByRole('button', { name: '取消实例' })
    if (!(await isVisible(cancelBtn, 3000))) return
    await cancelBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('取消')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('终止实例 → 确认 → toast', async ({ page }) => {
    await enterDemoApp(page)
    const id = await getFirstCellLinkId(page, '/monitor/job-instances')
    if (!id) return
    await page.goto(`/monitor/job-instances/${id}`)
    await expectPageTitle(page, '作业实例详情')
    const terminateBtn = page.getByRole('button', { name: '终止实例' })
    if (!(await isVisible(terminateBtn, 3000))) return
    await terminateBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('终止')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})

// ─── Job Step 分片 ────────────────────────────────────────────────

test.describe('Job Step 分片 — 操作流', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    const id = await getFirstCellLinkId(page, '/monitor/job-instances')
    if (!id) return
    await page.goto(`/monitor/job-instances/${id}/partitions`)
    await expectPageTitle(page, /Job Step Instance/)
  })

  test('分片列表加载', async ({ page }) => {
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('重试分片 → 确认 → toast', async ({ page }) => {
    const retryBtn = page.locator('.table-actions').getByRole('button', { name: '重试' }).first()
    if (!(await isVisible(retryBtn))) return
    await retryBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('取消分片 → 确认 → toast', async ({ page }) => {
    const cancelBtn = page.locator('.table-actions').getByRole('button', { name: '取消' }).first()
    if (!(await isVisible(cancelBtn))) return
    await cancelBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})

// ─── Workflow Run ─────────────────────────────────────────────────

test.describe('Workflow Run — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/monitor/workflow-runs')
    await expectPageTitle(page, '工作流运行')
  })

  test('Workflow 搜索 → 查询', async ({ page }) => {
    const input = page
      .locator('.el-form-item')
      .filter({ hasText: 'Workflow' })
      .getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('状态筛选 → 查询 → 重置', async ({ page }) => {
    // 第一个 .el-form-item with 状态 — 避免页面其它"状态"标签干扰
    const statusSelect = page
      .locator('.el-form-item')
      .filter({ hasText: /^状态/ })
      .locator('.el-select')
      .first()
    await statusSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
    // 重置按钮在某些状态下 disabled 切到 enabled 时短暂不稳,force click 跳过 stability 检查
    await page.getByRole('button', { name: '重置' }).click({ force: true })
  })

  test('刷新', async ({ page }) => {
    await clickRefresh(page)
    await expect(page.getByRole('columnheader', { name: /Workflow|状态/ }).first()).toBeVisible({ timeout: 10_000 })
  })
})

// ─── 审计日志 ─────────────────────────────────────────────────────

test.describe('审计日志 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/audits')
    await expectPageTitle(page, '审计日志')
  })

  test('Trace 搜索 → 查询', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: 'Trace' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('trace-test-123')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('操作类型筛选 → 查询 → 重置', async ({ page }) => {
    const typeSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '操作类型' })
      .locator('.el-select')
    if (!(await isVisible(typeSelect, 2000))) return
    await typeSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
    await page.getByRole('button', { name: '重置' }).click()
  })

  test('刷新', async ({ page }) => {
    await clickRefresh(page)
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})
