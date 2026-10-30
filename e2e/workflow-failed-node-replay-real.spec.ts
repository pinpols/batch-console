import { request as requestFactory, type BrowserContext } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { WorkflowReplayFixture } from './fixtures/runtime-progress/workflowReplayFixture'
import type { WorkflowExecutionProgress } from '@/api/workflowRuns'

const enabled = process.env.E2E_WORKFLOW_NODE_REPLAY_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns identities, Worker and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(360_000)
test.skip(!enabled, 'Requires isolated WDI services, PostgreSQL and real Atomic Worker')

for (const mode of ['sql-unknown', 'http-get'] as const) {
  test(`真实失败DAG的重放边界：${mode}`, async ({ page, browser }, testInfo) => {
    const fixture = new WorkflowReplayFixture()
    const admin = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
    const reader = await requestFactory.newContext({
      baseURL: String(testInfo.project.use.baseURL),
    })
    let approvalContext: BrowserContext | undefined
    const snapshots: WorkflowExecutionProgress[] = []
    const periodicGets: string[] = []
    let prepared = false
    let primaryError: unknown
    try {
      expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
      fixture.prepare()
      prepared = true
      fixture.prepareReplayInput()
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
      await page.exposeFunction('captureReplayProgress', (data: WorkflowExecutionProgress) => {
        snapshots.push(data)
      })
      await page.addInitScript(() => {
        const Native = window.EventSource
        window.EventSource = class extends Native {
          constructor(url: string | URL, options?: EventSourceInit) {
            super(url, options)
            this.addEventListener('workflow-execution-progress', (event) => {
              const value = JSON.parse((event as MessageEvent).data).data
              void (
                window as unknown as {
                  captureReplayProgress: (data: unknown) => Promise<void>
                }
              ).captureReplayProgress(value)
            })
          }
        }
      })
      const inputUrl = mode === 'http-get' ? await fixture.startInputServer() : undefined
      const job = await fixture.mutate(admin, '/api/console/job-definitions', {
        tenantId: fixture.tenantId,
        jobCode: fixture.jobCode,
        jobName: 'Failed node replay acceptance',
        jobType: 'ATOMIC',
        scheduleType: 'MANUAL',
        triggerMode: 'MIXED',
        workerGroup: 'ATOMIC',
        timeoutSeconds: 90,
        retryMaxCount: 0,
        calendarCode: fixture.calendarCode,
        paramSchema: JSON.stringify({ type: 'object', additionalProperties: true }),
        defaultParams: JSON.stringify(
          mode === 'sql-unknown'
            ? {
                taskType: 'sql',
                sql: 'SELECT 1 / 0',
              }
            : { taskType: 'http', method: 'GET', url: inputUrl, expectStatus: [200] },
        ),
        enabled: true,
      })
      expect(job.status(), await job.text()).toBe(200)
      fixture.rememberJobDefinition(Number((await job.json()).data.id))
      const controlCodes = ['START', 'FORK', 'LEFT', 'RIGHT', 'JOIN']
      const nodes = [
        ...controlCodes.map((code, index) => ({
          nodeCode: code,
          nodeName: code,
          nodeType: code === 'START' ? 'START' : 'GATEWAY',
          ...(code === 'JOIN' ? { nodeParams: JSON.stringify({ joinMode: 'ALL' }) } : {}),
          nodeOrder: index,
          enabled: true,
        })),
        {
          nodeCode: 'FAIL_JOB',
          nodeName: 'Actual failed task',
          nodeType: 'JOB',
          relatedJobCode: fixture.jobCode,
          nodeOrder: 5,
          enabled: true,
        },
        { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 6, enabled: true },
      ]
      const edges = [
        ['START', 'FORK'],
        ['FORK', 'LEFT'],
        ['FORK', 'RIGHT'],
        ['LEFT', 'JOIN'],
        ['RIGHT', 'JOIN'],
        ['JOIN', 'FAIL_JOB'],
        ['FAIL_JOB', 'END'],
      ].map(([from, to]) => ({
        fromNodeCode: from,
        toNodeCode: to,
        edgeType: from === 'START' || from === 'FORK' ? 'ALWAYS' : 'SUCCESS',
        enabled: true,
      }))
      const definition = await fixture.mutate(admin, '/api/console/workflow-definitions', {
        tenantId: fixture.tenantId,
        workflowCode: fixture.workflowCode,
        workflowName: 'Split join and failed node replay acceptance',
        workflowType: 'DAG',
        enabled: true,
        scheduleType: 'MANUAL',
        triggerMode: 'MIXED',
        calendarCode: fixture.calendarCode,
        nodes,
        edges,
      })
      expect(definition.status(), await definition.text()).toBe(200)
      const definitionId = Number((await definition.json()).data.id)
      await fixture.startWorker()
      const trigger = await fixture.mutate(
        admin,
        `/api/console/workflow-definitions/${definitionId}/trigger`,
        { tenantId: fixture.tenantId, bizDate: fixture.bizDate, triggerType: 'MANUAL' },
      )
      expect(trigger.status(), await trigger.text()).toBe(200)
      await expect
        .poll(() => fixture.replayState().runs[0]?.status, { timeout: 90_000, intervals: [1000] })
        .toBe('FAILED')
      const failed = fixture.replayState()
      expect(failed.failedTaskCodes).toEqual([
        mode === 'sql-unknown' ? 'EXTERNAL_OUTCOME_UNKNOWN' : 'EXECUTION_FAILED',
      ])
      const sourceRunId = failed.runs[0].id
      const failedNode = failed.nodes.find((node) => node.code === 'FAIL_JOB')!
      expect(failedNode.status).toBe('FAILED')
      expect(failedNode.jobInstanceId).toBeGreaterThan(0)
      for (const code of controlCodes)
        expect(failed.nodes.find((node) => node.code === code)?.status).toBe('SUCCESS')
      expect(failed.nodes.find((node) => node.code === 'END')).toBeUndefined()
      const sourceProgress = await page.request.get(
        `/api/console/workflow-runs/${sourceRunId}/execution-progress`,
        { params: { tenantId: fixture.tenantId }, headers: { 'X-Tenant-Id': fixture.tenantId } },
      )
      expect(sourceProgress.status(), await sourceProgress.text()).toBe(200)
      const frozenProgress = (await sourceProgress.json()).data as WorkflowExecutionProgress
      expect(frozenProgress.nodes).toHaveLength(7)
      expect(frozenProgress.nodes).toContainEqual(
        expect.objectContaining({ nodeCode: 'END', nodeStatus: 'NOT_EXECUTED' }),
      )
      expect(fixture.workerProgressState().instances).toEqual([
        expect.objectContaining({ id: failedNode.jobInstanceId, status: 'FAILED' }),
      ])
      await page.goto(`/monitor/workflow-runs/${sourceRunId}`)
      const progressPanel = page
        .locator('.section-card')
        .filter({ hasText: e2eText('workflowProgress.title') })
      await expect(progressPanel.locator('.mini-dag__graph .node')).toHaveCount(7)
      await expect(progressPanel.locator('.mini-dag__graph .node.failed')).toHaveCount(1)
      await expect(progressPanel.locator('.mini-dag__graph .node.success')).toHaveCount(5)
      await expect(page.getByTestId('workflow-progress-focus')).toHaveText('FAIL_JOB')
      await expect
        .poll(() =>
          progressPanel
            .locator('.mini-dag__graph')
            .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        )
        .toBe(true)

      await testInfo.attach('workflow-source-failed.png', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })
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
      await approvalPage.goto(`/monitor/workflow-runs/${sourceRunId}`)
      const readerRecords = approvalPage
        .locator('.section-card')
        .filter({ hasText: e2eText('monitor.nodeRunsHeader') })
      await readerRecords
        .getByRole('button', { name: e2eText('common.detail'), exact: true })
        .click()
      await expect(
        approvalPage.getByRole('button', {
          name: e2eText('monitor.nodeActionReplayJob'),
          exact: true,
        }),
      ).toHaveCount(0)
      await expect(
        approvalPage.getByRole('button', {
          name: e2eText('monitor.replayWholeWorkflowButton'),
          exact: true,
        }),
      ).toHaveCount(0)
      const deniedPreview = await fixture.mutate(
        reader,
        '/api/console/jobs/workflow-node/replay-preview',
        {
          tenantId: fixture.tenantId,
          workflowRunId: sourceRunId,
          workflowNodeRunId: failedNode.id,
          reason: 'Read-only replay boundary',
        },
      )
      expect(deniedPreview.status()).toBe(403)
      const nodeRecords = page.locator('.section-card').filter({
        hasText: e2eText('monitor.nodeRunsHeader'),
      })
      await nodeRecords.getByRole('button', { name: e2eText('common.detail'), exact: true }).click()
      await expect(
        nodeRecords.getByRole('button', {
          name: e2eText('monitor.nodeActionReplayJob'),
          exact: true,
        }),
      ).toBeVisible()
      if (mode === 'sql-unknown') {
        const rejected = page.waitForResponse(
          (response) =>
            response.url().includes('/api/console/jobs/workflow-node/replay-preview') &&
            response.request().method() === 'POST',
        )
        await page
          .getByRole('button', { name: e2eText('monitor.nodeActionReplayJob'), exact: true })
          .click()
        expect((await rejected).status()).toBe(409)
        await expect(page.locator('.el-message--error')).toBeVisible()
        expect(fixture.replayState().operations).toEqual([])
        expect(fixture.replayState().approvals).toEqual([])
        expect(fixture.replayState().runs).toEqual([
          expect.objectContaining({ id: sourceRunId, status: 'FAILED' }),
        ])
        await testInfo.attach('workflow-unknown-outcome-blocked.json', {
          body: JSON.stringify({
            sourceRunId,
            errorCode: failed.failedTaskCodes[0],
            previewStatus: 409,
            approvals: 0,
            operations: 0,
            runs: 1,
          }),
          contentType: 'application/json',
        })
        return
      }
      expect(fixture.httpResults).toEqual([503])
      await page
        .getByRole('button', { name: e2eText('monitor.nodeActionReplayJob'), exact: true })
        .click()
      const previewDialog = page.locator('.el-message-box')
      await expect(previewDialog).toContainText(fixture.jobCode)
      await expect(previewDialog).toContainText(String(failedNode.jobInstanceId))
      const submitted = page.waitForResponse(
        (response) =>
          response.url().includes('/api/console/jobs/compensations') &&
          response.request().method() === 'POST',
      )
      await previewDialog
        .getByRole('button', { name: e2eText('monitor.nodeActionReplayJob'), exact: true })
        .click()
      expect((await submitted).status()).toBe(200)
      await expect.poll(() => fixture.replayState().approvals.length).toBe(1)
      const pending = fixture.replayState()
      expect(pending.approvals[0]).toMatchObject({
        status: 'PENDING',
        requester: fixture.adminName,
        targetType: 'WORKFLOW_NODE',
        targetId: String(failedNode.id),
      })
      expect(pending.operations).toEqual([
        expect.objectContaining({
          status: 'PENDING_APPROVAL',
          sourceRunId,
          sourceNodeId: failedNode.id,
          sourceJobId: failedNode.jobInstanceId,
          targetRunId: null,
        }),
      ])
      expect(pending.runs).toHaveLength(1)
      expect(pending.commands).toEqual([])
      fixture.repairBusinessInput()

      await approvalPage.goto('/approvals')
      const approvalRow = approvalPage.locator('.el-table__row').filter({
        hasText: pending.approvals[0].number,
      })
      await expect(approvalRow).toBeVisible()
      const approveButton = approvalRow.getByRole('button', {
        name: e2eText('approvals.actionApprove'),
        exact: true,
      })
      if (await approveButton.isVisible()) await approveButton.click()
      else {
        await approvalRow.getByRole('button', { name: e2eText('rowActions.more') }).click()
        await approvalPage
          .getByRole('menuitem', { name: e2eText('approvals.actionApprove'), exact: true })
          .click()
      }
      const approvalDialog = approvalPage.locator('.el-message-box')
      await approvalDialog
        .getByRole('textbox')
        .fill('Business input repaired; replay exact failed node')
      await approvalDialog
        .getByRole('button', { name: e2eText('common.confirm'), exact: true })
        .click()
      await expect
        .poll(() => fixture.replayState().approvals[0]?.status, { timeout: 45_000 })
        .toBe('EXECUTED')
      await expect
        .poll(() => fixture.replayState().operations[0]?.targetRunId, { timeout: 45_000 })
        .toBeGreaterThan(0)
      const targetRunId = fixture.replayState().operations[0].targetRunId!
      expect(targetRunId).not.toBe(sourceRunId)
      await page.goto(`/monitor/workflow-runs/${targetRunId}`)
      await expect(progressPanel.locator('.live-status-badge--live')).toBeVisible()
      await expect
        .poll(() =>
          snapshots.some(
            (snapshot) =>
              snapshot.workflowRunId === targetRunId &&
              snapshot.runStatus === 'RUNNING' &&
              snapshot.nodes.some((node) => node.jobInstanceStatus === 'RUNNING'),
          ),
        )
        .toBe(true)
      await expect.poll(() => fixture.pendingInputRequests).toBe(1)
      fixture.releaseSuccessfulInput()
      await expect
        .poll(() => fixture.replayState().operations[0]?.status, {
          timeout: 90_000,
          intervals: [1000],
        })
        .toBe('SUCCEEDED')
      const terminal = fixture.replayState()
      expect(terminal.approvals[0]).toMatchObject({
        status: 'EXECUTED',
        requester: fixture.adminName,
        approver: fixture.readerName,
      })
      expect(terminal.operations[0]).toMatchObject({
        sourceRunId,
        sourceNodeId: failedNode.id,
        sourceJobId: failedNode.jobInstanceId,
        targetRunId,
        status: 'SUCCEEDED',
        total: 1,
        succeeded: 1,
        inFlight: 0,
        requestedBy: fixture.adminName,
        approvedBy: fixture.readerName,
      })
      expect(terminal.runs.find((run) => run.id === sourceRunId)?.status).toBe('FAILED')
      expect(terminal.runs.find((run) => run.id === targetRunId)?.status).toBe('SUCCESS')
      const targetNodes = terminal.nodes.filter((node) => node.runId === targetRunId)
      expect(targetNodes.length).toBeGreaterThan(0)
      expect(targetNodes.every((node) => node.status === 'SUCCESS')).toBe(true)
      expect(fixture.workerProgressState().instances.map((row) => row.status)).toEqual([
        'FAILED',
        'SUCCESS',
      ])
      expect(fixture.httpResults).toEqual([503, 200])
      await expect
        .poll(() =>
          snapshots.some(
            (snapshot) =>
              snapshot.workflowRunId === targetRunId && snapshot.runStatus === 'SUCCESS',
          ),
        )
        .toBe(true)
      await expect(progressPanel.locator('.mini-dag__graph .node.success')).toHaveCount(
        targetNodes.length,
      )
      const finishedSnapshot = [...snapshots]
        .reverse()
        .find(
          (snapshot) => snapshot.workflowRunId === targetRunId && snapshot.runStatus === 'SUCCESS',
        )!
      expect(finishedSnapshot.startedAt).toBeTruthy()
      expect(finishedSnapshot.finishedAt).toBeTruthy()
      const persistedRun = terminal.runs.find((run) => run.id === targetRunId)!
      expect(Date.parse(finishedSnapshot.startedAt!)).toBe(persistedRun.startedAtMs)
      expect(Date.parse(finishedSnapshot.finishedAt!)).toBe(persistedRun.finishedAtMs)
      await expect(page.getByTestId('workflow-finished-at')).toHaveAttribute('datetime', /.+/)
      expect(
        Date.parse((await page.getByTestId('workflow-finished-at').getAttribute('datetime'))!),
      ).toBe(persistedRun.finishedAtMs)
      await testInfo.attach('workflow-replay-succeeded.png', {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png',
      })
      page.on('request', (request) => {
        if (
          request.method() === 'GET' &&
          request.url().includes('/execution-progress') &&
          !request.url().includes('/events')
        )
          periodicGets.push(request.url())
      })
      await page.waitForTimeout(4500)
      expect(periodicGets).toEqual([])
      await testInfo.attach('workflow-replay-evidence.json', {
        body: JSON.stringify({
          sourceRunId,
          targetRunId,
          terminal,
          periodicGets: periodicGets.length,
          pushedSnapshots: snapshots.length,
          httpResults: fixture.httpResults,
          successfulResponseHeldUntilRunningPush: true,
          finishedAtVerifiedFromPush: true,
        }),
        contentType: 'application/json',
      })
    } catch (error) {
      primaryError = error
      if (prepared)
        await testInfo.attach('workflow-replay-failure-state.json', {
          body: JSON.stringify({
            replay: fixture.replayState(),
            jobs: fixture.workerProgressState(),
          }),
          contentType: 'application/json',
        })
      throw error
    } finally {
      await page.goto('about:blank')
      await approvalContext?.close()
      try {
        const cleanup = await fixture.finish(admin, reader)
        await testInfo.attach('workflow-replay-cleanup.json', {
          body: JSON.stringify(cleanup),
          contentType: 'application/json',
        })
      } catch (error) {
        if (primaryError)
          throw new AggregateError([primaryError, error], 'Workflow重放验收及清理失败')
        throw error
      } finally {
        await admin.dispose()
        await reader.dispose()
      }
    }
  })
}
