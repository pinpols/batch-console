import { test, expect } from './support/fixtures'
import { seedBrowserStorage } from './support/storage'
import { e2eText, installE2eLocale } from './support/i18n'

// 路由夹具验证冻结图与推送渲染，真实后端验收另行记录。
test.use({ storageState: { cookies: [], origins: [] } })
test('run DAG uses frozen nodes, shows parallel progress, and consumes pushed snapshots', async ({
  page,
}) => {
  await installE2eLocale(page)
  await seedBrowserStorage(page, {
    session: '1',
    tenantId: 'progress-fixture',
    onboardingDone: '1',
  })
  const snapshot = {
    workflowRunId: 7,
    tenantId: 'progress-fixture',
    workflowDefinitionId: 3,
    workflowVersion: 2,
    runStatus: 'RUNNING',
    snapshotAvailable: true,
    generatedAt: '2026-10-25T10:00:00Z',
    nodes: [
      {
        nodeCode: 'S',
        nodeName: 'Frozen start',
        nodeType: 'START',
        nodeStatus: 'SUCCESS',
        activeSteps: [],
      },
      {
        nodeCode: 'job-a',
        nodeName: 'Frozen import',
        nodeType: 'JOB',
        nodeStatus: 'RUNNING',
        jobInstanceId: 42,
        expectedPartitions: 4,
        completedPartitions: 2,
        createdTasks: 3,
        finishedTasks: 2,
        activeSteps: ['LOAD'],
      },
      {
        nodeCode: 'job_a',
        nodeName: 'Frozen export',
        nodeType: 'JOB',
        nodeStatus: 'WAITING_DEPENDENCY',
        activeSteps: [],
        errorCode: 'RESULT_NOT_EFFECTIVE',
      },
      {
        nodeCode: 'E',
        nodeName: 'Frozen end',
        nodeType: 'END',
        nodeStatus: 'PENDING',
        activeSteps: [],
      },
    ],
    edges: [
      { fromNodeCode: 'S', toNodeCode: 'job-a', edgeType: 'SUCCESS' },
      { fromNodeCode: 'S', toNodeCode: 'job_a', edgeType: 'SUCCESS' },
      { fromNodeCode: 'job-a', toNodeCode: 'E', edgeType: 'ALWAYS' },
    ],
  }
  let mutableDefinitionReads = 0
  await page.route('**/api/console/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.includes('/workflow-definitions/')) mutableDefinitionReads++
    let data: unknown = { items: [], total: 0, pageNo: 1, pageSize: 15 }
    if (path.endsWith('/auth/me'))
      data = {
        username: 'progress-fixture',
        tenantId: 'progress-fixture',
        authorities: ['ROLE_TENANT_ADMIN'],
        mustChangePassword: false,
      }
    if (path.endsWith('/execution-progress')) data = snapshot
    if (path.endsWith('/queries/workflow-runs/7'))
      data = {
        id: 7,
        tenantId: 'progress-fixture',
        workflowDefinitionId: 3,
        runStatus: 'RUNNING',
        currentNodeCode: 'job-a',
      }
    if (path.endsWith('/stream/ticket')) data = { ticket: 'fixture-ticket' }
    if (path.endsWith('/execution-progress/events')) {
      const pushed = {
        ...snapshot,
        runStatus: 'PAUSED',
        generatedAt: '2026-10-25T10:00:01Z',
        nodes: snapshot.nodes.map((n) =>
          n.nodeCode === 'job-a'
            ? {
                ...n,
                nodeStatus: 'SUCCESS',
                completedPartitions: 4,
                finishedTasks: 3,
                activeSteps: [],
              }
            : n,
        ),
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `event: ready\ndata: {}\n\nevent: workflow-execution-progress\ndata: ${JSON.stringify({ data: pushed })}\n\n`,
      })
      return
    }
    await route.fulfill({ json: { code: 'SUCCESS', message: 'ok', data } })
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/workflow/viewer/3?runId=7')
  const card = page.locator('.section-card').filter({ hasText: e2eText('workflowProgress.title') })
  await expect(card.locator('svg .node')).toHaveCount(4, { timeout: 30_000 })
  await expect(card).toContainText('Frozen import')
  await expect(card).toContainText('RESULT_NOT_EFFECTIVE')
  await expect(card).toContainText('4 / 4')
  await expect(card.getByRole('link', { name: '42', exact: true })).toHaveAttribute(
    'href',
    '/monitor/job-instances/42',
  )
  await expect(card.locator('.mini-dag__graph svg')).toContainText(
    e2eText('workflowProgress.states.WAITING_DEPENDENCY'),
  )
  await expect(card.locator('.mini-dag__graph path.flowchart-link').first()).toHaveCSS(
    'fill',
    'none',
  )
  const nodeFill = await card
    .locator('.mini-dag__graph .node.success rect')
    .first()
    .evaluate((el) => getComputedStyle(el).fill)
  expect(nodeFill).not.toBe('rgb(0, 0, 0)')
  await expect(card.locator('.mini-dag__graph .node text').first()).toHaveCSS(
    'text-anchor',
    'middle',
  )
  const graph = card.locator('.mini-dag__graph svg')
  const initialWidth = await graph.evaluate((el) => el.getBoundingClientRect().width)
  await card
    .getByRole('button', { name: e2eText('workflowMermaidViewer.tipZoomIn'), exact: true })
    .click()
  expect(await graph.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(
    initialWidth,
  )
  await card
    .getByRole('button', { name: e2eText('workflowMermaidViewer.tipReset'), exact: true })
    .click()
  expect(mutableDefinitionReads).toBe(0)
  await page.screenshot({
    path: 'test-results/workflow-execution-progress-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 768, height: 1000 })
  await expect(card.locator('svg .node')).toHaveCount(4, { timeout: 30_000 })
  await page.screenshot({
    path: 'test-results/workflow-execution-progress-narrow.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/monitor/workflow-runs/7')
  await expect(page.getByText('PAUSED', { exact: true })).toBeVisible({ timeout: 30_000 })
})
