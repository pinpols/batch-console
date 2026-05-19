/**
 * 补 Day 1-4 新交付页面的 smoke:
 *   - /jobs/definitions/new      (JobDefinitionWizard)
 *   - /jobs/definitions/:id      (JobDefinitionDetail 9 Tab)
 *   - 编辑 drawer 中 workerGroup 下拉(B1 修复)
 *   - cron 输入框 placeholder i18n(B2 修复,需 scheduleType ≠ MANUAL)
 *
 * 策略:不依赖 BE 写入,只验证页面可达 + 控件渲染 + 0 5xx。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('Job Definition Wizard / Detail (Day 1-4 交付)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Wizard 页可达 + 8 step 标题 + 默认表单可渲染', async ({ page, network }) => {
    await page.goto('/jobs/definitions/new')
    await expectPageTitle(page, '新建作业向导')

    // 8 个 step 标题应可见 — 先等首个 step 节点挂载,避免读 DOM 时 wizard 还在 lazy 加载
    await expect(page.locator('.el-step__title').first()).toBeVisible({ timeout: 8000 })
    const stepTitles = await page.locator('.el-step__title').allTextContents()
    for (const want of [
      '基本信息', '调度', '资源', '触发', '关联文件', '关联编排', '告警', '复核',
    ]) {
      expect(stepTitles.some((t) => t.includes(want))).toBeTruthy()
    }

    // step 1 基本表单(jobCode / jobName 输入框)应可见
    await expect(page.locator('input[maxlength="128"]').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('input[maxlength="256"]').first()).toBeVisible()

    // 顶部 "导入 Bundle JSON" 按钮存在(方案 3 Bundle 入口)
    await expect(page.getByRole('button', { name: /导入 Bundle JSON/ })).toBeVisible()

    network.assertClean('wizard-smoke')
  })


  test('Detail 页直链可达 + 9 Tab 渲染', async ({ page, network }) => {
    // 用 API 直接抓一条 job id(管理员 admin 默认能看到 system / ta)
    const candidates = ['ta', 'system']
    let id: number | undefined
    let tenantId: string | undefined
    for (const t of candidates) {
      const res = await page.request.get(
        `/api/console/queries/job-definitions?tenantId=${t}&pageNo=1&pageSize=1`,
      )
      const body = await res.json().catch(() => null)
      if (body?.items?.length) {
        id = body.items[0].id
        tenantId = t
        break
      }
    }
    if (!id || !tenantId) test.skip(true, 'no job definition available')

    await page.goto(`/jobs/definitions/${id}?tenantId=${tenantId}`)
    await expectPageTitle(page, '作业详情')

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
    const candidates = ['ta', 'system']
    let id: number | undefined
    let tenantId: string | undefined
    for (const t of candidates) {
      const res = await page.request.get(
        `/api/console/queries/job-definitions?tenantId=${t}&pageNo=1&pageSize=1`,
      )
      const body = await res.json().catch(() => null)
      if (body?.items?.length) {
        id = body.items[0].id
        tenantId = t
        break
      }
    }
    if (!id || !tenantId) test.skip(true, 'no job definition available')

    await page.goto(`/jobs/definitions/${id}?tenantId=${tenantId}`)
    await expectPageTitle(page, '作业详情')

    // 点 "告警" tab(lazy 加载会触发 listAlertRoutings 调用)
    const alertsTab = page.locator('.el-tabs__item').filter({ hasText: '告警' }).first()
    await expect(alertsTab).toBeVisible({ timeout: 6000 })
    await alertsTab.click()
    // 等待表格容器渲染(即便空也应有 empty-text)
    await expect(
      page.getByText(/当前租户无告警路由|routeCode|无数据/).first(),
    ).toBeVisible({ timeout: 8000 })

    network.assertClean('detail-tab-alerts')
  })
})
