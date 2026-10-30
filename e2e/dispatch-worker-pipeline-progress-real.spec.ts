import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import type { BrowserContext, Page, Request } from '@playwright/test'
import { expect, test, csrfHeaders } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { DispatchWorkerPipelineFixture } from './fixtures/runtime-progress/dispatchWorkerPipelineFixture'
import { requiredEnvironment } from './fixtures/closure-recovery/fixture'
import type { JobExecutionProgress } from '@/api/jobProgress'

const enabled = process.env.E2E_DISPATCH_WORKER_PROGRESS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; suite owns identities, processes and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(600_000)
test.skip(
  !enabled,
  'Requires isolated WDI services, object namespace, real NAS adapter and DISPATCH Worker',
)

async function initializePage(page: Page, tenantId: string) {
  await installE2eLocale(page)
  await seedBrowserStorage(page, { session: '1', tenantId, onboardingDone: '1' })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.addLocatorHandler(page.locator('.driver-popover-close-btn'), async (button) => {
    await button.click()
  })
}

test('真实DISPATCH传输中断保留未知结果，经核实审批恢复并发布唯一正确文件和回执', async ({
  page,
  browser,
}, testInfo) => {
  const fixture = new DispatchWorkerPipelineFixture()
  const snapshots: JobExecutionProgress[] = []
  let readerContext: BrowserContext | undefined
  let readerPage: Page | undefined
  let prepared = false
  let primaryError: unknown
  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
    fixture.prepare()
    prepared = true
    await fixture.login(page.request)
    await initializePage(page, fixture.tenantId)
    await page.exposeFunction('captureDispatchProgress', (data: unknown) => {
      snapshots.push(data as JobExecutionProgress)
    })
    await page.addInitScript(() => {
      const Native = window.EventSource
      window.EventSource = class extends Native {
        constructor(url: string | URL, options?: EventSourceInit) {
          super(url, options)
          this.addEventListener('job-execution-progress', (event) => {
            void (
              window as unknown as { captureDispatchProgress: (data: unknown) => Promise<void> }
            ).captureDispatchProgress(JSON.parse((event as MessageEvent).data).data)
          })
        }
      }
    })
    const uploadChannel = await fixture.mutate(page.request, '/api/console/file-channels', {
      tenantId: fixture.tenantId,
      channelCode: fixture.channelCode,
      channelName: 'Owned dispatch source upload',
      channelType: 'LOCAL',
      targetEndpoint: '',
      authType: 'NONE',
      configJson: '{}',
      receiptPolicy: 'NONE',
      timeoutSeconds: 15,
      enabled: true,
    })
    expect(uploadChannel.status(), await uploadChannel.text()).toBe(200)
    const presign = await fixture.mutate(
      page.request,
      '/api/console/files/presign-upload',
      undefined,
      'POST',
      { channelCode: fixture.channelCode, fileName: fixture.fileName },
    )
    expect(presign.status(), await presign.text()).toBe(200)
    const source = (await presign.json()).data as {
      fileId: number
      storageBucket: string
      storagePath: string
    }
    fixture.rememberUploadedSource(source)
    const bytes = Buffer.alloc(8 * 1024 * 1024, 'dispatch-source-record,12.50\n')
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const upload = await page.request.put(`/api/console/files/${source.fileId}/content`, {
      params: { tenantId: fixture.tenantId },
      headers: {
        ...(await csrfHeaders(page.request)),
        'X-Tenant-Id': fixture.tenantId,
        'Idempotency-Key': randomUUID(),
      },
      multipart: { file: { name: fixture.fileName, mimeType: 'text/csv', buffer: bytes } },
    })
    expect(upload.status(), await upload.text()).toBe(200)
    expect(
      (
        await fixture.mutate(page.request, `/api/console/files/${source.fileId}/confirm-arrival`)
      ).status(),
    ).toBe(200)
    expect(fixture.uploadState()).toMatchObject({
      fileId: source.fileId,
      fileSizeBytes: bytes.length,
      objectFileCount: 1,
    })
    const nasChannel = await fixture.mutate(page.request, '/api/console/file-channels', {
      tenantId: fixture.tenantId,
      channelCode: fixture.nasChannelCode,
      channelName: 'Owned real NAS publication',
      channelType: 'NAS',
      targetEndpoint: fixture.nasDirectory,
      authType: 'NONE',
      receiptPolicy: 'SYNC',
      timeoutSeconds: 120,
      enabled: true,
      configJson: JSON.stringify({
        nas_remote_directory: fixture.nasDirectory,
        nas_remote_file_name: fixture.remoteName,
        dispatch_manifest_enabled: true,
      }),
    })
    expect(nasChannel.status(), await nasChannel.text()).toBe(200)
    await fixture.startObjectProxy(
      requiredEnvironment('E2E_DISPATCH_OBJECT_UPSTREAM'),
      source.storagePath,
    )
    const payload = {
      fileId: String(source.fileId),
      channelCode: fixture.nasChannelCode,
      externalRequestId: `dispatch-${randomUUID()}`,
    }
    const job = await fixture.mutate(page.request, '/api/console/job-definitions', {
      tenantId: fixture.tenantId,
      jobCode: fixture.jobCode,
      jobName: 'Actual DISPATCH recovery',
      jobType: 'DISPATCH',
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      workerGroup: 'DISPATCH',
      calendarCode: fixture.calendarCode,
      timeoutSeconds: 300,
      retryPolicy: 'FIXED',
      retryMaxCount: 3,
      paramSchema: JSON.stringify({ type: 'object', additionalProperties: true }),
      defaultParams: JSON.stringify(payload),
      enabled: true,
    })
    expect(job.status(), await job.text()).toBe(200)
    fixture.rememberJobDefinition(Number((await job.json()).data.id))
    const definition = await fixture.mutate(page.request, '/api/console/workflow-definitions', {
      tenantId: fixture.tenantId,
      workflowCode: fixture.workflowCode,
      workflowName: 'Actual DISPATCH publication',
      workflowType: 'DAG',
      triggerMode: 'MIXED',
      enabled: true,
      scheduleType: 'MANUAL',
      timezone: 'UTC',
      calendarCode: fixture.calendarCode,
      nodes: [
        { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
        {
          nodeCode: 'GATEWAY',
          nodeName: 'Gateway',
          nodeType: 'GATEWAY',
          nodeOrder: 1,
          enabled: true,
        },
        {
          nodeCode: 'DELIVERY',
          nodeName: 'Delivery',
          nodeType: 'JOB',
          relatedJobCode: fixture.jobCode,
          nodeOrder: 2,
          enabled: true,
        },
        { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 3, enabled: true },
      ],
      edges: [
        { fromNodeCode: 'START', toNodeCode: 'GATEWAY', edgeType: 'ALWAYS', enabled: true },
        { fromNodeCode: 'GATEWAY', toNodeCode: 'DELIVERY', edgeType: 'ALWAYS', enabled: true },
        { fromNodeCode: 'DELIVERY', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true },
      ],
    })
    expect(definition.status(), await definition.text()).toBe(200)
    const workflowId = Number((await definition.json()).data.id)
    await fixture.startWorker()
    const triggered = await fixture.mutate(
      page.request,
      `/api/console/workflow-definitions/${workflowId}/trigger`,
      {
        tenantId: fixture.tenantId,
        bizDate: fixture.bizDate,
        triggerType: 'MANUAL',
        payload: JSON.stringify(payload),
      },
    )
    expect(triggered.status(), await triggered.text()).toBe(200)
    await expect
      .poll(
        () =>
          fixture
            .destinationFiles()
            .some(
              (file) =>
                file.name.startsWith(`${fixture.remoteName}.tmp-`) &&
                file.bytes > 65536 &&
                file.bytes < bytes.length,
            ),
        { timeout: 120_000, intervals: [1000] },
      )
      .toBe(true)
    const running = fixture.dispatchState()
    expect(running.deliveries).toHaveLength(1)
    expect(running.deliveries[0]).toMatchObject({ status: 'CREATED', attempt: 1 })
    expect(running.pipelines).toHaveLength(1)
    expect(running.pipelines[0]).toMatchObject({ stage: 'DISPATCH', fileId: source.fileId })
    const sourceJobId = running.instances[0].id
    await page.goto(`/monitor/job-instances/${sourceJobId}`)
    const jobPanel = page.locator('.section-card').filter({ hasText: e2eText('jobProgress.title') })
    await expect(jobPanel.locator('.mini-dag__graph .node')).toHaveCount(6)
    await expect(jobPanel.locator('.mini-dag__graph .node.running')).toHaveCount(1)
    await expect
      .poll(() =>
        snapshots.some((s) => s.jobInstanceId === sourceJobId && s.currentStage === 'DISPATCH'),
      )
      .toBe(true)
    expect(existsSync(fixture.finalPath)).toBe(false)
    expect(existsSync(`${fixture.finalPath}.chk`)).toBe(false)
    const partialFiles = fixture.destinationFiles()
    expect(partialFiles.some((file) => file.bytes > 0 && file.bytes < bytes.length)).toBe(true)
    await testInfo.attach('dispatch-in-flight.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    await fixture.crashWorker()
    await fixture.startWorker()
    await expect
      .poll(() => fixture.dispatchState().runs[0]?.status, {
        timeout: 150_000,
        intervals: [1000, 2000],
      })
      .toBe('FAILED')
    await expect
      .poll(() => fixture.dispatchState().deadLetters.length, { timeout: 30_000 })
      .toBeGreaterThan(0)
    const unknown = fixture.dispatchState()
    expect(unknown.failedTaskCodes).toContain('EXTERNAL_OUTCOME_UNKNOWN')
    expect(unknown.deliveries[0]).toMatchObject({
      id: running.deliveries[0].id,
      attempt: 1,
      errorCode: 'EXTERNAL_OUTCOME_UNKNOWN',
    })
    expect(existsSync(fixture.finalPath)).toBe(false)
    expect(existsSync(`${fixture.finalPath}.chk`)).toBe(false)
    await expect(jobPanel.locator('.mini-dag__graph .node.failed')).toHaveCount(1)
    const gets: string[] = []
    const captureGet = (request: Request) => {
      if (
        request.method() === 'GET' &&
        /\/execution-progress$/.test(new URL(request.url()).pathname)
      )
        gets.push(request.url())
    }
    page.on('request', captureGet)
    await page.waitForTimeout(4500)
    page.off('request', captureGet)
    expect(fixture.transfers).toHaveLength(1)
    expect(gets).toEqual([])
    await testInfo.attach('dispatch-unknown.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })

    readerContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      storageState: { cookies: [], origins: [] },
      serviceWorkers: 'block',
    })
    readerPage = await readerContext.newPage()
    await fixture.login(readerPage.request, true)
    await initializePage(readerPage, fixture.tenantId)
    const dlq = unknown.deadLetters.find((row) => row.reason.includes('EXTERNAL_OUTCOME_UNKNOWN'))!
    expect(dlq).toBeDefined()
    const denied = await fixture.mutate(
      readerPage.request,
      '/api/console/jobs/dead-letters/replay',
      {
        tenantId: fixture.tenantId,
        deadLetterId: dlq.id,
        reason: 'Tenant administrator cannot request delivery replay',
      },
    )
    expect(denied.status()).toBe(403)
    await readerPage.goto('/observability/queries?tab=deadLetters')
    await expect(
      readerPage.locator('.el-table__row').filter({ hasText: 'EXTERNAL_OUTCOME_UNKNOWN' }),
    ).toHaveCount(1)
    await expect(readerPage.locator('.el-table-column--selection')).toHaveCount(0)
    await expect(
      readerPage.getByRole('button', { name: e2eText('rowActions.more'), exact: true }),
    ).toHaveCount(0)
    await expect(
      readerPage.getByRole('button', { name: e2eText('observability.dlqReplay'), exact: true }),
    ).toHaveCount(0)
    await expect(
      readerPage.getByRole('menuitem', { name: e2eText('observability.dlqReplay'), exact: true }),
    ).toHaveCount(0)

    await page.goto('/observability/queries?tab=deadLetters')
    const row = page.locator('.el-table__row').filter({ hasText: 'EXTERNAL_OUTCOME_UNKNOWN' })
    await expect(row).toHaveCount(1)
    await row.getByRole('button', { name: e2eText('rowActions.more') }).click()
    await page
      .getByRole('menuitem', { name: e2eText('observability.dlqReplay'), exact: true })
      .click()
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: e2eText('dangerConfirm.confirm'), exact: true })
      .click()
    const dialog = page.locator('.el-dialog:visible')
    await dialog
      .locator('.el-checkbox')
      .filter({ hasText: e2eText('observability.dlqExternalOutcomeVerified') })
      .click()
    await expect(
      dialog.getByRole('checkbox', { name: e2eText('observability.dlqExternalOutcomeVerified') }),
    ).toBeChecked()
    await dialog
      .locator('.el-form-item')
      .filter({ hasText: e2eText('observability.dlqReplayReason') })
      .locator('textarea')
      .fill('Verified final NAS file and manifest absent after interrupted temporary copy')
    const evidenceReference = `local-evidence://${fixture.workerCode}/nas-final-absent`
    await dialog
      .locator('.el-form-item')
      .filter({ hasText: e2eText('observability.dlqEvidenceReference') })
      .locator('input')
      .fill(evidenceReference)
    await dialog
      .getByRole('button', { name: e2eText('observability.dlqReplay'), exact: true })
      .click()
    await expect.poll(() => fixture.dispatchState().approvals.length).toBe(1)
    expect(fixture.transfers).toHaveLength(1)
    const pending = fixture.dispatchState().approvals[0]
    expect(pending).toMatchObject({ status: 'PENDING', requester: fixture.adminName })
    await readerPage.goto('/approvals')
    const approval = readerPage.locator('.el-table__row').filter({ hasText: pending.number })
    await expect(approval).toBeVisible()
    await approval
      .getByRole('button', { name: e2eText('approvals.actionApprove'), exact: true })
      .click()
    await readerPage
      .locator('.el-message-box')
      .getByRole('textbox')
      .fill('Approve once after independent NAS publication absence check')
    await readerPage
      .locator('.el-message-box')
      .getByRole('button', { name: e2eText('common.confirm'), exact: true })
      .click()
    await expect
      .poll(
        () => fixture.dispatchState().instances.filter((job) => job.status === 'SUCCESS').length,
        { timeout: 180_000, intervals: [1000, 2000] },
      )
      .toBe(1)
    const terminal = fixture.dispatchState()
    expect(terminal.instances).toHaveLength(2)
    expect(terminal.instances.find((job) => job.id === sourceJobId)?.status).toBe('FAILED')
    expect(terminal.runs.filter((run) => run.status === 'SUCCESS')).toHaveLength(1)
    expect(terminal.runs.find((run) => run.id === unknown.runs[0].id)?.status).toBe('FAILED')
    expect(terminal.deliveries).toHaveLength(1)
    expect(terminal.sourceObjectFileCount).toBe(1)
    expect(terminal.deliveries[0]).toMatchObject({
      id: running.deliveries[0].id,
      status: 'ACKED',
      receiptStatus: 'SUCCESS',
      attempt: 2,
      externalRequestId: payload.externalRequestId,
    })
    expect(terminal.resolutions.filter((task) => task.consumed)).toHaveLength(1)
    expect(terminal.approvals[0]).toMatchObject({
      status: 'EXECUTED',
      requester: fixture.adminName,
      approver: fixture.readerName,
    })
    expect(fixture.transfers).toHaveLength(2)
    expect(fixture.transfers[1]).toMatchObject({ complete: true, bytes: bytes.length, status: 200 })
    const actual = readFileSync(fixture.finalPath)
    expect(actual.length).toBe(bytes.length)
    expect(createHash('sha256').update(actual).digest('hex')).toBe(sha256)
    const manifest = JSON.parse(readFileSync(`${fixture.finalPath}.chk`, 'utf8'))
    expect(manifest).toMatchObject({
      schemaVersion: 'dispatch-sidecar-manifest-v1',
      sizeBytes: bytes.length,
      checksumValue: sha256,
      externalRequestId: payload.externalRequestId,
      receiptCode: terminal.deliveries[0].receiptCode,
      channelCode: fixture.nasChannelCode,
    })
    const targetJob = terminal.instances.find((job) => job.status === 'SUCCESS')!
    await page.goto(`/monitor/job-instances/${targetJob.id}`)
    await expect(jobPanel.locator('.mini-dag__graph .node')).toHaveCount(6)
    await expect(jobPanel.locator('.mini-dag__graph .node.success')).toHaveCount(4)
    await expect(jobPanel.locator('.mini-dag__graph .node.cancelled')).toHaveCount(2)
    for (const skipped of ['RETRY', 'COMPENSATE']) {
      await expect(jobPanel.locator('.el-table__row').filter({ hasText: skipped })).toContainText(
        e2eText('workflowProgress.states.NOT_EXECUTED'),
      )
    }
    expect(terminal.steps.filter((step) => step.status === 'RUNNING')).toEqual([])
    await testInfo.attach('dispatch-recovered.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    await testInfo.attach('dispatch-evidence.json', {
      body: JSON.stringify({
        running,
        unknown,
        terminal,
        partialFiles,
        transfers: fixture.transfers,
        bytes: bytes.length,
        sha256,
        receiptVerified: true,
        periodicGets: gets.length,
        evidenceReference,
        publishedFiles: fixture
          .destinationFiles()
          .filter(
            (file) => file.name === fixture.remoteName || file.name === `${fixture.remoteName}.chk`,
          ),
        snapshots,
      }),
      contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    await testInfo.attach('dispatch-failure-page.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    if (prepared)
      await testInfo.attach('dispatch-failure-state.json', {
        body: JSON.stringify({
          state: fixture.dispatchState(),
          transfers: fixture.transfers,
          destinationFiles: fixture.destinationFiles(),
        }),
        contentType: 'application/json',
      })
    throw error
  } finally {
    await page.goto('about:blank')
    await readerPage?.goto('about:blank')
    try {
      const cleanup = await fixture.finish(page.request, readerPage?.request)
      await testInfo.attach('dispatch-cleanup.json', {
        body: JSON.stringify(cleanup),
        contentType: 'application/json',
      })
    } catch (error) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, error],
          `DISPATCH acceptance and cleanup failed; Worker logs: ${fixture.workerLogDir}`,
        )
      throw error
    } finally {
      await readerContext?.close()
    }
  }
})
