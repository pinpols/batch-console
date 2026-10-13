import { csrfHeaders, enterDemoApp, expect, test } from './support/app'

const tenantId = 'ta'

test.describe('@workflow-designer-dependencies dependency overview', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('search, inspect, and paginate direct job dependencies without changing workflow edges', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const stamp = Date.now()
    const predecessorCode = `e2e-wfd-prev-${stamp}`
    const currentJobCode = `e2e-wfd-current-${stamp}`
    const currentNodeCode = `current_${stamp}`
    const downstreamCodes = Array.from(
      { length: 16 },
      (_, index) => `e2e-wfd-child-${stamp}-${String(index + 1).padStart(2, '0')}`,
    )

    await createJob(page, stamp, predecessorCode)
    await createJob(page, stamp + 1, currentJobCode, predecessorCode)
    for (const [index, jobCode] of downstreamCodes.entries()) {
      await createJob(page, stamp + index + 2, jobCode, currentJobCode, index !== 15)
    }
    const pipelineCode = `e2e-wfd-pipeline-${stamp}`
    await createPipeline(page, stamp, pipelineCode)
    expect(downstreamCodes).toHaveLength(16)

    const workflowId = await createWorkflow(page, stamp, {
      predecessorCode,
      currentJobCode,
      currentNodeCode,
      pipelineCode,
    })
    await page.goto(`/workflow/designer/${workflowId}`)
    const canvas = page.locator('.dag-canvas__graph')
    await expect(canvas.locator('.x6-node')).toHaveCount(7, { timeout: 15_000 })

    const search = page.locator('.node-search input')
    await search.fill(currentNodeCode)
    await page.getByRole('option', { name: new RegExp(currentNodeCode) }).click()
    await expect(page.locator('.node-search .el-select__placeholder')).toContainText(currentNodeCode)

    const inspector = page.locator('.node-inspector')
    await expect(inspector).toBeVisible()
    await expect(inspector).toContainText('当前流程（可编辑）')
    await expect(inspector).toContainText('流程前置作业')
    await expect(inspector).toContainText('分支网关')
    await expect(inspector).toContainText('作业定义依赖')
    await expect(inspector).toContainText('作业定义前置')
    await expect(inspector).toContainText(predecessorCode)
    await expect(inspector).toContainText('直接依赖此作业的定义（16）')
    await expect(inspector).toContainText(downstreamCodes[15]!)
    await expect(inspector).toContainText('已禁用')

    const nextPage = page.getByRole('button', { name: /下一页/ }).last()
    await expect(nextPage).toBeEnabled()
    await nextPage.click()
    await expect(inspector).toContainText(downstreamCodes[0]!)
    await expect(inspector).not.toContainText(downstreamCodes[15]!)

    const flowEdgeCount = await canvas.locator('.x6-edge').count()
    await selectNode(page, `file_${stamp}`)
    await expect(inspector).toContainText('关联 Pipeline')
    await expect(inspector.locator('input[readonly]').nth(1)).toHaveValue(`file_${stamp}`)
    await selectNode(page, `fork_${stamp}`)
    await expect(inspector.locator('input[readonly]').nth(1)).toHaveValue(`fork_${stamp}`)
    await expect(canvas.locator('.x6-edge')).toHaveCount(flowEdgeCount)
  })
})

async function selectNode(page: import('@playwright/test').Page, nodeCode: string) {
  const search = page.locator('.node-search input')
  await search.fill(nodeCode)
  await page.getByRole('option', { name: new RegExp(nodeCode) }).click()
}

async function createJob(
  page: import('@playwright/test').Page,
  requestId: number,
  jobCode: string,
  dependsOnJobCode?: string,
  enabled = true,
) {
  const response = await page.request.post('/api/console/job-definitions', {
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      'Idempotency-Key': `e2e-wfd-job-${requestId}-${jobCode}`,
      ...(await csrfHeaders(page.request)),
    },
    data: {
      tenantId,
      jobCode,
      jobName: `Workflow designer ${jobCode}`,
      jobType: 'GENERAL',
      scheduleType: 'MANUAL',
      dependsOnJobCode,
      enabled,
    },
  })
  const payload = (await response.json()) as { data?: { id?: number }; id?: number }
  expect(response.ok(), JSON.stringify(payload)).toBe(true)
  return payload.data?.id ?? payload.id
}

