import { expect, test } from './support/app'
import { enterDemoApp } from './support/app'

test.describe('@workflow-designer-gateway 网关与依赖语义', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('FORK 条件分支和 N_OF 汇聚按后端运行模型展示并通过校验', async ({ page }) => {
    const stamp = Date.now()
    const workflowCode = `e2e-wfd-gateway-${stamp}`
    const createResponse = await page.request.post('/api/console/workflow-definitions', {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'ta',
        'Idempotency-Key': `e2e-wfd-gateway-create-${stamp}`,
      },
      data: {
        tenantId: 'ta',
        workflowCode,
        workflowName: `E2E gateway ${stamp}`,
        workflowType: 'DAG',
        enabled: true,
        nodes: [
          { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', enabled: true },
          {
            nodeCode: 'FORK',
            nodeName: 'Fork',
            nodeType: 'GATEWAY',
            nodeParams: '{}',
            enabled: true,
          },
          {
            nodeCode: 'A',
            nodeName: 'Branch A',
            nodeType: 'JOB',
            relatedJobCode: `e2e_job_a_${stamp}`,
            enabled: true,
          },
          {
            nodeCode: 'B',
            nodeName: 'Branch B',
            nodeType: 'JOB',
            relatedJobCode: `e2e_job_b_${stamp}`,
            enabled: true,
          },
          {
            nodeCode: 'C',
            nodeName: 'Branch C',
            nodeType: 'JOB',
            relatedJobCode: `e2e_job_c_${stamp}`,
            enabled: true,
          },
          {
            nodeCode: 'MERGE',
            nodeName: 'Merge',
            nodeType: 'GATEWAY',
            nodeParams: '{"joinMode":"N_OF","joinThreshold":2}',
            enabled: true,
          },
          { nodeCode: 'END', nodeName: 'End', nodeType: 'END', enabled: true },
        ],
        edges: [
          { fromNodeCode: 'START', toNodeCode: 'FORK', edgeType: 'ALWAYS', enabled: true },
          { fromNodeCode: 'FORK', toNodeCode: 'A', edgeType: 'ALWAYS', enabled: true },
          {
            fromNodeCode: 'FORK',
            toNodeCode: 'B',
            edgeType: 'CONDITION',
            conditionExpr: 'bizDate != null',
            enabled: true,
          },
          { fromNodeCode: 'B', toNodeCode: 'C', edgeType: 'SUCCESS', enabled: true },
          { fromNodeCode: 'A', toNodeCode: 'MERGE', edgeType: 'SUCCESS', enabled: true },
          { fromNodeCode: 'B', toNodeCode: 'MERGE', edgeType: 'SUCCESS', enabled: true },
          { fromNodeCode: 'C', toNodeCode: 'MERGE', edgeType: 'SUCCESS', enabled: true },
          { fromNodeCode: 'MERGE', toNodeCode: 'END', edgeType: 'ALWAYS', enabled: true },
        ],
      },
    })
    const payload = (await createResponse.json()) as {
      data?: { id?: number | string }
      id?: number | string
    }
    expect(createResponse.ok(), JSON.stringify(payload)).toBe(true)
    const workflowId = Number(payload.data?.id ?? payload.id)
    expect(Number.isFinite(workflowId), '创建网关工作流响应缺少 id').toBe(true)

    await page.goto(`/workflow/designer/${workflowId}`)
    await expect(page.locator('.dag-canvas').first()).toBeVisible({ timeout: 12_000 })
    await expect(
      page.locator('.designer-gateway__strategy').filter({ hasText: 'FORK 2' }).first(),
    ).toBeVisible()
    await expect(
      page.locator('.designer-gateway__strategy').filter({ hasText: 'N_OF 2/3' }).first(),
    ).toBeVisible()

    await page.locator('.x6-node[data-cell-id="MERGE"]').first().click()
    const inspector = page.locator('.node-inspector')
    await expect(inspector).toBeVisible()
    await expect(inspector).toContainText('入边')
    await expect(inspector).toContainText('出边')
    await expect(inspector.getByRole('radio', { name: 'N_OF' })).toBeChecked()
    await expect(inspector.getByRole('spinbutton', { name: /满足数量/ })).toHaveValue('2')

    await page.getByRole('button', { name: '校验' }).first().click()
    await expect(page.getByRole('dialog', { name: /校验错误|Validation errors/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '展开校验错误列表' })).toHaveCount(0)

    await page.getByRole('combobox', { name: '依赖连线选择器' }).click()
    await page.getByRole('option', { name: /Fork.*Branch B.*条件/ }).click()
    await expect(page.locator('.edge-inspector input[readonly]').nth(0)).toHaveValue('Fork (FORK)')
    await expect(page.locator('.edge-inspector input[readonly]').nth(1)).toHaveValue('Branch B (B)')
    await expect(page.locator('.edge-inspector textarea')).toHaveValue('bizDate != null')
  })
})
