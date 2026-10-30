import { test, expect } from './support/app'
import { seedBrowserStorage } from './support/storage'
import { e2eText, installE2eLocale } from './support/i18n'
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })
test('作业阶段消费完整推送并将暂停状态同步到详情操作', async ({ page }) => {
  await installE2eLocale(page)
  await seedBrowserStorage(page, {
    session: '1',
    tenantId: 'job-progress-fixture',
    onboardingDone: '1',
  })
  const snapshot = {
    tenantId: 'job-progress-fixture',
    jobInstanceId: 42,
    jobCode: 'import',
    instanceStatus: 'PAUSED',
    generatedAt: '2026-10-25T10:00:01Z',
    expectedPartitions: 4,
    workflowRunId: 7,
    pipelineInstanceId: 81,
    systemPipelineCode: 'IMPORT',
    systemPipelineVersion: 1,
    currentStage: 'LOAD',
    stageGraphAvailable: true,
    counts: [
      { scope: 'PARTITION', status: 'SUCCESS', count: 1 },
      { scope: 'PARTITION', status: 'FAILED', count: 1 },
      { scope: 'PARTITION', status: 'RUNNING', count: 1 },
      { scope: 'TASK', status: 'SUCCESS', count: 2 },
      { scope: 'TASK', status: 'RUNNING', count: 1 },
    ],
    stages: ['RECEIVE', 'PREPROCESS', 'PARSE', 'VALIDATE', 'LOAD', 'FEEDBACK'].map(
      (stageCode, i) => ({
        stageCode,
        stageStatus: i < 4 ? 'SUCCESS' : i === 4 ? 'RUNNING' : 'PENDING',
        runSeq: i === 4 ? 2 : null,
        rowsProcessed: i === 4 ? 88 : null,
      }),
    ),
  }
  const workflow = {
    tenantId: snapshot.tenantId,
    workflowRunId: 7,
    workflowDefinitionId: 3,
    workflowVersion: 1,
    runStatus: 'PAUSED',
    snapshotAvailable: true,
    generatedAt: snapshot.generatedAt,
    nodes: [
      {
        nodeCode: 'import',
        nodeName: 'Frozen import',
        nodeType: 'JOB',
        nodeStatus: 'RUNNING',
        jobInstanceId: 42,
        activeSteps: ['LOAD'],
      },
      { nodeCode: 'end', nodeType: 'END', nodeStatus: 'PENDING', activeSteps: [] },
    ],
    edges: [{ fromNodeCode: 'import', toNodeCode: 'end', edgeType: 'SUCCESS' }],
  }
  await page.route('**/api/console/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const isWorkflow = path.includes('/workflow-runs/')
    if (path.endsWith('/execution-progress/events')) {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: `event: ready\ndata: {}\n\nevent: ${isWorkflow ? 'workflow-execution-progress' : 'job-execution-progress'}\ndata: ${JSON.stringify({ data: isWorkflow ? workflow : snapshot })}\n\n`,
      })
      return
    }
    let data: unknown = { items: [], total: 0 }
    if (path.endsWith('/auth/me'))
      data = {
        username: 'fixture',
        tenantId: snapshot.tenantId,
        authorities: ['ROLE_ADMIN'],
        mustChangePassword: false,
      }
    if (path.endsWith('/tenants'))
      data = {
        items: [
          { tenantId: snapshot.tenantId, tenantName: 'Owned progress tenant', status: 'ACTIVE' },
        ],
        total: 1,
        pageNo: 1,
        pageSize: 15,
      }
    if (path.endsWith('/stream/ticket')) data = { ticket: 'fixture-ticket' }
    if (path.endsWith('/execution-progress')) {
      data = isWorkflow
        ? workflow
        : { ...snapshot, instanceStatus: 'RUNNING', generatedAt: '2026-10-25T10:00:00Z' }
    }
    if (path.endsWith('/queries/instances/42'))
      data = {
        id: 42,
        tenantId: snapshot.tenantId,
        jobCode: 'import',
        instanceNo: 'job-42',
        instanceStatus: 'RUNNING',
        bizDate: '2026-10-25',
      }
    await route.fulfill({ json: { code: 'SUCCESS', message: 'ok', data } })
  })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/monitor/job-instances/42')
  const panel = page.locator('.section-card').filter({ hasText: e2eText('jobProgress.title') })
  await expect(panel.locator('svg .node')).toHaveCount(6, { timeout: 30000 })
  const workflowPanel = page
    .locator('.section-card')
    .filter({ hasText: e2eText('workflowProgress.title') })
  await expect(workflowPanel.locator('svg .node')).toHaveCount(2)
  await expect(workflowPanel).toContainText('Frozen import')
  const graphBounds = await panel.locator('.mini-dag__graph').boundingBox()
  const lastBounds = await panel.locator('svg .node').last().boundingBox()
  expect(lastBounds!.x + lastBounds!.width).toBeLessThanOrEqual(graphBounds!.x + graphBounds!.width)
  await expect(panel).toContainText('88')
  await expect(panel).toContainText('50%')
  await expect(panel).toContainText('67%')
  await expect(
    page.getByRole('button', { name: e2eText('runControl.resume'), exact: true }),
  ).toBeVisible()
  await expect(panel.getByRole('link')).toHaveAttribute(
    'href',
    '/files/pipeline-obs?pipelineInstanceId=81',
  )
  await panel.screenshot({ path: test.info().outputPath('job-progress.png') })
  await workflowPanel.screenshot({ path: test.info().outputPath('job-workflow-context.png') })
})