async function createWorkflow(
  page: import('@playwright/test').Page,
  stamp: number,
  input: {
    predecessorCode: string
    currentJobCode: string
    currentNodeCode: string
    pipelineCode: string
  },
) {
  const { predecessorCode, currentJobCode, currentNodeCode, pipelineCode } = input
  const response = await page.request.post('/api/console/workflow-definitions', {
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      'Idempotency-Key': `e2e-wfd-dependencies-${stamp}`,
      ...(await csrfHeaders(page.request)),
    },
    data: {
      tenantId,
      workflowCode: `e2e-wfd-dependencies-${stamp}`,
      workflowName: `E2E workflow dependencies ${stamp}`,
      workflowType: 'DAG',
      enabled: true,
      nodes: [
        { nodeCode: `start_${stamp}`, nodeName: '开始', nodeType: 'START', enabled: true },
        {
          nodeCode: `flow_up_${stamp}`,
          nodeName: '流程前置作业',
          nodeType: 'JOB',
          relatedJobCode: predecessorCode,
          enabled: true,
        },
        {
          nodeCode: currentNodeCode,
          nodeName: '当前作业节点',
          nodeType: 'JOB',
          relatedJobCode: currentJobCode,
          enabled: true,
        },
        {
          nodeCode: `fork_${stamp}`,
          nodeName: '分支网关',
          nodeType: 'GATEWAY',
          nodeParams: '{}',
          enabled: true,
        },
        {
          nodeCode: `file_${stamp}`,
          nodeName: '文件处理步骤',
          nodeType: 'FILE_STEP',
          relatedPipelineCode: pipelineCode,
          enabled: true,
        },
        { nodeCode: `end_${stamp}`, nodeName: '结束', nodeType: 'END', enabled: true },
        {
          nodeCode: `branch_${stamp}`,
          nodeName: '分支作业',
          nodeType: 'JOB',
          relatedJobCode: currentJobCode,
          enabled: true,
        },
      ],
      edges: [
        { fromNodeCode: `start_${stamp}`, toNodeCode: `flow_up_${stamp}`, edgeType: 'ALWAYS' },
        { fromNodeCode: `flow_up_${stamp}`, toNodeCode: currentNodeCode, edgeType: 'SUCCESS' },
        { fromNodeCode: currentNodeCode, toNodeCode: `fork_${stamp}`, edgeType: 'SUCCESS' },
        { fromNodeCode: `fork_${stamp}`, toNodeCode: `file_${stamp}`, edgeType: 'ALWAYS' },
        { fromNodeCode: `fork_${stamp}`, toNodeCode: `branch_${stamp}`, edgeType: 'CONDITION' },
        { fromNodeCode: `file_${stamp}`, toNodeCode: `end_${stamp}`, edgeType: 'SUCCESS' },
        { fromNodeCode: `branch_${stamp}`, toNodeCode: `end_${stamp}`, edgeType: 'SUCCESS' },
      ],
    },
  })
  const payload = (await response.json()) as { data?: { id?: number | string }; id?: number | string }
  expect(response.ok(), JSON.stringify(payload)).toBe(true)
  const id = Number(payload.data?.id ?? payload.id)
  expect(Number.isFinite(id), '创建依赖工作流响应缺少 id').toBe(true)
  return id
}

async function createPipeline(
  page: import('@playwright/test').Page,
  requestId: number,
  pipelineCode: string,
) {
  const response = await page.request.post('/api/console/pipeline-definitions', {
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      'Idempotency-Key': `e2e-wfd-pipeline-${requestId}-${pipelineCode}`,
      ...(await csrfHeaders(page.request)),
    },
    data: {
      tenantId,
      jobCode: pipelineCode,
      pipelineName: `Workflow designer ${pipelineCode}`,
      pipelineType: 'IMPORT',
      enabled: true,
      steps: [],
    },
  })
  const payload = (await response.json()) as { data?: { id?: number }; id?: number }
  expect(response.ok(), JSON.stringify(payload)).toBe(true)
}
