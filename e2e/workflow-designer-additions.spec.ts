/**
 * Workflow 设计器新增能力 e2e(本会话 A/C 组:快捷键帮助面板 + 节点搜索框)。
 * 每条用例通过 API 创建隔离工作流后直达设计器，避免依赖共享 seed 或列表首行状态。
 */
import { enterDemoApp, expect, test } from './support/app'

async function openDesigner(page): Promise<void> {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const response = await page.request.post('/api/console/workflow-definitions', {
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': 'ta',
      'Idempotency-Key': `e2e-wfd-tools-${stamp}`,
    },
    data: {
      tenantId: 'ta',
      workflowCode: `e2e-wfd-tools-${stamp}`,
      workflowName: `E2E workflow tools ${stamp}`,
      workflowType: 'DAG',
      enabled: true,
      nodes: [
        { nodeCode: `start_${stamp}`, nodeName: '开始', nodeType: 'START', enabled: true },
        {
          nodeCode: `job_${stamp}`,
          nodeName: '作业',
          nodeType: 'JOB',
          relatedJobCode: `e2e_job_${stamp}`,
          enabled: true,
        },
        { nodeCode: `end_${stamp}`, nodeName: '结束', nodeType: 'END', enabled: true },
      ],
      edges: [
        {
          fromNodeCode: `start_${stamp}`,
          toNodeCode: `job_${stamp}`,
          edgeType: 'SUCCESS',
          enabled: true,
        },
        {
          fromNodeCode: `job_${stamp}`,
          toNodeCode: `end_${stamp}`,
          edgeType: 'SUCCESS',
          enabled: true,
        },
      ],
    },
  })
  const payload = (await response.json()) as { data?: { id?: number | string } }
  expect(response.ok(), JSON.stringify(payload)).toBe(true)
  const workflowId = Number(payload.data?.id)
  expect(Number.isFinite(workflowId), '创建工作流响应缺少 id').toBe(true)

  await page.goto(`/workflow/designer/${workflowId}`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(new RegExp(`/workflow/designer/${workflowId}$`), {
    timeout: 10_000,
  })
  await expect(page.locator('.dag-canvas').first()).toBeVisible({ timeout: 10_000 })
}

test.describe('@workflow-designer-additions 工具栏新增控件', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('快捷键帮助:按钮打开面板,列出快捷键', async ({ page }) => {
    await openDesigner(page)
    await page.getByRole('button', { name: '快捷键' }).first().click()
    const dialog = page.locator('.el-dialog:visible').filter({ hasText: '键盘快捷键' })
    await expect(dialog).toBeVisible()
    // 至少列出几条已知快捷键
    await expect(dialog.getByText('保存工作流')).toBeVisible()
    await expect(dialog.getByText('删除选中节点 / 边')).toBeVisible()
  })

  test('节点搜索:工具栏存在搜索框', async ({ page }) => {
    await openDesigner(page)
    const toolbar = page.getByRole('toolbar', { name: '设计器工具栏' })
    await expect(toolbar.getByRole('combobox').first()).toBeVisible()
    await expect(toolbar.getByText('搜索节点…')).toBeVisible()
  })
})
