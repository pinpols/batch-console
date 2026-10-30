import { request as requestFactory } from '@playwright/test'
import { test, expect } from './support/app'
import { seedBrowserStorage } from './support/storage'
import { installE2eLocale, e2eText } from './support/i18n'
import { PipelineProgressFixture } from './fixtures/runtime-progress/fixture'
import type { PipelineProgressSnapshot } from '@/api/pipelineProgress'
const enabled = process.env.E2E_PIPELINE_PROGRESS_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(120000)
test.skip(
  !enabled,
  'Requires exclusive WDI runtime with enforced authentication and explicit PG environment',
)
test('真实Pipeline完整快照推送与授权（SQL状态夹具，不代表Worker执行）', async ({
  page,
}, testInfo) => {
  const fixture = new PipelineProgressFixture()
  const reader = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  const snapshots: PipelineProgressSnapshot[] = []
  let primaryError: unknown
  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
    expect(
      (
        await page.request.get('/api/console/pipeline-progress', {
          params: { tenantId: 'probe', pipelineInstanceIds: '1' },
        })
      ).status(),
    ).toBe(401)
    fixture.prepare()
    const seed = fixture.preparePipeline()
    await fixture.login(page.request)
    await fixture.login(reader, true)
    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.exposeFunction('capturePipelineProgress', (data: PipelineProgressSnapshot) =>
      snapshots.push(data),
    )
    await page.addInitScript(() => {
      const Native = window.EventSource
      window.EventSource = class extends Native {
        constructor(url: string | URL, options?: EventSourceInit) {
          super(url, options)
          this.addEventListener('pipeline-progress-snapshot', (event) => {
            void (
              window as unknown as { capturePipelineProgress: (data: unknown) => Promise<void> }
            ).capturePipelineProgress(JSON.parse((event as MessageEvent).data).data)
          })
        }
      }
    })
    const query = {
      params: { tenantId: fixture.tenantId, pipelineInstanceIds: String(seed.pipelineId) },
    }
    expect((await reader.get('/api/console/pipeline-progress', query)).status()).toBe(200)
    expect(
      (
        await reader.get('/api/console/pipeline-progress', {
          params: { ...query.params, tenantId: 'system' },
        })
      ).status(),
    ).toBe(403)
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.goto('/files/pipeline-obs')
    await page
      .getByRole('tab', { name: e2eText('filePipelineObservability.tabSteps'), exact: true })
      .click()
    const row = page
      .locator('.el-tab-pane:visible .el-table__body-wrapper .el-table__row')
      .filter({ hasText: 'LOAD' })
    await expect
      .poll(() =>
        snapshots.some((s) =>
          s.pipelines.some(
            (p) =>
              p.pipelineInstanceId === seed.pipelineId &&
              p.steps.some((step) => step.rowsProcessed === 3),
          ),
        ),
      )
      .toBe(true)
    expect(fixture.advancePipeline()).toEqual({ status: 'SUCCESS', rows: 88 })
    await expect(row).toContainText('88')
    await expect
      .poll(() =>
        snapshots.some((s) =>
          s.pipelines.some(
            (p) =>
              p.pipelineInstanceId === seed.pipelineId &&
              p.runStatus === 'SUCCESS' &&
              p.steps.some((step) => step.stepStatus === 'SUCCESS' && step.rowsProcessed === 88),
          ),
        ),
      )
      .toBe(true)
    await expect(page.locator('.el-tab-pane:visible .live-status-badge--live')).toBeVisible()
    const reads: string[] = []
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname
      if (
        request.method() === 'GET' &&
        (path === '/api/console/pipeline-progress' ||
          path === '/api/console/queries/pipeline-progress')
      )
        reads.push(path)
    })
    // 覆盖两个服务端采样周期，验证在线窗口没有周期GET。
    await page.waitForTimeout(4500)
    expect(reads).toHaveLength(0)
    await page.screenshot({
      path: testInfo.outputPath('pipeline-progress-real.png'),
      fullPage: true,
    })
    await testInfo.attach('pipeline-progress-real.json', {
      body: JSON.stringify({
        scope: 'real transport and SQL projection fixture; no Worker execution',
        tenantId: fixture.tenantId,
        seed,
        snapshots,
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
      await testInfo.attach('pipeline-progress-cleanup.json', {
        body: JSON.stringify(residue),
        contentType: 'application/json',
      })
    } catch (cleanupError) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, cleanupError],
          'Pipeline transport acceptance and owned cleanup failed',
        )
      throw cleanupError
    } finally {
      await reader.dispose()
    }
  }
})
