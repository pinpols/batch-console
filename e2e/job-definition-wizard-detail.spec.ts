/**
 * 补 Day 1-4 新交付页面的 smoke:
 *   - /jobs/definitions/new      (JobDefinitionWizard)
 *   - /jobs/definitions/:id      （JobDefinitionDetail 的 9 个页签）
 *   - 编辑 drawer 中 workerGroup 下拉(B1 修复)
 *   - cron 输入框 placeholder i18n(B2 修复,需 scheduleType ≠ MANUAL)
 *
 * 策略:不依赖 BE 写入,只验证页面可达 + 控件渲染 + 0 5xx。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, waitForRouteStable } from './support/app'
import type { Page } from '@playwright/test'

async function firstJobDefinition(page: Page, tenants: string[]) {
  for (const tenantId of tenants) {
    const res = await page.request.get(
      `/api/console/queries/job-definitions?tenantId=${tenantId}&pageNo=1&pageSize=1`,
    )
    const body = await res.json().catch(() => null)
    const items = body?.data?.items ?? body?.items ?? []
    if (items.length) return { id: items[0].id as number, tenantId }
  }
  return null
}

test.describe('Job Definition Wizard / Detail (Day 1-4 交付)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Wizard 页可达 + 六步任务结构及关联能力可见 + 默认表单可渲染', async ({ page, network }) => {
    await page.goto('/jobs/definitions/new')
    await waitForRouteStable(page)
    await expectPageTitle(page, '新建作业向导')

    // 等待当前步骤正文挂载，再核对步骤导航，避免懒加载期间读取空 DOM。
    await expect(page.locator('.wizard-step-banner__title')).toHaveText('基本信息', {
      timeout: 10_000,
    })
    await expect(page.locator('.el-step')).toHaveCount(6)
    const stepTitles = await page.locator('.el-step__title').allTextContents()
    for (const want of ['基本信息', '调度', '执行策略', '触发', '关联配置', '复核']) {
      expect(stepTitles.some((t) => t.includes(want))).toBeTruthy()
    }

    // step 1 基本表单(jobCode / jobName 输入框)应可见
    // 新建态 jobCode 走 CodeNameBuilder(不是裸 maxlength=128 input),jobName 是 maxlength=256
    await expect(page.locator('.code-name-builder').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('input[maxlength="256"]').first()).toBeVisible()

    // 顶部 "导入 Bundle JSON" 按钮存在(方案 3 Bundle 入口)
    await expect(page.getByRole('button', { name: /导入 Bundle JSON/ })).toBeVisible()

    for (let index = 0; index < 4; index += 1) {
      await page.getByRole('button', { name: '下一步' }).click()
    }
    await expect(page.locator('.wizard-step-banner__title')).toHaveText('关联配置')
    await expect(page.getByText('选择 channel', { exact: true })).toBeVisible()
    await expect(page.getByText('选择工作流', { exact: true })).toBeVisible()
    await expect(page.getByText('选择路由', { exact: true })).toBeVisible()
    network.assertClean('wizard-smoke')
  })

  test('Detail 页直链可达 + 9 Tab 渲染', async ({ page, network }) => {
    // 用 API 直接抓一条 job id(管理员 admin 默认能看到 system / ta)
    const job = await firstJobDefinition(page, ['ta', 'system'])
    if (!job) test.skip(true, 'no job definition available')

    await page.goto(`/jobs/definitions/${job.id}?tenantId=${job.tenantId}`)
    await expectPageTitle(page, /作业详情/)

    // 详情加载完成后,任一 tab 标题应可见(Element Plus tabs 渲染为 div[role="tab"] 或 .el-tabs__item)
    const anyTab = page.locator('.el-tabs__item').first()
    await expect(anyTab).toBeVisible({ timeout: 8000 })

    // 9 个 tab 标题逐一断言(关联文件 IMPORT/EXPORT 才显示,故 ≥ 8)
    const visibleTabs = await page.locator('.el-tabs__item').allTextContents()
    const want = ['基本信息', '调度', '资源', '触发', '关联编排', '告警', '运行历史', '审计']
    for (const label of want) {
      expect(visibleTabs.some((t) => t.includes(label))).toBeTruthy()
    }

    network.assertClean('detail-9tab-smoke')
  })

  // B1 (workerGroup MetaOption) 行为验证由 job-definition-crud.spec 编辑流程覆盖,
  // 此处不重复脆弱的 UI 探测;静态层面:JobDefinitionList workerGroupOptionsMeta
  // 必须返回 {value,label}[] 给 JobConfigBasicForm。

  // Bundle 跨环境导入页 spec 已下线:功能与系统模块「租户复制配置 / 初始化配置」(POST
  // /api/console/config/tenant-init|tenant-copy)90% 重叠,/jobs/bundle/import 路由 +
  // JobBundleImport.vue 已合并到系统模块,作业列表不再单独暴露入口。

  test('Detail 页 Tab 7 告警 lazy 加载 alert_routings 列表', async ({ page, network }) => {
    const job = await firstJobDefinition(page, ['ta', 'system'])
    if (!job) test.skip(true, 'no job definition available')

    await page.goto(`/jobs/definitions/${job.id}?tenantId=${job.tenantId}`)
    await expectPageTitle(page, /作业详情/)

    // 点 "告警" tab(lazy 加载会触发 listAlertRoutings 调用)
    const alertsTab = page.locator('.el-tabs__item').filter({ hasText: '告警' }).first()
    await expect(alertsTab).toBeVisible({ timeout: 6000 })
    await alertsTab.click()
    // 在当前 tab 范围内等待数据或明确空态，避免全页同文案定位和渲染时序竞态。
    const alertPanel = page.getByRole('tabpanel', { name: '告警' })
    await expect(alertPanel).toContainText(/当前租户暂无告警路由|路由编码/, { timeout: 10_000 })

    network.assertClean('detail-tab-alerts')
  })
})

async function openWizardExecutionPolicyStep(page: import('@playwright/test').Page) {
  await enterDemoApp(page)
  await page.goto('/jobs/definitions/new')
  await expect(page.locator('.wizard-step-banner__title')).toHaveText('基本信息', {
    timeout: 10_000,
  })
  await page.locator('.cnb-biz input').fill('ROUTING_CHECK')
  await page.getByLabel('作业名称').fill('资源路由权限检查')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.locator('.wizard-step-banner__title')).toHaveText('执行策略')
}

test.describe('作业向导资源路由权限', () => {
  test('平台管理员可见队列和 Worker 组字段', async ({ page }) => {
    await openWizardExecutionPolicyStep(page)
    const form = page.locator('.wizard-form')
    await expect(form.getByText('队列', { exact: true })).toBeVisible()
    await expect(form.getByText('Worker 组', { exact: true })).toBeVisible()
  })

  test.describe('租户管理员', () => {
    test.use({ storageState: 'e2e/.auth/role-tenantAdmin.json' })

    test('仅显示执行策略，不暴露平台队列或 Worker 组', async ({ page }) => {
      await openWizardExecutionPolicyStep(page)
      const form = page.locator('.wizard-form')
      await expect(form.getByText('执行策略', { exact: true })).toBeVisible()
      await expect(form.getByText('队列', { exact: true })).toHaveCount(0)
      await expect(form.getByText('Worker 组', { exact: true })).toHaveCount(0)
    })
  })
})
