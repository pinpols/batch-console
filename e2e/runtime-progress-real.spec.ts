import { request as requestFactory, type BrowserContext } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { ControlProgressFixture } from './fixtures/runtime-progress/fixture'

type Snapshot = {
  runStatus: string
  nodes: Array<{ nodeCode: string; nodeName: string; nodeStatus: string; skipReasonCode?: string }>
}
const enabled = process.env.E2E_RUNTIME_PROGRESS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and cleanup')
// 本例临时密码不得进入追踪产物；证据只保存状态快照、截图及残留计数。
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(180_000)
test.skip(
  !enabled,
  'Requires integrated runtime, enforced authentication and exclusive acceptance slot',
)

test('真实推送驱动冻结DAG和租户当日进度，终态无记录节点不伪装成功', async ({
  browser,
  page,
}, testInfo) => {
  const fixture = new ControlProgressFixture()
  const reader = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  const snapshots: Snapshot[] = []
  let readerBrowserContext: BrowserContext | undefined
  let primaryError: unknown
  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
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
    await page.exposeFunction('recordProgressSnapshot', (snapshot: Snapshot) =>
      snapshots.push(snapshot),
    )
    await page.addInitScript(() => {
      const NativeEventSource = window.EventSource
      window.EventSource = class extends NativeEventSource {
        constructor(url: string | URL, options?: EventSourceInit) {
          super(url, options)
          this.addEventListener('workflow-execution-progress', (event) => {
            const snapshot = JSON.parse((event as MessageEvent).data).data
            // 只采集公开DTO；不记录连接URL、票据或Cookie。
            void (
              window as unknown as { recordProgressSnapshot: (value: unknown) => Promise<void> }
            ).recordProgressSnapshot(snapshot)
          })
        }
      }
    })
    const definition = {
      tenantId: fixture.tenantId,
      workflowCode: fixture.codes[0],
      workflowName: 'Live progress',
      workflowType: 'DAG',
      enabled: true,
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      calendarCode: fixture.calendarCode,
      nodes: [
        {
          nodeCode: 'START',
          nodeName: 'Frozen start',
          nodeType: 'START',
          nodeOrder: 0,
          enabled: true,
        },
        {
          nodeCode: 'WAIT',
          nodeName: 'Frozen wait',
          nodeType: 'WAIT',
          nodeOrder: 1,
          enabled: true,
          nodeParams: JSON.stringify({
            sensor_type: 'FILE_ARRIVAL',
            sensor_spec: {
              pattern: `${fixture.tenantId}-never.csv`,
              maxAgeSeconds: 3600,
            },
            timeout_seconds: 40,
            poll_interval_seconds: 2,
            on_timeout: 'SKIP_DOWNSTREAM',
          }),
        },
        { nodeCode: 'END', nodeName: 'Frozen end', nodeType: 'END', nodeOrder: 2, enabled: true },
      ],
      edges: [
        { fromNodeCode: 'START', toNodeCode: 'WAIT', edgeType: 'SUCCESS', enabled: true },
        { fromNodeCode: 'WAIT', toNodeCode: 'END', edgeType: 'SUCCESS', enabled: true },
      ],
    }
    expect(
      (
        await fixture.mutate(page.request, '/api/console/workflow-definitions', definition)
      ).status(),
    ).toBe(200)
    const workflowId = fixture.state().definitions[0].id
    expect(
      (
        await fixture.mutate(
          page.request,
          `/api/console/workflow-definitions/${workflowId}/trigger`,
          {
            tenantId: fixture.tenantId,
            bizDate: fixture.bizDate,
            triggerType: 'MANUAL',
          },
        )
      ).status(),
    ).toBe(200)
    await expect.poll(() => fixture.state().runs[0]?.status, { timeout: 45_000 }).toBe('RUNNING')
    const runId = fixture.state().runs[0].id
    const path = `/api/console/workflow-runs/${runId}`
    await page.goto(`/monitor/workflow-runs/${runId}`)
    const graph = page
      .locator('.section-card')
      .filter({ hasText: e2eText('workflowProgress.title') })
    await expect(graph.locator('.mini-dag__graph .node')).toHaveCount(3, { timeout: 30_000 })
    await expect(graph.locator('.live-status-badge--live')).toBeVisible()
    await expect.poll(() => snapshots.some((s) => s.runStatus === 'RUNNING')).toBe(true)

    readerBrowserContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    await fixture.login(readerBrowserContext.request, true)
    const readerPage = await readerBrowserContext.newPage()
    await installE2eLocale(readerPage)
    await seedBrowserStorage(readerPage, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await readerPage.goto(`/monitor/workflow-runs/${runId}`)
    await expect(readerPage.getByText(String(runId), { exact: true })).toBeVisible()
    for (const actionKey of [
      'runControl.pause',
      'runControl.resume',
      'monitor.runDetailCancel',
      'monitor.runDetailTerminate',
    ]) {
      await expect(
        readerPage.getByRole('button', { name: e2eText(actionKey), exact: true }),
      ).toHaveCount(0)
    }
    await testInfo.attach('workflow-admin-actions-tenant-admin.json', {
      body: JSON.stringify(
        {
          tenantAdminCanReadRun: true,
          tenantAdminAdminOnlyActionsVisible: false,
          runStatus: 'RUNNING',
        },
        null,
        2,
      ),
      contentType: 'application/json',
    })

    await page.getByRole('button', { name: e2eText('runControl.pause') }).click()
    const confirmAction = page.getByRole('button', { name: e2eText('dangerConfirm.confirm') })
    await expect(confirmAction).toBeVisible()
    await confirmAction.click()
    await expect.poll(() => snapshots.at(-1)?.runStatus).toBe('PAUSED')
    expect((await fixture.mutate(reader, `${path}/pause`, {})).status()).toBe(403)
    expect(
      (
        await reader.get(`${path}/execution-progress`, {
          params: { tenantId: 'system' },
          headers: { 'X-Tenant-Id': fixture.tenantId },
        })
      ).status(),
    ).toBe(403)
    expect(
      (
        await reader.get('/api/console/dashboard/daily-progress', {
          params: { tenantId: 'system', bizDate: fixture.bizDate },
          headers: { 'X-Tenant-Id': fixture.tenantId },
        })
      ).status(),
    ).toBe(403)
    await page.getByRole('button', { name: e2eText('runControl.resume') }).click()
    await expect(confirmAction).toBeVisible()
    await confirmAction.click()
    await expect.poll(() => snapshots.at(-1)?.runStatus).toBe('RUNNING')
    await expect.poll(() => snapshots.at(-1)?.runStatus, { timeout: 60_000 }).toBe('SUCCESS')
    expect(snapshots.at(-1)?.nodes.find((n) => n.nodeCode === 'END')?.nodeStatus).toBe(
      'NOT_EXECUTED',
    )
    const skippedWait = snapshots.at(-1)?.nodes.find((n) => n.nodeCode === 'WAIT')
    expect(skippedWait?.nodeStatus).toBe('SKIPPED')
    expect(skippedWait?.skipReasonCode).toBe('SENSOR_TIMEOUT_SKIP_DOWNSTREAM')
    await expect(graph).toContainText(e2eText('workflowProgress.states.NOT_EXECUTED'))
    const query = {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    }
    expect(
      (
        await fixture.mutate(
          page.request,
          `/api/console/workflow-definitions/${workflowId}/lock`,
          {},
          'PUT',
        )
      ).status(),
    ).toBe(200)
    try {
      const current = await (
        await page.request.get(`/api/console/workflow-definitions/${workflowId}`, query)
      ).json()
      definition.nodes[1].nodeName = 'Changed current definition'
      expect(
        (
          await fixture.mutate(
            page.request,
            `/api/console/workflow-definitions/${workflowId}/full`,
            {
              definition,
              expectedVersion: current.data.version,
            },
            'PUT',
          )
        ).status(),
      ).toBe(200)
    } finally {
      expect(
        (
          await fixture.mutate(
            page.request,
            `/api/console/workflow-definitions/${workflowId}/lock`,
            undefined,
            'DELETE',
          )
        ).status(),
      ).toBe(204)
    }
    await page.reload()
    await expect(graph).toContainText('Frozen wait')
    await expect(graph).not.toContainText('Changed current definition')
    await page.screenshot({ path: testInfo.outputPath('workflow-progress.png'), fullPage: true })
    await page.goto('/ops/summary')
    const panel = page.locator('.section-card').filter({ hasText: e2eText('dailyProgress.title') })
    const tourClose = page.locator('.driver-popover-close-btn')
    await expect(tourClose).toBeVisible()
    await tourClose.click()
    await expect(page.locator('.driver-popover')).toHaveCount(0)
    const date = panel.locator('#daily-progress-date')
    await date.fill(fixture.bizDate)
    await date.press('Enter')
    await date.blur()
    const workflow = panel
      .locator('.el-table__row')
      .filter({ hasText: e2eText('dailyProgress.WORKFLOW_RUN') })
    await expect(workflow.locator('td').nth(1)).toHaveText('1')
    await expect(workflow.locator('td').nth(3)).toHaveText('1')
    await expect(panel.locator('.live-status-badge--live')).toBeVisible()
    const reads: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname === '/api/console/dashboard/daily-progress'
      )
        reads.push('daily-progress')
    })
    // 负观察窗口覆盖两个推送采样周期，验证在线期间没有周期GET。
    await page.waitForTimeout(4500)
    expect(reads).toHaveLength(0)
    await page.screenshot({ path: testInfo.outputPath('daily-progress.png'), fullPage: true })
    await expect
      .poll(() => fixture.state().terminalEvents.map((e) => e.status))
      .toEqual(['PUBLISHED'])
    const persisted = fixture.state()
    expect(persisted.runs).toHaveLength(1)
    expect(persisted.jobInstances).toBe(0)
    await testInfo.attach('runtime-progress.json', {
      body: JSON.stringify({
        tenantId: fixture.tenantId,
        bizDate: fixture.bizDate,
        snapshots,
        persisted,
        livePeriodicReads: reads.length,
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
      await testInfo.attach('runtime-progress-cleanup.json', {
        body: JSON.stringify(residue),
        contentType: 'application/json',
      })
    } catch (cleanupError) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, cleanupError],
          'Acceptance and owned cleanup failed',
        )
      throw cleanupError
    } finally {
      await readerBrowserContext?.close()
      await reader.dispose()
    }
  }
})
