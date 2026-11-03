/**
 * 工作流调度与时限告警的编辑入口收敛（批次 4 方案 A）。
 * - 列表行不再提供“调度设置”“时限告警”，只保留启停开关。
 * - 多节点工作流：设计器工具栏“工作流设置”。
 * - 单作业工作流不能进设计器：查看页页头“工作流设置”。
 */
import { test, expect, type Locator, type Page } from '@playwright/test'

interface WorkflowRow {
  id: number
  singleJobDefinitionId?: number | null
}

async function loadWorkflowRows(page: Page): Promise<WorkflowRow[]> {
  const listResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/console/queries/workflow-definitions') && response.ok(),
  )
  await page.goto('/workflow/definitions')
  // 统一响应包裹为 { data: PageResponse }，PageResponse 的记录字段是 items
  const body = (await (await listResponse).json()) as { data?: { items?: WorkflowRow[] } }
  return body.data?.items ?? []
}

async function openBothSettings(page: Page, settings: Locator) {
  await settings.click()
  await page.getByRole('menuitem', { name: '调度设置' }).click()
  const scheduleDialog = page.getByRole('dialog', { name: 'Workflow 调度设置' })
  await expect(scheduleDialog).toBeVisible()
  await scheduleDialog.getByRole('button', { name: '取消' }).click()
  await expect(scheduleDialog).toBeHidden()

  await settings.click()
  await page.getByRole('menuitem', { name: '时限告警' }).click()
  await expect(page.getByRole('dialog').filter({ hasText: '时限告警' }).first()).toBeVisible()
}

test.describe('工作流设置入口', () => {
  test('列表行没有调度与时限告警编辑', async ({ page }) => {
    const rows = await loadWorkflowRows(page)
    test.skip(rows.length === 0, '当前租户没有工作流定义')
    const row = page.locator('tbody tr.el-table__row').first()
    await expect(row).toBeVisible()
    const more = row.getByRole('button', { name: /^更多/ }).first()
    if (await more.isVisible()) await more.click()
    await expect(page.getByRole('menuitem', { name: '调度设置' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: '时限告警' })).toHaveCount(0)
  })

  test('多节点工作流在设计器打开两项设置', async ({ page }) => {
    const target = (await loadWorkflowRows(page)).find((row) => row.singleJobDefinitionId == null)
    test.skip(!target, '当前租户没有多节点工作流')
    await page.goto(`/workflow/designer/${target!.id}`)
    await expect(page.locator('.workflow-designer > .el-loading-mask')).toHaveCount(0, {
      timeout: 15_000,
    })
    const settings = page.locator('.designer-toolbar').getByRole('button', { name: '工作流设置' })
    await openBothSettings(page, settings)
  })

  test('单作业工作流在查看页打开两项设置', async ({ page }) => {
    const target = (await loadWorkflowRows(page)).find((row) => row.singleJobDefinitionId != null)
    test.skip(!target, '当前租户没有单作业工作流')
    await page.goto(`/workflow/viewer/${target!.id}`)
    const settings = page.locator('.page-header').getByRole('button', { name: '工作流设置' })
    await expect(settings).toBeVisible({ timeout: 15_000 })
    await openBothSettings(page, settings)
  })
})
