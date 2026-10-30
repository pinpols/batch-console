import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { request as requestFactory } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { requiredEnvironment } from './fixtures/closure-recovery/fixture'
import { BatchDayGovernanceFixture } from './fixtures/runtime-progress/fixture'

const enabled = process.env.E2E_ATOMIC_RUNTIME_REAL === '1'
const mode = process.env.E2E_ATOMIC_RUNTIME_MODE
if (
  enabled &&
  (process.env.E2E_SKIP_GLOBAL_SETUP !== '1' || !['available', 'unavailable'].includes(mode ?? ''))
)
  throw new Error(
    'Set E2E_SKIP_GLOBAL_SETUP=1 and explicit E2E_ATOMIC_RUNTIME_MODE=available|unavailable',
  )
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(150_000)
test.skip(
  !enabled,
  'Requires real atomic runtime, enforced console authentication and exclusive acceptance slot',
)

test('Atomic实际配置的真实反向查询、降级状态和读取权限', async ({ page }, testInfo) => {
  const fixture = new BatchDayGovernanceFixture()
  const evidenceDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(
    new Date(),
  )
  const evidence = resolve('docs/reports/assets', `atomic-runtime-${evidenceDate}`)
  mkdirSync(evidence, { recursive: true })
  const missingExecutorWarnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' && /atomicRuntime\.executors\.undefined/.test(message.text()))
      missingExecutorWarnings.push(message.text())
  })
  const reader = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  const endpoint = '/api/console/ops/atomic-runtime-status'
  let primaryError: unknown
  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
    fixture.prepare()
    // 复用已验证的四角色身份夹具；两份批次日前置状态不在本例执行治理动作。
    fixture.prepareDays()
    await fixture.login(page.request)
    const response = await page.request.get(endpoint)
    expect(response.status()).toBe(200)
    const status = (await response.json()).data
    expect(status.available).toBe(mode === 'available')
    if (mode === 'available') {
      const worker = await requestFactory.newContext({
        baseURL: requiredEnvironment('E2E_ATOMIC_WORKER_URL'),
      })
      try {
        const actual = await worker.get('/actuator/atomicruntime')
        expect(actual.status()).toBe(200)
        const body = await actual.json()
        for (const key of ['workerCode', 'workerType', 'shell', 'sql', 'http', 'storedProc'])
          expect(status[key]).toEqual(body[key])
      } finally {
        await worker.dispose()
      }
      expect(JSON.stringify(status)).not.toMatch(/password|secret|token|jdbc:/i)
    } else expect(status.unavailableReason).toBe('batch.console.atomic-worker.enabled=false')
    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/system/atomic-task-types')
    const panel = page.getByTestId('atomic-runtime-panel')
    await expect(panel).toBeVisible()
    if (mode === 'available') {
      await expect(panel.getByText(status.workerCode, { exact: false })).toBeVisible()
      await expect(panel.getByRole('row')).toHaveCount(5)
      for (const executor of ['shell', 'sql', 'http', 'storedProc'])
        await expect(
          panel.getByText(e2eText(`atomicRuntime.executors.${executor}`), { exact: true }),
        ).toBeVisible()
    } else {
      await expect(
        panel.getByText(e2eText('atomicRuntime.unavailable.disabled'), { exact: true }),
      ).toBeVisible()
      await expect(panel.getByRole('table')).toHaveCount(0)
    }
    await expect(panel.getByRole('switch')).toHaveCount(0)
    await page.screenshot({ path: resolve(evidence, `runtime-${mode}.png`), fullPage: true })
    expect(missingExecutorWarnings).toEqual([])
    await fixture.login(reader, true)
    expect((await reader.get(endpoint)).status()).toBe(200)
    const permissions: Record<string, number> = { admin: response.status(), tenantAdmin: 200 }
    await fixture.mutate(reader, '/api/console/auth/logout', {})
    for (const [role, username] of [
      ['auditor', fixture.auditorName],
      ['tenantUser', fixture.userName],
    ]) {
      const login = await reader.post('/api/console/auth/login', {
        headers: { 'X-Tenant-Id': fixture.tenantId },
        data: { username, password: fixture.password },
      })
      expect(login.status()).toBe(200)
      expect((await reader.get('/api/console/auth/check')).status()).toBe(204)
      const denied = await reader.get(endpoint)
      expect(denied.status()).toBe(403)
      permissions[role!] = denied.status()
      await fixture.mutate(reader, '/api/console/auth/logout', {})
    }
    writeFileSync(
      resolve(evidence, `verified-${mode}.json`),
      JSON.stringify({ status, permissions }, null, 2),
    )
  } catch (error) {
    primaryError = error
  } finally {
    try {
      const cleanup = await fixture.finish(page.request)
      writeFileSync(resolve(evidence, `cleanup-${mode}.json`), JSON.stringify(cleanup, null, 2))
    } catch (cleanupError) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, cleanupError],
          'Runtime status scenario and cleanup failed',
        )
      throw cleanupError
    } finally {
      await reader.dispose()
    }
  }
  if (primaryError) throw primaryError
})
