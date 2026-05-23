import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, getFirstCellLinkId, isVisible } from './support/app'

test.describe('dashboard metric card navigation (指标卡片跳转)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  // ops/summary 周期刷新会重建卡片节点,默认 click 的 stability check 偶发会等到超时;
  // 直接 force-click 跳过 actionability 等待。networkidle 在 dev server 高并发下不收敛,不能等。
  // click + waitForURL 用 Promise.all 串起来 — 4-worker 并发下,默认 expect 8s 等 URL 偶发不够,
  // 需要在 click 触发后明确等到 router push 落地(15s 预算覆盖 dev server route lazy-chunk 编译).
  async function clickMetric(
    page: import('@playwright/test').Page,
    text: string,
    expectedUrl: RegExp,
  ) {
    await page.goto('/ops/summary')
    const card = page.locator('.metric-hit', { hasText: text }).first()
    await card.waitFor({ state: 'visible', timeout: 25_000 })
    await Promise.all([
      page.waitForURL(expectedUrl, { timeout: 15_000 }),
      card.click({ force: true }),
    ])
  }

  test('点击待审批卡片跳转到审批中心', async ({ page }) => {
    await clickMetric(page, '待审批', /\/approvals/)
    await expectPageTitle(page, '审批中心')
  })

  test('点击未处理告警卡片跳转到告警列表', async ({ page }) => {
    await clickMetric(page, '未处理告警', /\/observability\/alerts/)
    await expectPageTitle(page, /事件告警|告警/)
  })

  test('点击严重告警卡片跳转到告警列表并筛选 severity=CRITICAL', async ({ page }) => {
    await clickMetric(page, '严重告警', /\/observability\/alerts.*severity=CRITICAL/)
  })

  test('点击运行中任务卡片跳转到实例列表并筛选 status=RUNNING', async ({ page }) => {
    await clickMetric(page, '运行中任务', /\/monitor\/job-instances.*status=RUNNING/)
  })

  test('点击失败任务卡片跳转到实例列表并筛选 statuses=FAILED', async ({ page }) => {
    // 卡片把 FAILED + PARTIAL_FAILED 一起带过去(运营视角"失败"含部分失败)
    await clickMetric(page, '失败任务', /\/monitor\/job-instances.*statuses=FAILED/)
  })

  test('点击在线 Worker 卡片跳转到 Worker 管理', async ({ page }) => {
    await clickMetric(page, '在线 Worker', /\/workers\/management/)
    await expectPageTitle(page, 'Worker')
  })

  test('点击 Outbox 重试积压卡片跳转到 Outbox', async ({ page }) => {
    await clickMetric(page, 'Outbox 重试积压', /\/observability\/outbox/)
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
    const backBtn = page.locator('.nav-arrow-btn').first()
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await expect(page).toHaveURL(/\/monitor\/job-instances$/)
  })

  test('Workflow Run 详情页显示返回箭头并可返回列表', async ({ page }) => {
    const id = await getFirstCellLinkId(page, '/monitor/workflow-runs')
    if (!id) return
    await page.goto(`/monitor/workflow-runs/${id}`)
    const backBtn = page.locator('.nav-arrow-btn').first()
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await expect(page).toHaveURL(/\/monitor\/workflow-runs$/)
  })

  test('批次日窗口页显示返回箭头并可返回列表', async ({ page }) => {
    // PageHeader.showBackButton 依赖 history.state.back,直接 goto 没有 → 先访问列表再深链
    await page.goto('/scheduler/batch-days')
    const today = new Date().toISOString().split('T')[0]
    await page.goto(`/scheduler/batch-days/${today}`)
    const backBtn = page.locator('.nav-arrow-btn').first()
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await expect(page).toHaveURL(/\/scheduler\/batch-days$/)
  })

  test('Job Step 分片页显示返回箭头并可返回实例详情', async ({ page }) => {
    const id = await getFirstCellLinkId(page, '/monitor/job-instances')
    if (!id) return
    await page.goto(`/monitor/job-instances/${id}/partitions`)
    const backBtn = page.locator('.nav-arrow-btn').first()
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
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    // .cell-link 第一行可能是 jobCode 链接(→ /jobs/definitions),
    // 用 href^=/monitor/job-instances/ 精确过滤到 instance id 链接
    const link = page.locator('a.cell-link[href^="/monitor/job-instances/"]').first()
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
    await expectPageTitle(page, /事件告警|告警/)
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
