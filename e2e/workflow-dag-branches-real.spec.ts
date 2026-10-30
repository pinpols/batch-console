import { request as requestFactory } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { WorkflowDagFixture } from './fixtures/runtime-progress/workflowDagFixture'
import type { WorkflowExecutionProgress } from '@/api/workflowRuns'

const enabled = process.env.E2E_WORKFLOW_DAG_BRANCHES_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns identities, Worker and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(360_000)
test.skip(!enabled, 'Requires isolated WDI services, PostgreSQL and real Atomic Worker')

for (const mode of ['parallel-all', 'condition-failure'] as const) {
  test(`真实业务DAG节点及依赖：${mode}`, async ({ page }, testInfo) => {
    const fixture = new WorkflowDagFixture()
    const admin = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
    const snapshots: WorkflowExecutionProgress[] = []
    const periodicGets: string[] = []
    let prepared = false
    let primaryError: unknown
    try {
      fixture.prepare()
      prepared = true
      fixture.prepareReplayInput()
      await fixture.login(admin)
      await fixture.login(page.request)
      await installE2eLocale(page)
      await seedBrowserStorage(page, {
        session: '1',
        tenantId: fixture.tenantId,
        onboardingDone: '1',
      })
      await page.setViewportSize({ width: 1440, height: 1100 })
      await page.exposeFunction('captureDagProgress', (data: WorkflowExecutionProgress) => {
        snapshots.push(data)
      })
      await page.addInitScript(() => {
        const Native = window.EventSource
        window.EventSource = class extends Native {
          constructor(url: string | URL, options?: EventSourceInit) {
            super(url, options)
            this.addEventListener('workflow-execution-progress', (event) => {
              void (
                window as unknown as { captureDagProgress: (data: unknown) => Promise<void> }
              ).captureDagProgress(JSON.parse((event as MessageEvent).data).data)
            })
          }
        }
      })
      const routes =
        mode === 'parallel-all'
          ? { left: { status: 200, held: true }, right: { status: 200, held: true } }
          : { failed: { status: 503 }, handler: { status: 200, held: true } }
      const urls = await fixture.startDagServer(routes)
      const jobCodes: Record<string, string> = {}
      for (const [key, url] of Object.entries(urls)) {
        const jobCode = `${fixture.jobCode}-${key}`
        const response = await fixture.mutate(admin, '/api/console/job-definitions', {
          tenantId: fixture.tenantId,
          jobCode,
          jobName: key,
          jobType: 'ATOMIC',
          scheduleType: 'MANUAL',
          triggerMode: 'MIXED',
          workerGroup: 'ATOMIC',
          timeoutSeconds: 90,
          retryMaxCount: 0,
          calendarCode: fixture.calendarCode,
          paramSchema: JSON.stringify({ type: 'object', additionalProperties: true }),
          defaultParams: JSON.stringify({
            taskType: 'http',
            method: 'GET',
            url,
            expectStatus: [200],
          }),
          enabled: true,
        })
        expect(response.status(), await response.text()).toBe(200)
        fixture.rememberJobDefinition(Number((await response.json()).data.id), jobCode)
        jobCodes[key] = jobCode
      }
      const control = (nodeCode: string, nodeType = 'GATEWAY', nodeParams?: object) => ({
        nodeCode,
        nodeName: nodeCode,
        nodeType,
        ...(nodeParams ? { nodeParams: JSON.stringify(nodeParams) } : {}),
        enabled: true,
      })
      const job = (nodeCode: string, key: string) => ({
        ...control(nodeCode, 'JOB'),
        relatedJobCode: jobCodes[key],
      })
      const edge = (from: string, to: string, type: string, conditionExpr?: string) => ({
        fromNodeCode: from,
        toNodeCode: to,
        edgeType: type,
        ...(conditionExpr ? { conditionExpr } : {}),
        enabled: true,
      })
      const nodes =
        mode === 'parallel-all'
          ? [
              control('START', 'START'),
              control('FORK'),
              job('LEFT_JOB', 'left'),
              job('RIGHT_JOB', 'right'),
              control('JOIN', 'GATEWAY', { joinMode: 'ALL' }),
              control('END', 'END'),
            ]
          : [
              control('START', 'START'),
              control('CHOICE'),
              job('FAIL_JOB', 'failed'),
              control('NOT_SELECTED'),
              job('HANDLER', 'handler'),
              control('SUCCESS_ONLY'),
              control('END', 'END', { joinMode: 'ANY' }),
            ]
      const edges =
        mode === 'parallel-all'
          ? [
              edge('START', 'FORK', 'ALWAYS'),
              edge('FORK', 'LEFT_JOB', 'ALWAYS'),
              edge('FORK', 'RIGHT_JOB', 'ALWAYS'),
              edge('LEFT_JOB', 'JOIN', 'SUCCESS'),
              edge('RIGHT_JOB', 'JOIN', 'SUCCESS'),
              edge('JOIN', 'END', 'SUCCESS'),
            ]
          : [
              edge('START', 'CHOICE', 'ALWAYS'),
              edge('CHOICE', 'FAIL_JOB', 'CONDITION', "route = 'process'"),
              edge('CHOICE', 'NOT_SELECTED', 'CONDITION', "route = 'other'"),
              edge('FAIL_JOB', 'HANDLER', 'FAILURE'),
              edge('FAIL_JOB', 'SUCCESS_ONLY', 'SUCCESS'),
              edge('NOT_SELECTED', 'END', 'ALWAYS'),
              edge('HANDLER', 'END', 'SUCCESS'),
              edge('SUCCESS_ONLY', 'END', 'ALWAYS'),
            ]
      const saved = await fixture.mutate(admin, '/api/console/workflow-definitions', {
        tenantId: fixture.tenantId,
        workflowCode: fixture.workflowCode,
        workflowName: `Real DAG ${mode}`,
        workflowType: 'DAG',
        enabled: true,
        scheduleType: 'MANUAL',
        triggerMode: 'MIXED',
        calendarCode: fixture.calendarCode,
        nodes: nodes.map((node, nodeOrder) => ({ ...node, nodeOrder })),
        edges,
      })
      expect(saved.status(), await saved.text()).toBe(200)
      const definitionId = Number((await saved.json()).data.id)
      await fixture.startWorker()
      const triggered = await fixture.mutate(
        admin,
        `/api/console/workflow-definitions/${definitionId}/trigger`,
        {
          tenantId: fixture.tenantId,
          bizDate: fixture.bizDate,
          triggerType: 'MANUAL',
          payload: JSON.stringify({ route: 'process' }),
        },
      )
      expect(triggered.status(), await triggered.text()).toBe(200)
      await expect
        .poll(() => fixture.replayState().runs[0]?.id, { timeout: 45_000 })
        .toBeGreaterThan(0)
      const runId = fixture.replayState().runs[0].id
      await page.goto(`/monitor/workflow-runs/${runId}`)
      const panel = page
        .locator('.section-card')
        .filter({ hasText: e2eText('workflowProgress.title') })
      await expect(panel.locator('.live-status-badge--live')).toBeVisible()
      const latest = () => snapshots.filter((snapshot) => snapshot.workflowRunId === runId).at(-1)
      const jobState = (code: string) =>
        latest()?.nodes.find((node) => node.nodeCode === code)?.jobInstanceStatus
      if (mode === 'parallel-all') {
        await expect
          .poll(() => fixture.pendingKeys, { timeout: 60_000, intervals: [500] })
          .toEqual(['left', 'right'])
        await expect
          .poll(() => [jobState('LEFT_JOB'), jobState('RIGHT_JOB')])
          .toEqual(['RUNNING', 'RUNNING'])
        await expect(page.getByTestId('workflow-progress-focus')).toContainText('LEFT_JOB')
        await expect(page.getByTestId('workflow-progress-focus')).toContainText('RIGHT_JOB')
        await expect(panel.locator('.mini-dag__graph .node.running')).toHaveCount(2)
        const inFlight = fixture.workerProgressState()
        expect(inFlight.instances).toHaveLength(2)
        expect(inFlight.instances.every((row) => row.status === 'RUNNING')).toBe(true)
        expect(inFlight.tasks).toHaveLength(2)
        expect(inFlight.tasks.every((row) => row.status === 'RUNNING')).toBe(true)
        const runningNodes = fixture.replayState().nodes
        for (const code of ['LEFT_JOB', 'RIGHT_JOB']) {
          const persistedJobId = runningNodes.find((node) => node.code === code)!.jobInstanceId
          expect(persistedJobId).toBeGreaterThan(0)
          expect(latest()!.nodes.find((node) => node.nodeCode === code)?.jobInstanceId).toBe(
            persistedJobId,
          )
        }
        expect(
          new Set(
            latest()!
              .nodes.filter((node) => ['LEFT_JOB', 'RIGHT_JOB'].includes(node.nodeCode))
              .map((node) => node.jobInstanceId),
          ).size,
        ).toBe(2)
        expect(fixture.replayState().nodes.some((node) => node.code === 'JOIN')).toBe(false)
        await testInfo.attach('parallel-running.png', {
          body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
          contentType: 'image/png',
        })
        fixture.release('left')
        await expect
          .poll(() => [jobState('LEFT_JOB'), jobState('RIGHT_JOB')])
          .toEqual(['SUCCESS', 'RUNNING'])
        expect(fixture.replayState().runs[0].status).toBe('RUNNING')
        expect(fixture.replayState().nodes.some((node) => node.code === 'JOIN')).toBe(false)
        await expect(page.getByTestId('workflow-progress-focus')).toHaveText('RIGHT_JOB')
        fixture.release('right')
      } else {
        await expect
          .poll(() => fixture.pendingKeys, { timeout: 60_000, intervals: [500] })
          .toEqual(['handler'])
        await expect
          .poll(() => [jobState('FAIL_JOB'), jobState('HANDLER')])
          .toEqual(['FAILED', 'RUNNING'])
        await expect(page.getByTestId('workflow-progress-focus')).toContainText('FAIL_JOB')
        await expect(page.getByTestId('workflow-progress-focus')).toContainText('HANDLER')
        await testInfo.attach('failure-handler-running.png', {
          body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
          contentType: 'image/png',
        })
        fixture.release('handler')
      }
      const terminalStatus = mode === 'parallel-all' ? 'SUCCESS' : 'FAILED'
      await expect.poll(() => latest()?.runStatus, { timeout: 60_000 }).toBe(terminalStatus)
      const persisted = fixture.replayState()
      expect(persisted.runs).toHaveLength(1)
      expect(persisted.runs[0].status).toBe(terminalStatus)
      expect(latest()!.nodes).toHaveLength(nodes.length)
      await expect(panel.locator('.mini-dag__graph .node')).toHaveCount(nodes.length)
      const statuses = Object.fromEntries(persisted.nodes.map((node) => [node.code, node.status]))
      if (mode === 'parallel-all') {
        expect(Object.values(statuses)).toEqual(Array(6).fill('SUCCESS'))
        expect(persisted.nodes.filter((node) => node.code === 'JOIN')).toHaveLength(1)
        expect(fixture.requests).toEqual([
          { key: 'left', status: 200 },
          { key: 'right', status: 200 },
        ])
      } else {
        expect(statuses).toEqual({
          START: 'SUCCESS',
          CHOICE: 'SUCCESS',
          FAIL_JOB: 'FAILED',
          NOT_SELECTED: 'SKIPPED',
          HANDLER: 'SUCCESS',
          SUCCESS_ONLY: 'SKIPPED',
          END: 'SUCCESS',
        })
        expect(fixture.requests).toEqual([
          { key: 'failed', status: 503 },
          { key: 'handler', status: 200 },
        ])
        expect(persisted.failedTaskCodes).toEqual(['EXECUTION_FAILED'])
        expect(
          latest()!.nodes.find((node) => node.nodeCode === 'NOT_SELECTED')?.skipReasonCode,
        ).toBe('CONDITION_NOT_MATCHED')
        expect(
          latest()!.nodes.find((node) => node.nodeCode === 'SUCCESS_ONLY')?.skipReasonCode,
        ).toBe('UPSTREAM_FAILED')
      }
      expect(fixture.workerProgressState().instances).toHaveLength(2)
      await expect(page.getByTestId('workflow-finished-at')).toHaveAttribute('datetime', /.+/)
      expect(
        Date.parse((await page.getByTestId('workflow-finished-at').getAttribute('datetime'))!),
      ).toBe(persisted.runs[0].finishedAtMs)
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
      await testInfo.attach('dag-terminal.png', {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png',
      })
      await testInfo.attach('dag-real-evidence.json', {
        body: JSON.stringify({
          mode,
          persisted,
          jobs: fixture.workerProgressState(),
          snapshots,
          httpResults: fixture.requests,
          periodicGets: periodicGets.length,
        }),
        contentType: 'application/json',
      })
    } catch (error) {
      primaryError = error
      if (prepared)
        await testInfo.attach('dag-failure-state.json', {
          body: JSON.stringify({
            state: fixture.replayState(),
            jobs: fixture.workerProgressState(),
            pendingKeys: fixture.pendingKeys,
          }),
          contentType: 'application/json',
        })
      throw error
    } finally {
      await page.goto('about:blank')
      try {
        const cleanup = await fixture.finish(admin)
        await testInfo.attach('dag-cleanup.json', {
          body: JSON.stringify(cleanup),
          contentType: 'application/json',
        })
      } catch (error) {
        if (primaryError) throw new AggregateError([primaryError, error], 'DAG验收及清理失败')
        throw error
      } finally {
        await admin.dispose()
      }
    }
  })
}
