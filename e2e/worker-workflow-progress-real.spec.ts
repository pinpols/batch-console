import { request as requestFactory } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { WorkerExecutionProgressFixture } from './fixtures/runtime-progress/fixture'

type PushedProgress = {
  kind: 'workflow' | 'job' | 'daily'
  data: Record<string, unknown>
}

const enabled = process.env.E2E_WORKER_PROGRESS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication, Worker and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(240_000)
test.skip(
  !enabled,
  'Requires a real Atomic Worker, integrated WDI services and exclusive acceptance slot',
)

test('真实 Atomic Worker 的作业进度推送到 DAG、作业详情和租户日统计', async ({
  page,
}, testInfo) => {
  const fixture = new WorkerExecutionProgressFixture()
  const reader = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  const pushed: PushedProgress[] = []
  let primaryError: unknown
  try {
    const anonymousAuthStatus = (await page.request.get('/api/console/auth/me')).status()
    expect(anonymousAuthStatus).toBe(401)
    await page.setViewportSize({ width: 1440, height: 1100 })
    fixture.prepare()
    await fixture.login(page.request)
    await fixture.login(reader, true)
    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.exposeFunction(
      'recordProgressSnapshot',
      (kind: PushedProgress['kind'], data: unknown) => {
        if (data && typeof data === 'object')
          pushed.push({ kind, data: data as Record<string, unknown> })
      },
    )
    await page.addInitScript(() => {
      const NativeEventSource = window.EventSource
      type Recorder = { recordProgressSnapshot: (kind: string, data: unknown) => Promise<void> }
      const capture = (kind: string, event: Event) => {
        try {
          const parsed: unknown = JSON.parse((event as MessageEvent).data)
          const data =
            parsed && typeof parsed === 'object' && 'data' in parsed
              ? (parsed as { data: unknown }).data
              : parsed
          void (window as unknown as Recorder).recordProgressSnapshot(kind, data)
        } catch {
          // 忽略非快照通知；页面自己的订阅器会校验协议。
        }
      }
      window.EventSource = class extends NativeEventSource {
        constructor(url: string | URL, options?: EventSourceInit) {
          super(url, options)
          this.addEventListener('workflow-execution-progress', (event) =>
            capture('workflow', event),
          )
          this.addEventListener('job-execution-progress', (event) => capture('job', event))
          this.addEventListener('daily-progress', (event) => capture('daily', event))
        }
      }
    })

    await fixture.startWorker()
    const jobResponse = await fixture.mutate(page.request, '/api/console/job-definitions', {
      tenantId: fixture.tenantId,
      jobCode: fixture.jobCode,
      jobName: 'Atomic Worker progress acceptance',
      jobType: 'ATOMIC',
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      workerGroup: 'ATOMIC',
      timeoutSeconds: 90,
      calendarCode: fixture.calendarCode,
      paramSchema: JSON.stringify({ type: 'object', additionalProperties: true }),
      defaultParams: JSON.stringify({ taskType: 'sql', sql: 'SELECT pg_sleep(24), 1' }),
      enabled: true,
    })
    const jobBody = (await jobResponse.json()) as { data?: { id?: number }; id?: number }
    fixture.rememberJobDefinition(Number(jobBody.data?.id ?? jobBody.id))
    expect(jobResponse.status(), JSON.stringify(jobBody)).toBe(200)

    const createWorkflow = await fixture.mutate(page.request, '/api/console/workflow-definitions', {
      tenantId: fixture.tenantId,
      workflowCode: fixture.workflowCode,
      workflowName: 'Atomic Worker progress acceptance',
      workflowType: 'DAG',
      enabled: true,
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      calendarCode: fixture.calendarCode,
      nodes: [
        { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
        {
          nodeCode: 'ATOMIC_JOB',
          nodeName: 'Atomic SQL job',
          nodeType: 'JOB',
          relatedJobCode: fixture.jobCode,
          nodeOrder: 1,
          enabled: true,
        },
        { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 2, enabled: true },
      ],
      edges: [
        { fromNodeCode: 'START', toNodeCode: 'ATOMIC_JOB', edgeType: 'SUCCESS', enabled: true },
        { fromNodeCode: 'ATOMIC_JOB', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true },
      ],
    })
    const workflowBody = (await createWorkflow.json()) as { data?: { id?: number }; id?: number }
    expect(createWorkflow.status(), JSON.stringify(workflowBody)).toBe(200)
    const workflowDefinitionId = Number(workflowBody.data?.id ?? workflowBody.id)
    expect(Number.isSafeInteger(workflowDefinitionId)).toBe(true)

    const trigger = await fixture.mutate(
      page.request,
      `/api/console/workflow-definitions/${workflowDefinitionId}/trigger`,
      { tenantId: fixture.tenantId, bizDate: fixture.bizDate, triggerType: 'MANUAL' },
    )
    expect(trigger.status(), await trigger.text()).toBe(200)

    await expect
      .poll(
        () => {
          const state = fixture.workerProgressState()
          return state.tasks.find((task) => task.status === 'RUNNING')?.status ?? ''
        },
        { timeout: 75_000, intervals: [1000, 2000, 3000] },
      )
      .toBe('RUNNING')
    const running = fixture.workerProgressState()
    const runId = running.runs[0]?.id
    const instanceId = running.instances[0]?.id
    expect(runId).toBeGreaterThan(0)
    expect(instanceId).toBeGreaterThan(0)
    expect(running.worker).toEqual({ status: 'ONLINE', workerGroup: 'ATOMIC' })
    expect(running.tasks).toEqual([
      expect.objectContaining({ status: 'RUNNING', workerCode: fixture.workerCode }),
    ])
    expect(running.partitions).toEqual([
      expect.objectContaining({ status: 'RUNNING', workerCode: fixture.workerCode }),
    ])

    const claimedTasksPath = `/api/console/workers/${encodeURIComponent(fixture.workerCode)}/claimed-tasks`
    const adminClaimsResponse = await page.request.get(claimedTasksPath, {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    expect(adminClaimsResponse.status(), await adminClaimsResponse.text()).toBe(200)
    const adminClaims = (await adminClaimsResponse.json()) as {
      data?: Array<Record<string, unknown>>
    }
    expect(adminClaims.data).toEqual([
      expect.objectContaining({
        id: running.tasks[0]?.id,
        jobInstanceId: instanceId,
        taskStatus: 'RUNNING',
        assignedWorkerCode: fixture.workerCode,
      }),
    ])
    const forbiddenClaimFields = [
      'tenantId',
      'taskPayload',
      'effectiveParameters',
      'heartbeatDetails',
      'resultSummary',
      'errorMessage',
    ]
    for (const key of forbiddenClaimFields) {
      expect(adminClaims.data?.[0]).not.toHaveProperty(key)
    }

    const tenantAdminClaimsResponse = await reader.get(claimedTasksPath, {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    expect(tenantAdminClaimsResponse.status(), await tenantAdminClaimsResponse.text()).toBe(200)
    const tenantAdminClaims = (await tenantAdminClaimsResponse.json()) as {
      data?: Array<Record<string, unknown>>
    }
    expect(tenantAdminClaims.data).toEqual(adminClaims.data)

    const crossTenantId = `${fixture.tenantId}-other`
    const crossTenantClaims = await reader.get(claimedTasksPath, {
      params: { tenantId: crossTenantId },
      headers: { 'X-Tenant-Id': crossTenantId },
    })
    expect(crossTenantClaims.status(), await crossTenantClaims.text()).toBe(403)
    const tenantAdminDiagnostic = await reader.get(
      '/api/console/ops/cluster-diagnostic/terminal-children',
      { params: { tenantId: fixture.tenantId }, headers: { 'X-Tenant-Id': fixture.tenantId } },
    )
    expect(tenantAdminDiagnostic.status(), await tenantAdminDiagnostic.text()).toBe(403)
    const adminDiagnostic = await page.request.get(
      '/api/console/ops/cluster-diagnostic/terminal-children',
      { params: { tenantId: fixture.tenantId }, headers: { 'X-Tenant-Id': fixture.tenantId } },
    )
    expect(adminDiagnostic.status(), await adminDiagnostic.text()).toBe(200)
    expect(await adminDiagnostic.json()).toMatchObject({
      data: {
        terminalInstancesWithActiveChildren: expect.any(Number),
        healthy: expect.any(Boolean),
      },
    })

    await page.goto('/workers/management')
    const workerCard = page.locator('.wk-card').filter({ hasText: fixture.workerCode })
    await expect(workerCard).toBeVisible()
    await workerCard
      .getByRole('button', { name: e2eText('workerManagement.actionClaimedTasks') })
      .click()
    const claimedTasksDrawer = page.locator('.el-drawer').filter({ hasText: fixture.workerCode })
    await expect(claimedTasksDrawer).toBeVisible()
    await expect(claimedTasksDrawer.locator('.el-table__row')).toHaveCount(1)
    await expect(claimedTasksDrawer).toContainText(String(running.tasks[0]?.id))

    await testInfo.attach('worker-claimed-task-access.json', {
      body: JSON.stringify(
        {
          anonymousAuthStatus,
          adminClaimStatus: adminClaimsResponse.status(),
          tenantAdminOwnTenantStatus: tenantAdminClaimsResponse.status(),
          tenantAdminCrossTenantStatus: crossTenantClaims.status(),
          terminalChildrenDiagnostic: {
            adminStatus: adminDiagnostic.status(),
            tenantAdminStatus: tenantAdminDiagnostic.status(),
          },
          safeSummary: {
            rowCount: adminClaims.data?.length ?? 0,
            taskStatus: adminClaims.data?.[0]?.taskStatus ?? null,
            responseFields: Object.keys(adminClaims.data?.[0] ?? {}).sort(),
            omittedSensitiveFields: forbiddenClaimFields,
          },
          workerManagementDrawerRows: await claimedTasksDrawer.locator('.el-table__row').count(),
        },
        null,
        2,
      ),
      contentType: 'application/json',
    })

    const deniedPause = await fixture.mutate(reader, `/api/console/instances/${instanceId}/pause`)
    expect(deniedPause.status(), await deniedPause.text()).toBe(403)
    expect(fixture.workerProgressState().instances[0]?.status).toBe('RUNNING')

    await page.goto(`/monitor/job-instances/${instanceId}`)
    const lifecycleButton = (action: 'pause' | 'resume') =>
      page.getByRole('button', { name: e2eText(`runControl.${action}`), exact: true })
    await expect(lifecycleButton('pause')).toBeVisible()
    await lifecycleButton('pause').click()
    await page.getByRole('button', { name: e2eText('dangerConfirm.confirm'), exact: true }).click()
    await expect(lifecycleButton('resume')).toBeVisible()
    await expect
      .poll(() => fixture.workerProgressState().instances[0]?.status ?? '', { timeout: 10_000 })
      .toBe('PAUSED')
    await expect
      .poll(() =>
        pushed.some((snapshot) => {
          const data = snapshot.data as { jobInstanceId?: number; instanceStatus?: string }
          return (
            snapshot.kind === 'job' &&
            data.jobInstanceId === instanceId &&
            data.instanceStatus === 'PAUSED'
          )
        }),
      )
      .toBe(true)

    await lifecycleButton('resume').click()
    await page.getByRole('button', { name: e2eText('dangerConfirm.confirm'), exact: true }).click()
    await expect(lifecycleButton('pause')).toBeVisible()
    await expect
      .poll(() => fixture.workerProgressState().instances[0]?.status ?? '', { timeout: 10_000 })
      .toBe('RUNNING')
    await expect
      .poll(() =>
        pushed.some((snapshot) => {
          const data = snapshot.data as { jobInstanceId?: number; instanceStatus?: string }
          return (
            snapshot.kind === 'job' &&
            data.jobInstanceId === instanceId &&
            data.instanceStatus === 'RUNNING'
          )
        }),
      )
      .toBe(true)

    await page.goto(`/monitor/workflow-runs/${runId}`)
    const workflowPanel = page
      .locator('.section-card')
      .filter({ hasText: e2eText('workflowProgress.title') })
    await expect(workflowPanel.locator('.mini-dag__graph .node')).toHaveCount(3, {
      timeout: 30_000,
    })
    await expect(workflowPanel.locator('.live-status-badge--live')).toBeVisible()
    const workflowSnapshotMatches = () =>
      pushed.some((snapshot) => {
        const data = snapshot.data as {
          workflowRunId?: number
          runStatus?: string
          nodes?: Array<{
            nodeCode: string
            nodeStatus: string
            jobInstanceId?: number
            jobInstanceStatus?: string | null
          }>
        }
        return (
          snapshot.kind === 'workflow' &&
          data.workflowRunId === runId &&
          data.runStatus === 'RUNNING' &&
          data.nodes?.some(
            (node) =>
              node.nodeCode === 'ATOMIC_JOB' &&
              node.nodeStatus === 'READY' &&
              node.jobInstanceStatus === 'RUNNING' &&
              node.jobInstanceId === instanceId,
          ) === true
        )
      })
    try {
      await expect.poll(workflowSnapshotMatches, { timeout: 20_000 }).toBe(true)
      await expect(workflowPanel.locator('.mini-dag__graph .node.running')).toHaveCount(1)
    } catch (error) {
      await testInfo.attach('workflow-progress-push-debug.json', {
        body: JSON.stringify(
          pushed
            .filter((snapshot) => snapshot.kind === 'workflow')
            .map(({ data }) => {
              const value = data as {
                workflowRunId?: number
                runStatus?: string
                nodes?: Array<{
                  nodeCode: string
                  nodeStatus: string
                  jobInstanceId?: number
                  jobInstanceStatus?: string | null
                }>
              }
              return {
                workflowRunId: value.workflowRunId,
                runStatus: value.runStatus,
                nodes: value.nodes?.map((node) => ({
                  nodeCode: node.nodeCode,
                  nodeStatus: node.nodeStatus,
                  jobInstanceId: node.jobInstanceId,
                  jobInstanceStatus: node.jobInstanceStatus,
                })),
              }
            }),
        ),
        contentType: 'application/json',
      })
      throw error
    }
    await page.screenshot({
      path: testInfo.outputPath('atomic-worker-workflow-dag.png'),
      fullPage: true,
    })

    const executionGets: string[] = []
    page.on('request', (request) => {
      if (request.method() !== 'GET') return
      const path = new URL(request.url()).pathname
      if (path === `/api/console/job-instances/${instanceId}/execution-progress`) {
        executionGets.push('job')
      }
    })
    await page.goto(`/monitor/job-instances/${instanceId}`)
    const jobPanel = page.locator('.section-card').filter({ hasText: e2eText('jobProgress.title') })
    await expect(jobPanel.locator('.live-status-badge--live')).toBeVisible({ timeout: 30_000 })
    await expect(jobPanel.getByRole('progressbar')).toHaveCount(2)
    await expect(
      jobPanel.getByRole('progressbar', { name: e2eText('jobProgress.PARTITION') }),
    ).toBeVisible()
    await expect(
      jobPanel.getByRole('progressbar', { name: e2eText('jobProgress.TASK') }),
    ).toBeVisible()
    await expect
      .poll(() =>
        pushed.some((snapshot) => {
          const data = snapshot.data as {
            jobInstanceId?: number
            instanceStatus?: string
            counts?: Array<{ scope: string; status: string; count: number }>
          }
          return (
            snapshot.kind === 'job' &&
            data.jobInstanceId === instanceId &&
            data.instanceStatus === 'RUNNING' &&
            data.counts?.some(
              (item) => item.scope === 'TASK' && item.status === 'RUNNING' && item.count > 0,
            ) === true
          )
        }),
      )
      .toBe(true)
    const initialExecutionGets = executionGets.length
    await page.waitForTimeout(4500)
    expect(executionGets.length).toBe(initialExecutionGets)
    await page.screenshot({
      path: testInfo.outputPath('atomic-worker-job-progress.png'),
      fullPage: true,
    })

    await expect
      .poll(() => fixture.workerProgressState().runs[0]?.status ?? '', {
        timeout: 60_000,
        intervals: [1000, 2000, 3000],
      })
      .toBe('SUCCESS')
    const terminal = fixture.workerProgressState()
    expect(terminal.instances[0]?.status).toBe('SUCCESS')
    expect(terminal.tasks[0]?.status).toBe('SUCCESS')
    expect(terminal.tasks[0]?.workerCode).toBe(fixture.workerCode)

    const dailyGets: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname === '/api/console/dashboard/daily-progress'
      )
        dailyGets.push('daily')
    })
    await page.goto('/ops/summary')
    const tourClose = page.locator('.driver-popover-close-btn')
    await expect(tourClose).toBeVisible({ timeout: 5_000 })
    await tourClose.click()
    const dailyPanel = page
      .locator('.section-card')
      .filter({ hasText: e2eText('dailyProgress.title') })
    await expect(dailyPanel.locator('#daily-progress-date')).toBeVisible()
    const date = dailyPanel.locator('#daily-progress-date')
    await date.fill(fixture.bizDate)
    await date.press('Enter')
    await date.blur()
    const jobCountRow = dailyPanel
      .locator('.el-table__row')
      .filter({ hasText: e2eText('dailyProgress.JOB_INSTANCE') })
    await expect(jobCountRow.locator('td').nth(1)).toHaveText('1')
    await expect(jobCountRow.locator('td').nth(3)).toHaveText('1')
    await expect(dailyPanel.locator('.daily-progress__chart')).toBeVisible()
    await expect(dailyPanel.locator('.live-status-badge--live')).toBeVisible()
    await expect
      .poll(() =>
        pushed.some((snapshot) => {
          const data = snapshot.data as { tenantId?: string; bizDate?: string; counts?: unknown[] }
          return (
            snapshot.kind === 'daily' &&
            data.tenantId === fixture.tenantId &&
            data.bizDate === fixture.bizDate &&
            Array.isArray(data.counts)
          )
        }),
      )
      .toBe(true)
    const dailyReadsAfterSnapshot = dailyGets.length
    await page.waitForTimeout(4500)
    expect(dailyGets.length).toBe(dailyReadsAfterSnapshot)
    await page.screenshot({
      path: testInfo.outputPath('tenant-daily-progress-chart.png'),
      fullPage: true,
    })

    const persisted = fixture.workerProgressState()
    expect(persisted.nodes).toContainEqual(
      expect.objectContaining({
        nodeCode: 'ATOMIC_JOB',
        status: 'SUCCESS',
        jobInstanceId: instanceId,
      }),
    )
    await testInfo.attach('worker-progress.json', {
      body: JSON.stringify({
        tenantId: fixture.tenantId,
        workerCode: fixture.workerCode,
        jobCode: fixture.jobCode,
        workflowCode: fixture.workflowCode,
        workflowRunId: runId,
        jobInstanceId: instanceId,
        running,
        terminal: persisted,
        pushed: pushed.map(({ kind, data }) => ({ kind, data })),
        periodicExecutionGets: executionGets.length - initialExecutionGets,
        periodicDailyProgressGets: dailyGets.length - dailyReadsAfterSnapshot,
      }),
      contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    try {
      await page.goto('about:blank')
      const residue = await fixture.finish(page.request, reader)
      await testInfo.attach('worker-progress-cleanup.json', {
        body: JSON.stringify(residue),
        contentType: 'application/json',
      })
    } catch (cleanupError) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, cleanupError],
          'Worker acceptance and cleanup failed',
        )
      throw cleanupError
    } finally {
      await reader.dispose()
    }
  }
})
