import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { BatchDayGovernanceFixture } from './fixtures/runtime-progress/fixture'

const enabled = process.env.E2E_BATCH_DAY_GOVERNANCE_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(240_000)
test.skip(
  !enabled,
  'Requires current WDI runtime, real authentication and exclusive acceptance slot',
)

test('批次日治理真实浏览器：六种动作、补扫控制、四角色与独立审计回读', async ({
  page,
  browser,
}, testInfo) => {
  const fixture = new BatchDayGovernanceFixture()
  const contexts: BrowserContext[] = []
  const evidence = resolve('docs/reports/assets/batch-day-governance-2026-10-25')
  mkdirSync(evidence, { recursive: true })
  let primaryError: unknown
  const writes: Array<{ kind: string; body: Record<string, unknown>; key: string | undefined }> = []
  const url = `/scheduler/batch-days/${fixture.bizDate}?calendarCode=${fixture.calendarCode}`
  const windowPath = `/api/console/queries/batch-days/${fixture.bizDate}/window`
  const previewPath = '/api/console/batch-days/catch-up-preview'
  const governanceTitle = e2eText('batchDayGovernance.title')
  async function enter(target: Page) {
    await installE2eLocale(target)
    await seedBrowserStorage(target, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await target.goto(url)
    await target.getByRole('button', { name: governanceTitle, exact: true }).click()
    return target.getByRole('dialog', { name: governanceTitle, exact: true })
  }
  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
    fixture.prepare()
    fixture.prepareDays()
    await fixture.login(page.request)
    await page.setViewportSize({ width: 1440, height: 1100 })
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /\/api\/console\/batch-days\/(operate|catch-up-control)$/.test(
          new URL(request.url()).pathname,
        )
      ) {
        writes.push({
          kind: request.url().endsWith('/operate') ? 'day' : 'catchup',
          body: request.postDataJSON() as Record<string, unknown>,
          key: request.headers()['idempotency-key'],
        })
      }
    })
    let drawer = await enter(page)
    await expect(
      drawer.getByRole('button', {
        name: e2eText('batchDayGovernance.actions.FREEZE'),
        exact: true,
      }),
    ).toBeEnabled()
    await expect(
      drawer.getByRole('button', {
        name: e2eText('batchDayGovernance.actions.REOPEN'),
        exact: true,
      }),
    ).toHaveCount(0)
    async function action(label: string) {
      await drawer.getByRole('button', { name: label, exact: true }).click()
      const confirm = page.getByRole('dialog', {
        name: e2eText('batchDayGovernance.confirmTitle'),
        exact: true,
      })
      await expect(
        confirm.getByRole('button', { name: e2eText('common.confirm'), exact: true }),
      ).toBeDisabled()
      await confirm.getByRole('textbox').fill('owned governance acceptance')
      await confirm.getByRole('button', { name: e2eText('common.confirm'), exact: true }).click()
      await expect(confirm).not.toBeVisible()
      await expect(
        drawer.getByText(e2eText('batchDayGovernance.loadError'), { exact: true }),
      ).toHaveCount(0)
    }
    let dropFirstWriteResponse = true
    await page.route('**/api/console/batch-days/operate', async (route) => {
      if (dropFirstWriteResponse) {
        dropFirstWriteResponse = false
        const committed = await route.fetch()
        expect(committed.status()).toBe(200)
        await route.abort('failed')
      } else await route.continue()
    })
    const expectedTransitions = [
      ['FREEZE', 'OPEN', true],
      ['RELEASE', 'MANUAL_RELEASED', false],
      ['REOPEN', 'IN_FLIGHT', false],
      ['SKIP', 'SKIPPED', false],
      ['REOPEN', 'IN_FLIGHT', false],
      ['CLOSE', 'SETTLED', false],
    ] as const
    for (const [operation, status, frozen] of expectedTransitions) {
      await action(e2eText(`batchDayGovernance.actions.${operation}`))
      if (operation === 'FREEZE') {
        await expect(
          drawer.getByText(e2eText('batchDayGovernance.unknownOutcome'), { exact: true }),
        ).toBeVisible()
        await page.reload()
        await page.getByRole('button', { name: governanceTitle, exact: true }).click()
        drawer = page.getByRole('dialog', { name: governanceTitle, exact: true })
        await expect(
          drawer.getByText(e2eText('batchDayGovernance.unknownOutcome'), { exact: true }),
        ).toBeVisible()
        await expect(
          drawer.getByRole('button', {
            name: e2eText('batchDayGovernance.actions.RELEASE'),
            exact: true,
          }),
        ).toBeDisabled()
        await drawer
          .getByRole('button', { name: e2eText('batchDayGovernance.retryOriginal'), exact: true })
          .click()
        await expect(
          drawer.getByText(e2eText('batchDayGovernance.unknownOutcome'), { exact: true }),
        ).toHaveCount(0)
        expect(writes[1]!.key).toBe(writes[0]!.key)
        expect(writes[1]!.body).toEqual(writes[0]!.body)
      }
      await expect.poll(() => fixture.governanceState().days[0]).toMatchObject({ status, frozen })
      const actualWindow = await page.request.get(windowPath, {
        params: { tenantId: fixture.tenantId, calendarCode: fixture.calendarCode },
      })
      expect(actualWindow.status()).toBe(200)
      expect((await actualWindow.json()).data).toMatchObject({ dayStatus: status, frozen })
    }
    await action(e2eText('batchDayGovernance.pause'))
    expect(fixture.governanceState().paused).toBe(true)
    await action(e2eText('batchDayGovernance.resume'))
    expect(fixture.governanceState().paused).toBe(false)
    const currentPreview = await page.request.get(previewPath, {
      params: { tenantId: fixture.tenantId, calendarCode: fixture.calendarCode },
    })
    const currentDate = (await currentPreview.json()).data.currentBizDate as string
    const past = new Date(`${currentDate}T00:00:00Z`)
    past.setUTCDate(past.getUTCDate() - 2)
    const pastDate = past.toISOString().slice(0, 10)
    for (const index of [0, 1]) {
      const input = drawer.locator('.el-date-editor input').nth(index)
      await input.fill(pastDate)
      await input.press('Enter')
    }
    await drawer
      .getByRole('button', { name: e2eText('batchDayGovernance.inspect'), exact: true })
      .click()
    await expect(
      drawer.getByText(
        e2eText('batchDayGovernance.gapSummary')
          .replace('{inspected}', '1')
          .replace('{missing}', '1'),
        { exact: true },
      ),
    ).toBeVisible()
    await expect(
      drawer.getByRole('link', { name: e2eText('batchDayGovernance.openWindow'), exact: true }),
    ).toHaveAttribute(
      'href',
      `/scheduler/batch-days/${pastDate}?calendarCode=${fixture.calendarCode}`,
    )
    const second = fixture.governanceState().days[1]!
    const dateInput = drawer.locator('.el-date-editor input').last()
    await dateInput.fill(second.date)
    await dateInput.press('Enter')
    await expect(
      drawer.getByRole('button', {
        name: e2eText('batchDayGovernance.actions.SETTLE_EMPTY'),
        exact: true,
      }),
    ).toBeEnabled()
    await action(e2eText('batchDayGovernance.actions.SETTLE_EMPTY'))
    expect(fixture.governanceState().days[1]).toMatchObject({ status: 'SETTLED', frozen: false })
    const conflict = await fixture.mutate(page.request, '/api/console/batch-days/operate', {
      tenantId: fixture.tenantId,
      calendarCode: fixture.calendarCode,
      bizDate: fixture.bizDate,
      action: 'FREEZE',
      reason: 'terminal conflict must reject',
    })
    expect(conflict.status()).toBe(409)
    const state = fixture.governanceState()
    expect(state.audits.map((a) => a.operation)).toEqual([
      'BATCH_DAY_FREEZE',
      'BATCH_DAY_RELEASE',
      'BATCH_DAY_REOPEN',
      'BATCH_DAY_SKIP',
      'BATCH_DAY_REOPEN',
      'BATCH_DAY_CLOSE',
      'BATCH_DAY_SETTLE_EMPTY',
    ])
    expect(
      state.audits.every(
        (a) => a.reason === 'owned governance acceptance' && a.operator !== 'UNKNOWN',
      ),
    ).toBe(true)
    expect(state.catchupEvents.map((event) => event.action)).toEqual(['PAUSE', 'RESUME'])
    expect(writes).toHaveLength(10)
    expect(
      writes.every(
        (write) =>
          write.key &&
          write.body.tenantId === fixture.tenantId &&
          write.body.calendarCode === fixture.calendarCode &&
          !('operatorId' in write.body),
      ),
    ).toBe(true)
    await page.screenshot({ path: resolve(evidence, 'admin-governance.png'), fullPage: true })
    const permissions: Record<string, { preview: number; write: number }> = {}
    for (const role of ['tenantAdmin', 'auditor', 'tenantUser'] as const) {
      const context = await browser.newContext({
        baseURL: String(testInfo.project.use.baseURL),
        serviceWorkers: 'block',
      })
      contexts.push(context)
      const user = await context.newPage()
      if (role === 'tenantAdmin') await fixture.login(context.request, true)
      else {
        const login = await context.request.post('/api/console/auth/login', {
          headers: { 'X-Tenant-Id': fixture.tenantId },
          data: {
            username: role === 'auditor' ? fixture.auditorName : fixture.userName,
            password: fixture.password,
          },
        })
        expect(login.status()).toBe(200)
        expect((await context.request.get('/api/console/auth/check')).status()).toBe(204)
      }
      const preview = await context.request.get(previewPath, {
        params: { tenantId: fixture.tenantId, calendarCode: fixture.calendarCode },
      })
      expect(preview.status()).toBe(role === 'tenantUser' ? 403 : 200)
      const forbidden = await fixture.mutate(context.request, '/api/console/batch-days/operate', {
        tenantId: fixture.tenantId,
        calendarCode: fixture.calendarCode,
        bizDate: fixture.bizDate,
        action: 'REOPEN',
        reason: 'must be rejected',
      })
      expect(forbidden.status()).toBe(403)
      permissions[role] = { preview: preview.status(), write: forbidden.status() }
      await installE2eLocale(user)
      await seedBrowserStorage(user, {
        session: '1',
        tenantId: fixture.tenantId,
        onboardingDone: '1',
      })
      await user.goto(url)
      if (role === 'tenantUser')
        await expect(user.getByRole('button', { name: governanceTitle, exact: true })).toHaveCount(
          0,
        )
      else {
        await user.getByRole('button', { name: governanceTitle, exact: true }).click()
        const readonly = user.getByRole('dialog', { name: governanceTitle, exact: true })
        await expect(
          readonly.getByText(e2eText('batchDayGovernance.catchup'), { exact: true }),
        ).toBeVisible()
        await expect(
          readonly.getByRole('button', {
            name: e2eText('batchDayGovernance.actions.REOPEN'),
            exact: true,
          }),
        ).toHaveCount(0)
      }
      if (role !== 'auditor') {
        const cross = await context.request.get(previewPath, {
          params: { tenantId: `${fixture.tenantId}-other`, calendarCode: fixture.calendarCode },
        })
        expect(cross.status()).toBe(403)
      }
      await fixture.mutate(context.request, '/api/console/auth/logout', {})
    }
    expect(fixture.governanceState().audits).toHaveLength(7)
    writeFileSync(
      resolve(evidence, 'verified-state.json'),
      JSON.stringify(
        {
          state,
          permissions,
          writes: writes.length,
          allWritesHaveIdempotencyKey: true,
          lostResponseReloadRetryUsedSameKey: true,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    primaryError = error
  } finally {
    for (const context of contexts) await context.close()
    try {
      const cleanup = await fixture.finish(page.request)
      writeFileSync(resolve(evidence, 'cleanup.json'), JSON.stringify(cleanup, null, 2))
    } catch (cleanupError) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, cleanupError],
          'Governance scenario and cleanup failed',
        )
      throw cleanupError
    }
  }
  if (primaryError) throw primaryError
})
