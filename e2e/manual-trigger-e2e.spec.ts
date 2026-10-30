/**
 * 手动触发作业 — 真端到端操作验证(不止 toast,要验真产生实例)。
 *
 * 既有 job-ops 的「手动触发 → toast」只断言出现了 toast,不验操作结果。本 spec 补真闭环:
 * 在作业定义页对配置包稳定提供的手动作业(TA_EXPORT_REPORT)点手动触发 → 填 payload → 提交
 * → 断言 success toast → 按本次请求对应的 WorkflowDefinition 查询 RootRun 与节点实例，
 *   断言 RootRun SUCCESS 且有成功 Job 节点实例，避免历史 JobInstance 造成假阳性。
 *
 * TA_EXPORT_REPORT 来自 ta 标准租户配置包，E2E_FORCE_SEED=1 时由 global setup 刷新。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

const JOB = 'TA_EXPORT_REPORT'

test.describe('@manual-trigger 手动触发作业 真端到端', () => {
  test('手动触发 → 根 Workflow 成功 → 成功 Job 节点实例持久化', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/jobs/definitions')
    await expectPageTitle(page, '作业定义')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    // 按 jobCode 过滤定位目标行
    const codeInput = page
      .locator('.el-form-item')
      .filter({ hasText: /作业编码|编码/ })
      .locator('input')
      .first()
    if (await isVisible(codeInput, 3000)) {
      await codeInput.fill(JOB)
      await page.getByRole('button', { name: /搜索|查询/ }).first().click().catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
    }
    const row = page.locator('tbody tr.el-table__row').filter({ hasText: JOB }).first()
    await expect(row, `未找到标准 seed 作业 ${JOB}`).toBeVisible({ timeout: 8_000 })

    // 手动触发(行内更多/直接按钮)
    let triggerBtn = row.getByRole('button', { name: '手动触发' }).first()
    if (!(await isVisible(triggerBtn, 1500))) {
      const more = row.getByRole('button', { name: /^更多/ }).first()
      if (await isVisible(more, 1500)) {
        await more.click()
        triggerBtn = page.locator('.el-dropdown-menu__item, [role="menuitem"]').filter({ hasText: '手动触发' }).first()
      }
    }
    await expect(triggerBtn, `${JOB} 应提供手动触发入口`).toBeVisible({ timeout: 4_000 })
    await triggerBtn.click()
    const box = page.locator('.el-message-box, .el-dialog:visible').first()
    await expect(box).toBeVisible({ timeout: 5000 })
    const ta = box.locator('textarea').first()
    if (await isVisible(ta, 1500)) await ta.fill('{}')
    const triggerStartedAt = Date.now()
    const triggerResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      /\/api\/console\/workflow-definitions\/\d+\/trigger$/.test(response.url()),
    )
    await box.getByRole('button', { name: /^触发$|确定|提交/ }).first().click()
    const triggerResponse = await triggerResponsePromise
    expect(triggerResponse.ok(), 'Workflow trigger API 必须成功受理').toBe(true)
    const workflowDefinitionId = Number(
      triggerResponse.url().match(/workflow-definitions\/(\d+)\/trigger$/)?.[1],
    )
    expect(workflowDefinitionId).toBeGreaterThan(0)

    // 操作真受理 → success toast。注意:el-message 约 3s 自动消失,4-worker 高负载下
    // 单次 toBeVisible 抓取窗口易错过 → 用 poll 容忍「toast 已出现过」或「弹窗已关闭」
    // (提交成功后 message-box 会关闭)两者之一成立即判为受理。
    await expect
      .poll(
        async () => {
          const toast = await page.locator('.el-message--success').count()
          const boxGone = !(await box.isVisible().catch(() => false))
          return toast > 0 || boxGone
        },
        { timeout: 15000 },
      )
      .toBe(true)

    // 按触发目标查询 RootRun，并只接受本次点击后创建的运行，避免旧记录误通过。
    let launchedRun: { id: number; runStatus: string; createdAt: string } | undefined
    await expect
      .poll(
        async () => {
          const runs = await queryRows<{
            id: number
            workflowDefinitionId: number
            runStatus: string
            createdAt: string
          }>(page, '/api/console/queries/workflow-runs', {
            tenantId: 'ta',
            workflowDefinitionId: String(workflowDefinitionId),
            pageNo: '1',
            pageSize: '100',
          })
          launchedRun = runs.find(
            (run) =>
              run.workflowDefinitionId === workflowDefinitionId &&
              Date.parse(run.createdAt) >= triggerStartedAt - 1000,
          )
          return launchedRun?.runStatus ?? ''
        },
        { timeout: 60000, intervals: [1000, 2000, 3000] },
      )
      .toMatch(/^(SUCCESS|FAILED)$/)
    expect(launchedRun?.runStatus, '本次手动触发的 RootRun 必须成功').toBe('SUCCESS')

    const nodeRuns = await queryRows<{
      nodeCode: string
      nodeStatus: string
      jobInstanceId?: number
    }>(page, '/api/console/queries/workflow-node-runs', {
      tenantId: 'ta',
      workflowRunId: String(launchedRun?.id),
      pageNo: '1',
      pageSize: '100',
    })
    expect(
      nodeRuns.some(
        (nodeRun) =>
          nodeRun.nodeStatus === 'SUCCESS' && Number.isSafeInteger(nodeRun.jobInstanceId),
      ),
      '本次 RootRun 必须持久化至少一个成功 Job 节点实例',
    ).toBe(true)
  })
})

async function queryRows<T>(
  page: import('@playwright/test').Page,
  path: string,
  params: Record<string, string>,
): Promise<T[]> {
  const response = await page.request.get(path, { params })
  expect(response.ok(), `${path} 查询必须成功`).toBe(true)
  const body = (await response.json()) as {
    data?: { items?: T[] } | T[]
    items?: T[]
  }
  if (Array.isArray(body.data)) return body.data
  return body.data?.items ?? body.items ?? []
}
