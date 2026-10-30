import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { ProcessWorkerPipelineFixture } from './fixtures/runtime-progress/processWorkerPipelineFixture'
import type { JobExecutionProgress } from '@/api/jobProgress'
import type { PipelineProgressSnapshot } from '@/api/pipelineProgress'

const enabled = process.env.E2E_PROCESS_WORKER_PROGRESS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns identities, Worker and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(480_000)
test.skip(
  !enabled,
  'Requires isolated WDI services, separate platform/business databases and PROCESS Worker',
)

test('真实PROCESS双库WAP阶段推送与COMMIT中断恢复，业务数据不重不漏', async ({ page }, testInfo) => {
  const fixture = new ProcessWorkerPipelineFixture()
  const jobs: JobExecutionProgress[] = []
  const pipelines: PipelineProgressSnapshot[] = []
  let prepared = false
  let primaryError: unknown
  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
    fixture.prepare()
    fixture.prepareProcess()
    prepared = true
    await fixture.login(page.request)
    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.addLocatorHandler(page.locator('.driver-popover-close-btn'), async (button) => {
      await button.click()
    })
    await page.exposeFunction('captureProcessProgress', (kind: string, value: unknown) => {
      if (kind === 'job') jobs.push(value as JobExecutionProgress)
      else pipelines.push(value as PipelineProgressSnapshot)
    })
    await page.addInitScript(() => {
      const Native = window.EventSource
      window.EventSource = class extends Native {
        constructor(url: string | URL, options?: EventSourceInit) {
          super(url, options)
          for (const [eventName, kind] of [
            ['job-execution-progress', 'job'],
            ['pipeline-progress-snapshot', 'pipeline'],
          ]) {
            this.addEventListener(eventName, (event) => {
              void (
                window as unknown as {
                  captureProcessProgress: (kind: string, data: unknown) => Promise<void>
                }
              ).captureProcessProgress(kind, JSON.parse((event as MessageEvent).data).data)
            })
          }
        }
      }
    })
    const spec = {
      sourceSql: `SELECT tenant_id, record_no, amount * 2 AS total_amount FROM biz.${fixture.sourceTable} WHERE tenant_id = :tenantId ORDER BY record_no`,
      targetSchema: 'biz',
      targetTable: fixture.targetTable,
      writeMode: 'UPSERT',
      columns: [
        { source: 'tenant_id', target: 'tenant_id' },
        { source: 'record_no', target: 'record_no' },
        { source: 'total_amount', target: 'total_amount' },
      ],
      conflictColumns: ['tenant_id', 'record_no'],
      emptyResultPolicy: 'FAIL',
      maxStagedRows: 600,
    }
    const job = await fixture.mutate(page.request, '/api/console/job-definitions', {
      tenantId: fixture.tenantId,
      jobCode: fixture.jobCode,
      jobName: 'Actual PROCESS WAP recovery',
      jobType: 'PROCESS',
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      workerGroup: 'PROCESS',
      calendarCode: fixture.calendarCode,
      timeoutSeconds: 300,
      retryPolicy: 'FIXED',
      retryMaxCount: 3,
      paramSchema: JSON.stringify({ type: 'object', additionalProperties: true }),
      defaultParams: JSON.stringify({
        batchKey: fixture.batchKey,
        processImplCode: 'sqlTransformCompute',
        systemPipelineStepParams: { COMPUTE: { sqlTransformCompute: spec } },
      }),
      enabled: true,
    })
    expect(job.status(), await job.text()).toBe(200)
    fixture.rememberJobDefinition(Number((await job.json()).data.id))
    const definition = await fixture.mutate(page.request, '/api/console/workflow-definitions', {
      tenantId: fixture.tenantId,
      workflowCode: fixture.workflowCode,
      workflowName: 'PROCESS business progress',
      workflowType: 'DAG',
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      calendarCode: fixture.calendarCode,
      enabled: true,
      nodes: [
        { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
        {
          nodeCode: 'GATEWAY',
          nodeName: 'Process gateway',
          nodeType: 'GATEWAY',
          nodeOrder: 1,
          enabled: true,
        },
        {
          nodeCode: 'PROCESS_JOB',
          nodeName: 'Actual SQL processing',
          nodeType: 'JOB',
          relatedJobCode: fixture.jobCode,
          nodeOrder: 2,
          enabled: true,
        },
        { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 3, enabled: true },
      ],
      edges: [
        { fromNodeCode: 'START', toNodeCode: 'GATEWAY', edgeType: 'ALWAYS', enabled: true },
        { fromNodeCode: 'GATEWAY', toNodeCode: 'PROCESS_JOB', edgeType: 'ALWAYS', enabled: true },
        { fromNodeCode: 'PROCESS_JOB', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true },
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
          batchKey: fixture.batchKey,
          processImplCode: 'sqlTransformCompute',
        }),
      },
    )
    expect(trigger.status(), await trigger.text()).toBe(200)
    await expect
      .poll(() => fixture.processState().activeCommitQueries, {
        timeout: 120_000,
        intervals: [1000],
      })
      .toBe(1)
    const running = fixture.processState()
    expect(running.platformDatabase).not.toBe(running.businessDatabase)
    expect(running.activeCommitUsers).toEqual(['batch_business_writer'])
    expect(running.sourceRows).toBe(600)
    expect(running.sourceTotalRows).toBe(601)
    expect(running.rlsSourceRows).toBe(600)
    expect(running.stagedRows).toBe(600)
    expect(running.targetRows).toBe(0)
    expect(running.pipelines).toHaveLength(1)
    const pipelineId = running.pipelines[0].id
    const jobId = running.instances[0].id
    expect(running.pipelines[0]).toMatchObject({
      jobInstanceId: jobId,
      stage: 'COMMIT',
      systemCode: 'PROCESS',
      systemVersion: 1,
    })
    expect(running.nodes).toContainEqual(
      expect.objectContaining({ nodeCode: 'PROCESS_JOB', jobInstanceId: jobId }),
    )
    await page.goto(`/monitor/job-instances/${jobId}`)
    const jobPanel = page.locator('.section-card').filter({ hasText: e2eText('jobProgress.title') })
    await expect(jobPanel.locator('.mini-dag__graph .node')).toHaveCount(5)
    await expect(jobPanel.locator('.mini-dag__graph .node.running')).toHaveCount(1)
    await expect(jobPanel.locator('.live-status-badge--live')).toBeVisible()
    await expect
      .poll(() =>
        jobs.some(
          (snapshot) => snapshot.jobInstanceId === jobId && snapshot.currentStage === 'COMMIT',
        ),
      )
      .toBe(true)
    await expect(jobPanel.locator('.el-table__row').filter({ hasText: 'COMPUTE' })).toContainText(
      '600',
    )
    await expect(page.locator('.driver-overlay')).toHaveCount(0)
    await testInfo.attach('process-job-commit-running.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    await page.goto(`/files/pipeline-obs?pipelineInstanceId=${pipelineId}`)
    await page
      .getByRole('tab', { name: e2eText('filePipelineObservability.tabSteps'), exact: true })
      .click()
    await expect
      .poll(() =>
        pipelines.some((snapshot) =>
          snapshot.pipelines.some(
            (row) => row.pipelineInstanceId === pipelineId && row.currentStage === 'COMMIT',
          ),
        ),
      )
      .toBe(true)
    const beforeCrash = fixture.processState()
    expect(beforeCrash.activeCommitQueries).toBe(1)
    expect(beforeCrash.targetRows).toBe(0)
    await fixture.crashWorker()
    await fixture.startWorker()
    await expect
      .poll(() => fixture.processState().runs[0]?.status, {
        timeout: 240_000,
        intervals: [1000, 2000],
      })
      .toBe('SUCCESS')
    const terminal = fixture.processState()
    expect(terminal.targetRows).toBe(600)
    expect(terminal.distinctRows).toBe(600)
    expect(terminal.totalAmount).toBe(450750)
    expect(terminal.outsideTargetRows).toBe(0)
    for (const [index, row] of terminal.records.entries()) {
      expect(row.recordNo).toBe(String(index + 1).padStart(6, '0'))
      expect(row.amount).toBe((index + 1) * 2.5)
    }
    expect(terminal.pipelines).toEqual([
      expect.objectContaining({ id: pipelineId, status: 'SUCCESS' }),
    ])
    expect(terminal.steps.filter((row) => row.status === 'RUNNING')).toEqual([])
    expect(terminal.steps).toContainEqual(
      expect.objectContaining({
        stage: 'COMMIT',
        runSeq: 1,
        status: 'FAILED',
        errorCode: 'PIPELINE_ATTEMPT_INTERRUPTED',
      }),
    )
    expect(
      terminal.steps.some(
        (row) => row.stage === 'COMMIT' && row.runSeq >= 2 && row.status === 'SUCCESS',
      ),
    ).toBe(true)
    expect(terminal.instances).toHaveLength(1)
    expect(terminal.instances[0].status).toBe('SUCCESS')
    expect(terminal.nodes).toHaveLength(4)
    expect(terminal.nodes.every((row) => row.status === 'SUCCESS')).toBe(true)
    await expect
      .poll(() =>
        pipelines.some((snapshot) =>
          snapshot.pipelines.some(
            (row) => row.pipelineInstanceId === pipelineId && row.runStatus === 'SUCCESS',
          ),
        ),
      )
      .toBe(true)
    await page.goto(`/monitor/job-instances/${jobId}`)
    await expect(jobPanel.locator('.mini-dag__graph .node.success')).toHaveCount(5)
    const workflowPanel = page
      .locator('.section-card')
      .filter({ hasText: e2eText('workflowProgress.title') })
    await expect(workflowPanel.locator('.mini-dag__graph .node.success')).toHaveCount(4)
    const periodicGets: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        /\/execution-progress$|\/pipeline-progress$/.test(new URL(request.url()).pathname)
      )
        periodicGets.push(request.url())
    })
    await page.waitForTimeout(4500)
    expect(periodicGets).toEqual([])
    await testInfo.attach('process-job-recovered.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    await testInfo.attach('process-worker-evidence.json', {
      body: JSON.stringify({ beforeCrash, terminal, jobs, pipelines, periodicGets: 0 }),
      contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    if (prepared)
      await testInfo.attach('process-worker-failure.json', {
        body: JSON.stringify(fixture.processState()),
        contentType: 'application/json',
      })
    throw error
  } finally {
    await page.goto('about:blank')
    try {
      const cleanup = await fixture.finish(page.request)
      await testInfo.attach('process-worker-cleanup.json', {
        body: JSON.stringify(cleanup),
        contentType: 'application/json',
      })
    } catch (cleanupError) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, cleanupError],
          `PROCESS acceptance and cleanup failed; Worker logs: ${fixture.workerLogDir}`,
        )
      throw cleanupError
    }
  }
})
