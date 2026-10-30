import { createHash } from 'node:crypto'
import { request as requestFactory, type BrowserContext } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { ExportWorkflowReplayFixture } from './fixtures/runtime-progress/exportWorkflowReplayFixture'
import type { WorkflowExecutionProgress } from '@/api/workflowRuns'
import type { JobExecutionProgress } from '@/api/jobProgress'
import type { components } from '@/types/api.generated'

type WorkflowRunReplayPreview = components['schemas']['ConsoleWorkflowRunReplayPreviewResponse']

const enabled = process.env.E2E_WHOLE_WORKFLOW_REPLAY_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns identities, Worker and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(600_000)
test.skip(
  !enabled,
  'Requires isolated authenticated WDI services, PostgreSQL, MinIO and real EXPORT Worker',
)

test('整轮Workflow审批重放固定原图，EXPORT产物独立且GENERATE中断可恢复', async ({
  page,
  browser,
}, testInfo) => {
  const fixture = new ExportWorkflowReplayFixture()
  const admin = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  const reader = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  const workflowSnapshots: WorkflowExecutionProgress[] = []
  const jobSnapshots: JobExecutionProgress[] = []
  let approvalContext: BrowserContext | undefined
  let exportDataPrepared = false
  let primaryError: unknown
  try {
    fixture.prepare()
    fixture.prepareExport()
    exportDataPrepared = true
    await fixture.login(admin)
    await fixture.login(page.request)
    await fixture.login(reader, true)
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
    await page.exposeFunction('captureWholeReplayProgress', (kind: string, data: unknown) => {
      if (kind === 'workflow') workflowSnapshots.push(data as WorkflowExecutionProgress)
      else jobSnapshots.push(data as JobExecutionProgress)
    })
    await page.addInitScript(() => {
      const Native = window.EventSource
      window.EventSource = class extends Native {
        constructor(url: string | URL, options?: EventSourceInit) {
          super(url, options)
          for (const [name, kind] of [
            ['workflow-execution-progress', 'workflow'],
            ['job-execution-progress', 'job'],
          ]) {
            this.addEventListener(name, (event) => {
              void (
                window as unknown as {
                  captureWholeReplayProgress: (kind: string, data: unknown) => Promise<void>
                }
              ).captureWholeReplayProgress(kind, JSON.parse((event as MessageEvent).data).data)
            })
          }
        }
      }
    })
    const job = await fixture.mutate(admin, '/api/console/job-definitions', {
      tenantId: fixture.tenantId,
      jobCode: fixture.jobCode,
      jobName: 'Whole replay actual EXPORT',
      jobType: 'BUNDLE_EXPORT',
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      workerGroup: 'EXPORT',
      timeoutSeconds: 300,
      retryPolicy: 'FIXED',
      retryMaxCount: 3,
      calendarCode: fixture.calendarCode,
      paramSchema: JSON.stringify({ type: 'object', additionalProperties: true }),
      defaultParams: JSON.stringify({
        templateCode: fixture.templateCode,
        batchNo: fixture.batchNo,
        autoDispatch: false,
        bundleFiles: [{ templateCode: fixture.templateCode }],
      }),
      enabled: true,
    })
    expect(job.status(), await job.text()).toBe(200)
    fixture.rememberJobDefinition(Number((await job.json()).data.id))
    const nodes = [
      { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
      {
        nodeCode: 'GATEWAY',
        nodeName: 'Frozen gateway',
        nodeType: 'GATEWAY',
        nodeOrder: 1,
        enabled: true,
      },
      {
        nodeCode: 'EXPORT_JOB',
        nodeName: 'Actual EXPORT',
        nodeType: 'JOB',
        relatedJobCode: fixture.jobCode,
        nodeOrder: 2,
        enabled: true,
      },
      { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 4, enabled: true },
    ]
    const edge = (from: string, to: string) => ({
      fromNodeCode: from,
      toNodeCode: to,
      edgeType: 'SUCCESS',
      enabled: true,
    })
    const definitionBody = {
      tenantId: fixture.tenantId,
      workflowCode: fixture.workflowCode,
      workflowName: 'Whole EXPORT replay',
      workflowType: 'DAG',
      enabled: true,
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      calendarCode: fixture.calendarCode,
      nodes,
      edges: [edge('START', 'GATEWAY'), edge('GATEWAY', 'EXPORT_JOB'), edge('EXPORT_JOB', 'END')],
    }
    const created = await fixture.mutate(admin, '/api/console/workflow-definitions', definitionBody)
    expect(created.status(), await created.text()).toBe(200)
    const definitionId = Number((await created.json()).data.id)
    await fixture.startWorker()
    expect(fixture.exportState().workerCapabilities).toContainEqual(
      expect.objectContaining({
        pluginId: 'jdbc_mapped_export',
        externalEffectCategories: ['BUSINESS_DATABASE_READ'],
        idempotencyCapability: 'IDEMPOTENT_BY_PLUGIN_LOGIC',
      }),
    )
    const triggered = await fixture.mutate(
      admin,
      `/api/console/workflow-definitions/${definitionId}/trigger`,
      { tenantId: fixture.tenantId, bizDate: fixture.bizDate, triggerType: 'MANUAL' },
    )
    expect(triggered.status(), await triggered.text()).toBe(200)
    await expect
      .poll(() => fixture.exportState().runs[0]?.status, {
        timeout: 180_000,
        intervals: [1000, 2000],
      })
      .toBe('SUCCESS')
    const source = fixture.exportState()
    expect(source.files).toHaveLength(1)
    expect(source.pipelines).toHaveLength(1)
    expect(source.checkpoints).toContainEqual(
      expect.objectContaining({ stage: 'GENERATE', processedCount: 1200, completed: true }),
    )
    const sourceRunId = source.runs[0].id
    const sourceJobId = source.instances[0].id
    const originalFile = source.files[0]
    const originalBytes = fixture.readUploadedObject(originalFile.bucket, originalFile.path)
    const verifyCsv = (bytes: Buffer) => {
      const lines = bytes.toString('utf8').trim().split(/\r?\n/)
      expect(lines).toHaveLength(1201)
      expect(lines[0]).toBe('recordNo,amount')
      const records = lines.slice(1).map((line) => line.split(','))
      expect(new Set(records.map(([key]) => key)).size).toBe(1200)
      expect(records.some(([key]) => key === 'OUTSIDE-TENANT')).toBe(false)
      for (const [index, [key, amount]] of records.entries()) {
        expect(key).toBe(String(index + 1).padStart(6, '0'))
        expect(Number(amount)).toBe((index + 1) * 1.25)
      }
    }
    verifyCsv(originalBytes)
    expect(createHash('sha256').update(originalBytes).digest('hex')).toBe(originalFile.sha256)
    await page.goto(`/monitor/workflow-runs/${sourceRunId}`)
    const replayButton = page.getByRole('button', {
      name: e2eText('monitor.replayWholeWorkflowButton'),
      exact: true,
    })
    await expect(replayButton).toBeVisible()
    approvalContext = await browser.newContext({
      storageState: await reader.storageState(),
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 1100 },
    })
    const approvalPage = await approvalContext.newPage()
    await installE2eLocale(approvalPage)
    await seedBrowserStorage(approvalPage, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await approvalPage.addLocatorHandler(
      approvalPage.locator('.driver-popover-close-btn'),
      async (button) => {
        await button.click()
      },
    )
    await page.goto(`/monitor/job-instances/${sourceJobId}`)
    await expect(
      page.getByRole('button', { name: e2eText('monitor.detailRerunBtn'), exact: true }),
    ).toBeVisible()
    await approvalPage.goto(`/monitor/job-instances/${sourceJobId}`)
    await expect(
      approvalPage
        .locator('.section-card')
        .filter({ hasText: e2eText('jobProgress.title') })
        .locator('.mini-dag__graph .node'),
    ).toHaveCount(5)
    await expect(
      approvalPage.getByRole('button', { name: e2eText('monitor.detailRerunBtn'), exact: true }),
    ).toHaveCount(0)
    const sourceDetail = await fixture.mutate(
      reader,
      `/api/console/queries/instances/${sourceJobId}`,
      undefined,
      'GET',
    )
    expect(sourceDetail.status()).toBe(200)
    const sourceInstance = (await sourceDetail.json()).data
    const deniedRerun = await fixture.mutate(reader, '/api/console/jobs/rerun', {
      tenantId: fixture.tenantId,
      targetInstanceNo: sourceInstance.instanceNo,
      jobCode: fixture.jobCode,
      bizDate: fixture.bizDate,
      reason: 'Tenant administrator must not rerun',
    })
    expect(deniedRerun.status()).toBe(403)
    const deniedCancel = await fixture.mutate(
      reader,
      `/api/console/instances/${sourceJobId}/cancel`,
    )
    expect(deniedCancel.status()).toBe(403)
    const listQuery = new URLSearchParams({
      jobCode: fixture.jobCode,
      range: 'all',
    })
    await approvalPage.goto(`/monitor/job-instances?${listQuery}`)
    await expect(
      approvalPage.locator('.el-table__row').filter({ hasText: fixture.jobCode }),
    ).toHaveCount(1)
    await expect(approvalPage.locator('.el-table-column--selection')).toHaveCount(0)
    await expect(approvalPage.locator('.bulk-action-bar')).toHaveCount(0)
    await page.goto(`/monitor/workflow-runs/${sourceRunId}`)
    await approvalPage.goto(`/monitor/workflow-runs/${sourceRunId}`)
    await expect(
      approvalPage.getByRole('button', {
        name: e2eText('monitor.replayWholeWorkflowButton'),
        exact: true,
      }),
    ).toHaveCount(0)
    expect(
      (
        await fixture.mutate(reader, '/api/console/jobs/workflow-run/replay-preview', {
          tenantId: fixture.tenantId,
          workflowRunId: sourceRunId,
          reason: 'Whole replay role boundary',
        })
      ).status(),
    ).toBe(403)
    await fixture.stopWorker()
    await expect.poll(() => fixture.exportState().worker?.status).toBe('DECOMMISSIONED')
    const blockedPreview = page.waitForResponse(
      (response) =>
        response.url().includes('/jobs/workflow-run/replay-preview') &&
        response.request().method() === 'POST',
    )
    await replayButton.click()
    expect((await blockedPreview).status()).toBe(200)
    await expect(page.locator('.el-message-box')).toContainText('NO_ONLINE_WORKERS')
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: e2eText('common.close'), exact: true })
      .click()
    expect(fixture.exportState().operations).toEqual([])
    expect(fixture.exportState().approvals).toEqual([])
    await fixture.startWorker()
    const lock = await fixture.mutate(
      admin,
      `/api/console/workflow-definitions/${definitionId}/lock`,
      undefined,
      'PUT',
    )
    expect(lock.status(), await lock.text()).toBe(200)
    try {
      const changed = await fixture.mutate(
        admin,
        `/api/console/workflow-definitions/${definitionId}/full`,
        {
          definition: {
            ...definitionBody,
            nodes: [
              ...nodes,
              {
                nodeCode: 'NEW_NODE',
                nodeName: 'Changed current definition',
                nodeType: 'GATEWAY',
                nodeOrder: 3,
                enabled: true,
              },
            ],
            edges: [
              edge('START', 'GATEWAY'),
              edge('GATEWAY', 'EXPORT_JOB'),
              edge('EXPORT_JOB', 'NEW_NODE'),
              edge('NEW_NODE', 'END'),
            ],
          },
          expectedVersion: 1,
        },
        'PUT',
      )
      expect(changed.status(), await changed.text()).toBe(200)
      expect((await changed.json()).data.version).toBe(2)
    } finally {
      const unlocked = await fixture.mutate(
        admin,
        `/api/console/workflow-definitions/${definitionId}/lock`,
        undefined,
        'DELETE',
      )
      expect(unlocked.status(), await unlocked.text()).toBe(204)
    }
    const permittedPreview = page.waitForResponse(
      (response) =>
        response.url().includes('/jobs/workflow-run/replay-preview') &&
        response.request().method() === 'POST',
    )
    await replayButton.click()
    const previewResponse = await permittedPreview
    expect(previewResponse.status(), await previewResponse.text()).toBe(200)
    const preview = (await previewResponse.json()).data as WorkflowRunReplayPreview
    expect(preview.workflowVersion).toBe(1)
    expect(preview.nodes.map((node) => node.nodeCode)).toEqual([
      'START',
      'GATEWAY',
      'EXPORT_JOB',
      'END',
    ])
    expect(preview.nodes.every((node) => node.blockers.length === 0)).toBe(true)
    expect(preview.nodes.find((node) => node.nodeCode === 'EXPORT_JOB')?.capability?.status).toBe(
      'DECLARED_CONSISTENT',
    )
    const submitted = page.waitForResponse(
      (response) =>
        response.url().includes('/jobs/workflow-run/replay-operations') &&
        response.request().method() === 'POST',
    )
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: e2eText('monitor.replayWholeWorkflowButton'), exact: true })
      .click()
    expect((await submitted).status()).toBe(200)
    await expect.poll(() => fixture.exportState().approvals.length).toBe(1)
    const pending = fixture.exportState()
    expect(pending.operations).toEqual([
      expect.objectContaining({
        status: 'PENDING_APPROVAL',
        sourceRunId,
        targetRunId: null,
        resultPolicy: 'CREATE_NEW_VERSION',
        configPolicy: 'USE_ORIGINAL_CONFIG',
      }),
    ])
    expect(pending.runs).toHaveLength(1)
    await approvalPage.goto('/approvals')
    const approvalRow = approvalPage
      .locator('.el-table__row')
      .filter({ hasText: pending.approvals[0].number })
    await expect(approvalRow).toBeVisible()
    await approvalRow.getByRole('button', { name: e2eText('rowActions.more') }).click()
    await expect(
      approvalPage.getByRole('menuitem', { name: e2eText('approvals.actionReject'), exact: true }),
    ).toBeVisible()
    await expect(approvalPage.locator('.el-drawer:visible')).toHaveCount(0)
    await approvalPage.keyboard.press('Escape')
    const approve = approvalRow.getByRole('button', {
      name: e2eText('approvals.actionApprove'),
      exact: true,
    })
    await expect(approve).toBeVisible()
    await approve.click()
    await approvalPage
      .locator('.el-message-box')
      .getByRole('textbox')
      .fill('Approve exact frozen EXPORT Workflow replay')
    await approvalPage
      .locator('.el-message-box')
      .getByRole('button', { name: e2eText('common.confirm'), exact: true })
      .click()
    await expect
      .poll(() => fixture.exportState().operations[0]?.targetRunId, { timeout: 60_000 })
      .toBeGreaterThan(0)
    const targetRunId = fixture.exportState().operations[0].targetRunId!
    await expect.poll(() => fixture.exportState().pipelines.length, { timeout: 90_000 }).toBe(2)
    const targetPipeline = fixture
      .exportState()
      .pipelines.find((pipeline) => pipeline.jobInstanceId !== sourceJobId)!
    await expect
      .poll(
        () =>
          fixture
            .exportState()
            .checkpoints.some(
              (row) =>
                row.pipelineId === targetPipeline.id &&
                row.stage === 'GENERATE' &&
                row.processedCount >= 25 &&
                !row.completed,
            ),
        { timeout: 90_000 },
      )
      .toBe(true)
    await page.goto(`/monitor/job-instances/${targetPipeline.jobInstanceId}`)
    const jobPanel = page.locator('.section-card').filter({ hasText: e2eText('jobProgress.title') })
    await expect(jobPanel.locator('.mini-dag__graph .node')).toHaveCount(5)
    await expect(jobPanel.locator('.mini-dag__graph .node.running')).toHaveCount(1)
    await expect(jobPanel.locator('.live-status-badge--live')).toBeVisible()
    await expect
      .poll(() =>
        jobSnapshots.some(
          (snapshot) =>
            snapshot.jobInstanceId === targetPipeline.jobInstanceId &&
            snapshot.currentStage === 'GENERATE',
        ),
      )
      .toBe(true)
    const beforeCrash = fixture.exportState()
    await testInfo.attach('whole-replay-export-running.png', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    })
    await fixture.stopWorker('SIGKILL')
    await fixture.startWorker()
    await expect
      .poll(() => fixture.exportState().operations[0]?.status, {
        timeout: 240_000,
        intervals: [1000, 2000],
      })
      .toBe('SUCCEEDED')
    const terminal = fixture.exportState()
    expect(terminal.runs).toEqual([
      expect.objectContaining({ id: sourceRunId, status: 'SUCCESS' }),
      expect.objectContaining({ id: targetRunId, status: 'SUCCESS' }),
    ])
    expect(terminal.instances).toHaveLength(2)
    expect(terminal.instances.every((row) => row.status === 'SUCCESS')).toBe(true)
    expect(terminal.pipelines).toHaveLength(2)
    expect(
      terminal.pipelines.every((row) => row.status === 'SUCCESS' && row.systemCode === 'EXPORT'),
    ).toBe(true)
    expect(terminal.steps.filter((step) => step.status === 'RUNNING')).toEqual([])
    expect(terminal.steps).toContainEqual(
      expect.objectContaining({
        pipelineId: targetPipeline.id,
        stage: 'GENERATE',
        runSeq: 1,
        status: 'FAILED',
        errorCode: 'PIPELINE_ATTEMPT_INTERRUPTED',
      }),
    )
    expect(
      terminal.steps.some(
        (step) =>
          step.pipelineId === targetPipeline.id &&
          step.stage === 'GENERATE' &&
          step.runSeq >= 2 &&
          step.status === 'SUCCESS',
      ),
    ).toBe(true)
    expect(terminal.checkpoints.filter((row) => row.stage === 'GENERATE')).toEqual([
      expect.objectContaining({ processedCount: 1200, completed: true }),
      expect.objectContaining({ processedCount: 1200, completed: true }),
    ])
    expect(terminal.businessRows).toBe(1200)
    expect(terminal.distinctRows).toBe(1200)
    expect(terminal.files).toHaveLength(2)
    expect(new Set(terminal.files.map((file) => file.path)).size).toBe(2)
    for (const file of terminal.files) {
      const bytes = fixture.readUploadedObject(file.bucket, file.path)
      verifyCsv(bytes)
      expect(bytes).toEqual(originalBytes)
      expect(bytes.length).toBe(file.size)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256)
    }
    expect(fixture.readUploadedObject(originalFile.bucket, originalFile.path)).toEqual(
      originalBytes,
    )
    expect(terminal.approvals[0]).toMatchObject({
      status: 'EXECUTED',
      requester: fixture.adminName,
      approver: fixture.readerName,
      targetType: 'WORKFLOW_RUN',
      targetId: String(sourceRunId),
    })
    expect(terminal.operations[0]).toMatchObject({
      sourceRunId,
      targetRunId,
      total: 1,
      succeeded: 1,
      inFlight: 0,
      requestedBy: fixture.adminName,
      approvedBy: fixture.readerName,
    })
    await page.goto(`/monitor/workflow-runs/${targetRunId}`)
    const workflowPanel = page
      .locator('.section-card')
      .filter({ hasText: e2eText('workflowProgress.title') })
    await expect(workflowPanel.locator('.mini-dag__graph .node.success')).toHaveCount(4)
    await expect(workflowPanel).not.toContainText('NEW_NODE')
    await expect
      .poll(() =>
        workflowSnapshots.some(
          (snapshot) =>
            snapshot.workflowRunId === targetRunId &&
            snapshot.workflowVersion === 1 &&
            snapshot.nodes.length === 4 &&
            snapshot.runStatus === 'SUCCESS',
        ),
      )
      .toBe(true)
    await expect(page.locator('.driver-overlay')).toHaveCount(0)
    await testInfo.attach('whole-replay-export-succeeded.png', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    })
    const periodicGets: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname.endsWith('/execution-progress')
      )
        periodicGets.push(request.url())
    })
    await page.waitForTimeout(4500)
    expect(periodicGets).toEqual([])
    await testInfo.attach('whole-replay-export-evidence.json', {
      body: JSON.stringify({
        sourceRunId,
        targetRunId,
        sourceJobId,
        beforeCrash,
        terminal,
        preview: {
          workflowVersion: preview.workflowVersion,
          nodes: preview.nodes,
          edges: preview.edges,
          resultPolicy: preview.resultPolicy,
          configPolicy: preview.configVersionPolicy,
        },
        sourceArtifactSha256: originalFile.sha256,
        originalArtifactUnchanged: true,
        distinctOutputPaths: true,
        rowsPerOutput: 1200,
        noCrossTenantRow: true,
        tenantAdminJobRerunStatus: deniedRerun.status(),
        tenantAdminJobCancelStatus: deniedCancel.status(),
        tenantAdminJobWriteControlsHidden: true,
        moreMenuDoesNotOpenRowDetail: true,
        periodicGets: 0,
        workflowSnapshots,
        jobSnapshots,
      }),
      contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    if (exportDataPrepared)
      await testInfo.attach('whole-replay-export-failure.json', {
        body: JSON.stringify(fixture.exportState()),
        contentType: 'application/json',
      })
    throw error
  } finally {
    await page.goto('about:blank')
    await approvalContext?.close()
    try {
      const cleanup = await fixture.finish(admin, reader)
      await testInfo.attach('whole-replay-export-cleanup.json', {
        body: JSON.stringify(cleanup),
        contentType: 'application/json',
      })
    } catch (error) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, error],
          `整轮EXPORT重放及清理失败；日志：${fixture.workerLogDir}`,
        )
      throw error
    } finally {
      await admin.dispose()
      await reader.dispose()
    }
  }
})
