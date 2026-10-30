import { randomUUID } from 'node:crypto'
import { csrfHeaders, expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { ImportWorkerPipelineFixture } from './fixtures/runtime-progress/importWorkerPipelineFixture'
import type { JobExecutionProgress } from '@/api/jobProgress'
import type { PipelineProgressSnapshot } from '@/api/pipelineProgress'

const enabled = process.env.E2E_IMPORT_WORKER_PROGRESS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns identities, Worker and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(360_000)
test.skip(!enabled, 'Requires isolated WDI services, PostgreSQL, MinIO and IMPORT Worker JAR')

test('真实对象文件导入阶段推送、网关DAG及Worker中断后续跑无重复行', async ({ page }, testInfo) => {
  const fixture = new ImportWorkerPipelineFixture()
  const jobSnapshots: JobExecutionProgress[] = []
  const pipelineSnapshots: PipelineProgressSnapshot[] = []
  const periodicGets: string[] = []
  let prepared = false
  let primaryError: unknown
  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
    fixture.prepare()
    fixture.prepareImport()
    prepared = true
    await fixture.login(page.request)
    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.exposeFunction('captureImportProgress', (kind: string, data: unknown) => {
      if (kind === 'job') jobSnapshots.push(data as JobExecutionProgress)
      if (kind === 'pipeline') pipelineSnapshots.push(data as PipelineProgressSnapshot)
    })
    await page.addInitScript(() => {
      const Native = window.EventSource
      window.EventSource = class extends Native {
        constructor(url: string | URL, options?: EventSourceInit) {
          super(url, options)
          const capture = (kind: string, event: Event) => {
            const value = JSON.parse((event as MessageEvent).data).data
            void (
              window as unknown as {
                captureImportProgress: (kind: string, data: unknown) => Promise<void>
              }
            ).captureImportProgress(kind, value)
          }
          this.addEventListener('job-execution-progress', (event) => capture('job', event))
          this.addEventListener('pipeline-progress-snapshot', (event) => capture('pipeline', event))
        }
      }
    })

    const channel = await fixture.mutate(page.request, '/api/console/file-channels', {
      tenantId: fixture.tenantId,
      channelCode: fixture.channelCode,
      channelName: 'Real IMPORT progress source',
      channelType: 'LOCAL',
      targetEndpoint: '',
      authType: 'NONE',
      configJson: '{}',
      receiptPolicy: 'NONE',
      timeoutSeconds: 15,
      enabled: true,
    })
    expect(channel.status(), await channel.text()).toBe(200)
    const sessionResponse = await fixture.mutate(
      page.request,
      '/api/console/files/presign-upload',
      undefined,
      'POST',
      {
        channelCode: fixture.channelCode,
        fileName: fixture.fileName,
      },
    )
    expect(sessionResponse.status(), await sessionResponse.text()).toBe(200)
    const session = (await sessionResponse.json()).data as {
      fileId: number
      storageBucket: string
      storagePath: string
    }
    const content = Buffer.from(
      'recordNo,amount\n' +
        Array.from(
          { length: 600 },
          (_, index) => `ROW${String(index).padStart(4, '0')},${index + 1}`,
        ).join('\n') +
        '\n',
    )
    const upload = await page.request.put(`/api/console/files/${session.fileId}/content`, {
      params: { tenantId: fixture.tenantId },
      headers: {
        ...(await csrfHeaders(page.request)),
        'X-Tenant-Id': fixture.tenantId,
        'Idempotency-Key': randomUUID(),
      },
      multipart: { file: { name: fixture.fileName, mimeType: 'text/csv', buffer: content } },
    })
    expect(upload.status(), await upload.text()).toBe(200)
    expect(fixture.readUploadedObject(session.storageBucket, session.storagePath)).toEqual(content)
    const confirmed = await fixture.mutate(
      page.request,
      `/api/console/files/${session.fileId}/confirm-arrival`,
    )
    expect(confirmed.status(), await confirmed.text()).toBe(200)

    const job = await fixture.mutate(page.request, '/api/console/job-definitions', {
      tenantId: fixture.tenantId,
      jobCode: fixture.jobCode,
      jobName: 'Object file import progress',
      jobType: 'BUNDLE_IMPORT',
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      workerGroup: 'IMPORT',
      timeoutSeconds: 300,
      calendarCode: fixture.calendarCode,
      retryPolicy: 'FIXED',
      retryMaxCount: 3,
      paramSchema: JSON.stringify({ type: 'object', additionalProperties: true }),
      defaultParams: JSON.stringify({ templateCode: fixture.templateCode }),
      enabled: true,
    })
    expect(job.status(), await job.text()).toBe(200)
    fixture.rememberJobDefinition(Number((await job.json()).data.id))
    const definition = await fixture.mutate(page.request, '/api/console/workflow-definitions', {
      tenantId: fixture.tenantId,
      workflowCode: fixture.workflowCode,
      workflowName: 'Object IMPORT gateway progress',
      workflowType: 'DAG',
      enabled: true,
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      calendarCode: fixture.calendarCode,
      nodes: [
        { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
        {
          nodeCode: 'GATEWAY',
          nodeName: 'Import gateway',
          nodeType: 'GATEWAY',
          nodeOrder: 1,
          enabled: true,
        },
        {
          nodeCode: 'IMPORT_JOB',
          nodeName: 'Real object import',
          nodeType: 'JOB',
          relatedJobCode: fixture.jobCode,
          nodeOrder: 2,
          enabled: true,
        },
        { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 3, enabled: true },
      ],
      edges: [
        { fromNodeCode: 'START', toNodeCode: 'GATEWAY', edgeType: 'ALWAYS', enabled: true },
        { fromNodeCode: 'GATEWAY', toNodeCode: 'IMPORT_JOB', edgeType: 'ALWAYS', enabled: true },
        { fromNodeCode: 'IMPORT_JOB', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true },
      ],
    })
    expect(definition.status(), await definition.text()).toBe(200)
    const workflowId = Number((await definition.json()).data.id)
    await fixture.startWorker()
    const trigger = await fixture.mutate(
      page.request,
      `/api/console/workflow-definitions/${workflowId}/trigger`,
      {
        tenantId: fixture.tenantId,
        bizDate: fixture.bizDate,
        triggerType: 'MANUAL',
        payload: JSON.stringify({
          bundleFiles: [{ sourceFileId: session.fileId, templateCode: fixture.templateCode }],
        }),
      },
    )
    expect(trigger.status(), await trigger.text()).toBe(200)
    await expect
      .poll(
        () =>
          fixture
            .importState()
            .checkpoints.some(
              (row) => row.stage === 'LOAD' && row.processedCount >= 25 && !row.completed,
            ),
        { timeout: 90_000, intervals: [1000] },
      )
      .toBe(true)
    const running = fixture.importState()
    expect(running.pipelines).toHaveLength(1)
    const pipelineId = running.pipelines[0].id
    const jobId = running.instances[0].id
    expect(running.pipelines[0]).toMatchObject({
      jobInstanceId: jobId,
      fileId: session.fileId,
      systemCode: 'IMPORT',
      systemVersion: 1,
      status: 'RUNNING',
      stage: 'LOAD',
    })
    expect(running.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeCode: 'GATEWAY', status: 'SUCCESS' }),
        expect.objectContaining({ nodeCode: 'IMPORT_JOB', jobInstanceId: jobId }),
      ]),
    )
    await page.goto(`/monitor/job-instances/${jobId}`)
    const jobPanel = page.locator('.section-card').filter({ hasText: e2eText('jobProgress.title') })
    await expect(jobPanel.locator('.mini-dag__graph .node')).toHaveCount(6)
    await expect(jobPanel.locator('.mini-dag__graph .node.running')).toHaveCount(1)
    await expect(jobPanel.locator('.live-status-badge--live')).toBeVisible()
    await expect
      .poll(() =>
        jobSnapshots.some(
          (snapshot) =>
            snapshot.jobInstanceId === jobId &&
            snapshot.currentStage === 'LOAD' &&
            snapshot.stages.some(
              (stage) => stage.stageCode === 'LOAD' && Number(stage.rowsProcessed) >= 25,
            ),
        ),
      )
      .toBe(true)
    const runningLoadRow = jobPanel.locator('.el-table__row').filter({ hasText: 'LOAD' })
    await expect
      .poll(async () => Number((await runningLoadRow.locator('td').nth(3).innerText()).trim()))
      .toBeGreaterThanOrEqual(25)
    await testInfo.attach('import-job-running.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })

    await page.goto(`/files/pipeline-obs?pipelineInstanceId=${pipelineId}`)
    await page
      .getByRole('tab', { name: e2eText('filePipelineObservability.tabSteps'), exact: true })
      .click()
    await expect
      .poll(() =>
        pipelineSnapshots.some((snapshot) =>
          snapshot.pipelines.some(
            (row) => row.pipelineInstanceId === pipelineId && row.currentStage === 'LOAD',
          ),
        ),
      )
      .toBe(true)
    await expect(page.locator('.el-tab-pane:visible .live-status-badge--live')).toBeVisible()
    const beforeCrash = fixture.importState()
    expect(fixture.uploadState().objectFileCount).toBe(1)
    expect(beforeCrash.businessRows).toBeGreaterThanOrEqual(25)
    expect(beforeCrash.businessRows).toBeLessThan(600)
    await fixture.crashWorker()
    await fixture.startWorker()
    await expect
      .poll(() => fixture.importState().runs[0]?.status, {
        timeout: 180_000,
        intervals: [1000, 2000],
      })
      .toBe('SUCCESS')
    const terminal = fixture.importState()
    expect(fixture.uploadState().objectFileCount).toBe(1)
    expect(terminal.businessRows).toBe(600)
    expect(terminal.distinctRows).toBe(600)
    expect(terminal.pipelines).toHaveLength(1)
    expect(terminal.pipelines[0]).toMatchObject({
      id: pipelineId,
      status: 'SUCCESS',
      fileId: session.fileId,
    })
    expect(
      terminal.steps.some(
        (row) => row.stage === 'LOAD' && row.runSeq >= 2 && row.status === 'SUCCESS',
      ),
    ).toBe(true)
    expect(terminal.steps.filter((row) => row.status === 'RUNNING')).toEqual([])
    expect(terminal.steps).toContainEqual(
      expect.objectContaining({
        stage: 'LOAD',
        runSeq: 1,
        status: 'FAILED',
        errorCode: 'PIPELINE_ATTEMPT_INTERRUPTED',
      }),
    )
    expect(terminal.checkpoints).toContainEqual(
      expect.objectContaining({ stage: 'LOAD', processedCount: 600, completed: true }),
    )
    expect(terminal.instances.every((row) => row.status === 'SUCCESS')).toBe(true)
    await expect
      .poll(() =>
        pipelineSnapshots.some((snapshot) =>
          snapshot.pipelines.some(
            (row) => row.pipelineInstanceId === pipelineId && row.runStatus === 'SUCCESS',
          ),
        ),
      )
      .toBe(true)

    await page.goto(`/monitor/job-instances/${jobId}`)
    await expect(jobPanel.locator('.mini-dag__graph .node.success')).toHaveCount(6)
    const loadRow = jobPanel.locator('.el-table__row').filter({ hasText: 'LOAD' })
    await expect(loadRow).toContainText('600')
    const workflowPanel = page
      .locator('.section-card')
      .filter({ hasText: e2eText('workflowProgress.title') })
    await expect(workflowPanel.locator('.mini-dag__graph .node')).toHaveCount(4)
    await expect(workflowPanel.locator('.mini-dag__graph .node.success')).toHaveCount(4)
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        /\/execution-progress$|\/pipeline-progress$/.test(new URL(request.url()).pathname)
      )
        periodicGets.push(request.url())
    })
    await page.waitForTimeout(4500)
    expect(periodicGets).toEqual([])
    await testInfo.attach('import-job-recovered.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    await testInfo.attach('import-worker-progress.json', {
      body: JSON.stringify(
        {
          source: 'real uploaded MinIO object and real IMPORT Worker',
          inputRows: 600,
          sourceObjectBytes: content.length,
          beforeCrashRows: beforeCrash.businessRows,
          finalBusinessRows: terminal.businessRows,
          distinctBusinessRows: terminal.distinctRows,
          pipelineCount: terminal.pipelines.length,
          sourceObjectFileRecords: fixture.uploadState().objectFileCount,
          stages: terminal.steps,
          workflowNodeStates: terminal.nodes.map(({ nodeCode, status }) => ({ nodeCode, status })),
          checkpoint: terminal.checkpoints,
          periodicGets: periodicGets.length,
          observedJobPushes: jobSnapshots.length,
          observedPipelinePushes: pipelineSnapshots.length,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    if (prepared) {
      await testInfo.attach('import-worker-failure-state.json', {
        body: JSON.stringify({ workflow: fixture.state(), execution: fixture.importState() }),
        contentType: 'application/json',
      })
    }
    throw error
  } finally {
    await page.goto('about:blank')
    try {
      const cleanup = await fixture.finish(page.request)
      await testInfo.attach('import-worker-cleanup.json', {
        body: JSON.stringify(cleanup),
        contentType: 'application/json',
      })
    } catch (cleanupError) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, cleanupError],
          `IMPORT acceptance and cleanup failed; Worker logs: ${fixture.workerLogDir}`,
        )
      throw cleanupError
    }
  }
})
