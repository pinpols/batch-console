import { test, expect } from './support/app'
import { seedBrowserStorage } from './support/storage'
import { e2eText, installE2eLocale } from './support/i18n'
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })
test('Pipeline阶段页消费完整推送，不以dirty事件查询补齐每次进度', async ({ page }) => {
  await installE2eLocale(page)
  await seedBrowserStorage(page, {
    session: '1',
    tenantId: 'pipeline-progress-fixture',
    onboardingDone: '1',
  })
  const pipeline = {
    id: 7,
    tenantId: 'pipeline-progress-fixture',
    jobCode: 'IMPORT_DEMO',
    pipelineType: 'IMPORT',
    runStatus: 'RUNNING',
    currentStage: 'LOAD',
  }
  const step = {
    id: 11,
    pipelineInstanceId: 7,
    stepCode: 'load',
    stageCode: 'LOAD',
    stepStatus: 'RUNNING',
    runSeq: 1,
  }
  const payload = (rows: number) => ({
    tenantId: pipeline.tenantId,
    generatedAt: `2026-10-25T10:00:${rows === 88 ? '01' : '00'}Z`,
    pipelines: [
      {
        pipelineInstanceId: 7,
        fileId: 71,
        fileName: 'report.csv',
        runStatus: 'RUNNING',
        currentStage: 'LOAD',
        systemPipelineCode: 'IMPORT',
        systemPipelineVersion: 1,
        stageGraphAvailable: true,
        stageCodes: ['LOAD'],
        steps: [
          {
            stepId: 11,
            pipelineInstanceId: 7,
            stepCode: 'load',
            stageCode: 'LOAD',
            stepStatus: 'RUNNING',
            runSeq: 1,
            rowsProcessed: rows,
            totalRowsHint: null,
            lastHeartbeatAt: null,
          },
        ],
      },
    ],
  })
  const queryReads: string[] = []
  await page.route('**/api/console/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/events')) {
      const body =
        path === '/api/console/pipeline-progress/events'
          ? `event: ready\ndata: {}\n\nevent: pipeline-progress-snapshot\ndata: ${JSON.stringify({ data: payload(88) })}\n\n`
          : 'event: ready\ndata: {}\n\n'
      await route.fulfill({ contentType: 'text/event-stream', body })
      return
    }
    let data: unknown = { items: [], total: 0 }
    if (path.endsWith('/auth/me'))
      data = {
        username: 'fixture',
        tenantId: pipeline.tenantId,
        authorities: ['ROLE_TENANT_ADMIN'],
        mustChangePassword: false,
      }
    if (path.endsWith('/stream/ticket')) data = { ticket: 'fixture-ticket' }
    if (path.endsWith('/pipeline-stages'))
      data = { IMPORT: ['RECEIVE', 'PREPROCESS', 'PARSE', 'VALIDATE', 'LOAD', 'FEEDBACK'] }
    if (path.endsWith('/queries/file-pipelines') || path.endsWith('/queries/file-pipeline-steps'))
      expect(new URL(route.request().url()).searchParams.get('pipelineInstanceId')).toBe('7')
    if (path.endsWith('/queries/file-pipelines'))
      data = { items: [pipeline], total: 1, pageNo: 1, pageSize: 15 }
    if (path.endsWith('/queries/file-pipeline-steps'))
      data = { items: [step], total: 1, pageNo: 1, pageSize: 15 }
    if (path.endsWith('/queries/pipeline-progress')) {
      queryReads.push(path)
      data = {
        pipelineInstanceId: 7,
        steps: [{ stepId: 11, pipelineInstanceId: 7, rowsProcessed: 3 }],
      }
    }
    if (path === '/api/console/pipeline-progress') data = payload(10)
    await route.fulfill({ json: { code: 'SUCCESS', message: 'ok', data } })
  })
  await page.goto('/files/pipeline-obs?pipelineInstanceId=7')
  await expect(page.locator('.current-file-bar')).toContainText('report.csv')
  await page
    .getByRole('tab', { name: e2eText('filePipelineObservability.tabSteps'), exact: true })
    .click()
  const row = page
    .locator('.el-tab-pane:visible .el-table__body-wrapper .el-table__row')
    .filter({ hasText: 'LOAD' })
  await expect(row).toContainText('88')
  expect(queryReads).toHaveLength(0)
  await page.screenshot({
    path: test.info().outputPath('pipeline-pushed-progress.png'),
    fullPage: true,
  })
})
