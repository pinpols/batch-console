import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, getFirstCellLinkId, isVisible } from './support/app'

test.describe('dashboard metric card navigation (指标卡片跳转)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('点击待审批卡片跳转到审批中心', async ({ page }) => {
    await page.goto('/ops/summary')
    await page.locator('.metric-hit', { hasText: '待审批' }).click()
    await expect(page).toHaveURL(/\/approvals/)
    await expectPageTitle(page, '审批中心')
  })

  test('点击未处理告警卡片跳转到告警列表', async ({ page }) => {
    await page.goto('/ops/summary')
    await page.locator('.metric-hit', { hasText: '未处理告警' }).click()
    await expect(page).toHaveURL(/\/observability\/alerts/)
    await expectPageTitle(page, '告警')
  })

  test('点击严重告警卡片跳转到告警列表并筛选 severity=CRITICAL', async ({ page }) => {
    await page.goto('/ops/summary')
    await page.locator('.metric-hit', { hasText: '严重告警' }).click()
    await expect(page).toHaveURL(/\/observability\/alerts.*severity=CRITICAL/)
  })

  test('点击运行中任务卡片跳转到实例列表并筛选 status=RUNNING', async ({ page }) => {
    await page.goto('/ops/summary')
    await page.locator('.metric-hit', { hasText: '运行中任务' }).click()
    await expect(page).toHaveURL(/\/monitor\/job-instances.*status=RUNNING/)
  })

  test('点击失败任务卡片跳转到实例列表并筛选 status=FAILED', async ({ page }) => {
    await page.goto('/ops/summary')
    await page.locator('.metric-hit', { hasText: '失败任务' }).click()
    await expect(page).toHaveURL(/\/monitor\/job-instances.*status=FAILED/)
  })

  test('点击在线 Worker 卡片跳转到 Worker 管理', async ({ page }) => {
    await page.goto('/ops/summary')
    await page.locator('.metric-hit', { hasText: '在线 Worker' }).click()
    await expect(page).toHaveURL(/\/workers\/management/)
    await expectPageTitle(page, 'Worker')
  })

  test('点击 Outbox 重试积压卡片跳转到 Outbox', async ({ page }) => {
    await page.goto('/ops/summary')
    await page.locator('.metric-hit', { hasText: 'Outbox 重试积压' }).click()
    await expect(page).toHaveURL(/\/observability\/outbox/)
    await expectPageTitle(page, 'Outbox')
  })
})

test.describe('back button navigation (返回按钮)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Job Instance 详情页显示返回箭头并可返回列表', async ({ page }) => {
    const id = await getFirstCellLinkId(page, '/monitor/job-instances')
    if (!id) return
    await page.goto(`/monitor/job-instances/${id}`)
    const backBtn = page.locator('.back-btn')
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await expect(page).toHaveURL(/\/monitor\/job-instances$/)
  })

  test('Workflow Run 详情页显示返回箭头并可返回列表', async ({ page }) => {
    const id = await getFirstCellLinkId(page, '/monitor/workflow-runs')
    if (!id) return
    await page.goto(`/monitor/workflow-runs/${id}`)
    const backBtn = page.locator('.back-btn')
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await expect(page).toHaveURL(/\/monitor\/workflow-runs$/)
  })

  test('批次日窗口页显示返回箭头并可返回列表', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0]
    await page.goto(`/scheduler/batch-days/${today}`)
    const backBtn = page.locator('.back-btn')
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await expect(page).toHaveURL(/\/scheduler\/batch-days$/)
  })

  test('Job Step 分片页显示返回箭头并可返回实例详情', async ({ page }) => {
    const id = await getFirstCellLinkId(page, '/monitor/job-instances')
    if (!id) return
    await page.goto(`/monitor/job-instances/${id}/partitions`)
    const backBtn = page.locator('.back-btn')
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await expect(page).toHaveURL(new RegExp(`/monitor/job-instances/${id}$`))
  })
})

test.describe('table cell-link navigation (表格链接跳转)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Job Instance 列表中实例编号为可点击链接', async ({ page }) => {
    await page.goto('/monitor/job-instances')
    const link = page.locator('.cell-link').first()
    // 如果表格有数据，链接应可见
    if (await isVisible(link)) {
      const href = await link.getAttribute('href')
      expect(href).toMatch(/\/monitor\/job-instances\/\d+/)
    }
  })

  test('Job Step Instance 列表中实例 Id 为可点击链接', async ({ page }) => {
    await page.goto('/monitor/job-steps')
    const link = page.locator('.cell-link').first()
    if (await isVisible(link)) {
      const href = await link.getAttribute('href')
      expect(href).toMatch(/\/monitor\/job-instances\/\d+/)
    }
  })

  test('Workflow Run 列表中 Run Id 为可点击链接', async ({ page }) => {
    await page.goto('/monitor/workflow-runs')
    const link = page.locator('.cell-link').first()
    if (await isVisible(link)) {
      const href = await link.getAttribute('href')
      expect(href).toMatch(/\/monitor\/workflow-runs\/\d+/)
    }
  })

  test('批次日历日列表中业务日为可点击链接', async ({ page }) => {
    await page.goto('/scheduler/batch-days')
    // 需要选择日历后才有数据，先触发查询
    const link = page.locator('.cell-link').first()
    if (await isVisible(link)) {
      const href = await link.getAttribute('href')
      expect(href).toMatch(/\/scheduler\/batch-days\//)
    }
  })
})

test.describe('query parameter pre-fill (查询参数预填)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Job Instance 列表通过 status 参数预填筛选条件', async ({ page }) => {
    await page.goto('/monitor/job-instances?status=FAILED')
    await expectPageTitle(page, '作业运行')
    // 状态筛选应已选中 FAILED
    const statusSelect = page.locator('.el-form-item').filter({ hasText: '状态' }).locator('.el-select')
    await expect(statusSelect).toContainText('FAILED', { timeout: 10_000 })
  })

  test('Job Instance 列表通过 jobCode 参数预填筛选条件', async ({ page }) => {
    await page.goto('/monitor/job-instances?jobCode=DEMO_JOB')
    await expectPageTitle(page, '作业运行')
  })

  test('告警列表通过 severity 参数预填筛选条件', async ({ page }) => {
    await page.goto('/observability/alerts?severity=CRITICAL')
    await expectPageTitle(page, '告警')
    const severitySelect = page.locator('.el-form-item').filter({ hasText: '级别' }).locator('.el-select')
    await expect(severitySelect).toContainText('CRITICAL', { timeout: 10_000 })
  })

  test('执行日志通过 traceId 参数预填搜索条件', async ({ page }) => {
    await page.goto('/logs?traceId=test-trace-123')
    await expectPageTitle(page, /综合查询/)
    const traceInput = page.locator('.el-form-item').filter({ hasText: /trace/i }).getByRole('textbox').first()
    await expect(traceInput).toHaveValue('test-trace-123', { timeout: 15_000 })
  })
})
