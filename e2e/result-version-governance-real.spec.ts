import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { BrowserContext } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { ResultVersionGovernanceFixture } from './fixtures/runtime-progress/fixture'

const enabled = process.env.E2E_RESULT_VERSION_GOVERNANCE_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(180_000)
test.skip(
  !enabled,
  'Requires current WDI runtime, real authentication and exclusive acceptance slot',
)

test('结果版本治理真实浏览器：安全投影、提升/归档、角色权限与审计持久化', async ({
  page,
  browser,
}, testInfo) => {
  const fixture = new ResultVersionGovernanceFixture()
  const evidenceDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(
    new Date(),
  )
  const evidence = resolve('docs/reports/assets', `result-version-governance-${evidenceDate}`)
  mkdirSync(evidence, { recursive: true })
  const contexts: BrowserContext[] = []
  let adminContext: BrowserContext | undefined
  let primaryError: unknown
  let cleanup: Record<string, number> | undefined
  const permissions: Record<string, { list: number; write: number }> = {}
  let apiPayloadFieldsOmitted = false
  let pagePayloadMarkerOmitted = false
  let effectiveTransition: Array<{ versionNo: number; status: string }> = []
  let archivedStatus = ''
  let auditEvidence: Array<{
    action: string
    result: string
  }> = []

  async function listVersions(request: BrowserContext['request'], businessKey: string) {
    return request.get('/api/console/result-versions', {
      params: { tenantId: fixture.tenantId, businessKey },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
  }

  async function loginRole(context: BrowserContext, username: string) {
    const response = await context.request.post('/api/console/auth/login', {
      headers: { 'X-Tenant-Id': fixture.tenantId },
      data: { username, password: fixture.password },
    })
    expect(response.status(), `${username} 登录必须成功`).toBe(200)
    expect((await context.request.get('/api/console/auth/check')).status()).toBe(204)
  }

  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
    fixture.prepare()
    adminContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    contexts.push(adminContext)
    await fixture.login(adminContext.request)
    await fixture.login(page.request, true)

    const initial = await listVersions(page.request, fixture.effectiveBusinessKey)
    expect(initial.status()).toBe(200)
    const initialRows = ((await initial.json()).data ?? []) as Array<Record<string, unknown>>
    expect(initialRows).toHaveLength(2)
    expect(initialRows.map((row) => row.status).sort()).toEqual(['EFFECTIVE', 'PENDING'])
    apiPayloadFieldsOmitted = initialRows.every(
      (row) => !('payloadJson' in row) && !('payloadRef' in row),
    )
    expect(apiPayloadFieldsOmitted, 'Console API 不得返回原始载荷或内部存储引用').toBe(true)

    const detailId = Number(initialRows.find((row) => row.versionNo === 2)?.id)
    expect(Number.isSafeInteger(detailId) && detailId > 0).toBe(true)
    const detailResponse = await page.request.get(`/api/console/result-versions/${detailId}`, {
      params: { tenantId: fixture.tenantId },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    expect(detailResponse.status()).toBe(200)
    const detailBody = JSON.stringify(await detailResponse.json())
    expect(detailBody).not.toContain(fixture.payloadMarker)
    expect(detailBody).not.toContain('payloadJson')
    expect(detailBody).not.toContain('payloadRef')

    const pageUrl = '/ops/batch-day-replay'
    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.setViewportSize({ width: 1440, height: 1050 })
    await page.goto(pageUrl)
    const panel = page.locator('.result-version-governance')
    await expect(panel).toBeVisible()
    const keyInput = panel.locator('.result-version-governance__business-key').getByRole('textbox')
    await keyInput.fill(fixture.effectiveBusinessKey)
    await panel
      .getByRole('button', {
        name: e2eText('batchDayReplay.resultGovernanceSearch'),
        exact: true,
      })
      .click()
    await expect(panel.locator('.result-version-governance__effective')).toContainText('v1')

    const pendingRow = panel.getByRole('row').filter({ hasText: 'v2' }).first()
    await pendingRow
      .getByRole('button', {
        name: e2eText('common.detail'),
        exact: true,
      })
      .click()
    const detailDrawer = page.locator('.el-drawer:visible')
    await expect(detailDrawer).toBeVisible()
    await expect(detailDrawer).toContainText(
      e2eText('batchDayReplay.resultGovernancePayloadOmitted'),
    )
    pagePayloadMarkerOmitted = !(await page
      .getByText(fixture.payloadMarker, { exact: false })
      .count())
    expect(pagePayloadMarkerOmitted).toBe(true)
    await page.screenshot({ path: resolve(evidence, 'result-version-detail.png'), fullPage: true })
    await detailDrawer.locator('.el-drawer__close-btn').click()

    await pendingRow
      .getByRole('button', {
        name: e2eText('batchDayReplay.resultGovernancePromote'),
        exact: true,
      })
      .click()
    const promoteConfirm = page.locator('.el-message-box:visible')
    await expect(promoteConfirm).toContainText(
      e2eText('batchDayReplay.resultGovernancePromoteConfirm').replace('{version}', '2'),
    )
    await promoteConfirm
      .getByRole('button', { name: e2eText('common.confirm'), exact: true })
      .click()
    await expect(panel.locator('.result-version-governance__effective')).toContainText('v2')
    const supersededRow = panel.getByRole('row').filter({ hasText: 'v1' }).first()
    await expect(
      supersededRow.getByText(e2eText('batchDayReplay.resultGovernanceSuperseded'), {
        exact: true,
      }),
    ).toBeVisible()

    const archivedKeyRows = await listVersions(page.request, fixture.archivedBusinessKey)
    expect(archivedKeyRows.status()).toBe(200)
    const archivedCandidate = (
      ((await archivedKeyRows.json()).data ?? []) as Array<{ id: number; status: string }>
    )[0]
    expect(archivedCandidate?.status).toBe('PENDING')
    const tenantUserContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    const auditorContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    contexts.push(tenantUserContext, auditorContext)
    await loginRole(tenantUserContext, fixture.userName)
    await loginRole(auditorContext, fixture.auditorName)
    for (const [role, context] of [
      ['tenantUser', tenantUserContext],
      ['auditor', auditorContext],
    ] as const) {
      const list = await listVersions(context.request, fixture.archivedBusinessKey)
      const deniedPromote = await fixture.mutate(
        context.request,
        `/api/console/result-versions/${archivedCandidate!.id}/promote`,
        undefined,
      )
      expect(list.status(), `${role} 可读取结果版本`).toBe(200)
      expect(deniedPromote.status(), `${role} 不得提升结果版本`).toBe(403)
      permissions[role] = { list: list.status(), write: deniedPromote.status() }
    }
    const crossTenantRead = await tenantUserContext.request.get('/api/console/result-versions', {
      params: {
        tenantId: `${fixture.tenantId}-other`,
        businessKey: fixture.archivedBusinessKey,
      },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    expect(crossTenantRead.status(), '租户用户不得跨租户读取版本').toBe(403)

    await keyInput.fill(fixture.archivedBusinessKey)
    await panel
      .getByRole('button', {
        name: e2eText('batchDayReplay.resultGovernanceSearch'),
        exact: true,
      })
      .click()
    const archivedCandidateRow = panel.getByRole('row').filter({ hasText: 'v1' }).first()
    await archivedCandidateRow
      .getByRole('button', {
        name: e2eText('batchDayReplay.resultGovernanceReject'),
        exact: true,
      })
      .click()
    const rejectConfirm = page.locator('.el-message-box:visible')
    await expect(rejectConfirm).toContainText(
      e2eText('batchDayReplay.resultGovernanceRejectConfirm').replace('{version}', '1'),
    )
    await rejectConfirm
      .getByRole('button', { name: e2eText('common.confirm'), exact: true })
      .click()
    const archivedLabel = e2eText('batchDayReplay.resultGovernanceArchived')
    await expect(panel.getByText(archivedLabel, { exact: true })).toBeVisible()
    const adminCandidatesResponse = await listVersions(
      adminContext.request,
      fixture.adminArchivedBusinessKey,
    )
    expect(adminCandidatesResponse.status()).toBe(200)
    const adminCandidate = (
      ((await adminCandidatesResponse.json()).data ?? []) as Array<{ id: number; status: string }>
    )[0]
    expect(adminCandidate?.status).toBe('PENDING')
    const adminReject = await fixture.mutate(
      adminContext.request,
      `/api/console/result-versions/${adminCandidate!.id}/reject`,
      undefined,
    )
    expect(adminReject.status(), 'ADMIN 可归档待处理候选').toBe(200)
    permissions.tenantAdmin = { list: 200, write: 200 }
    permissions.admin = { list: adminCandidatesResponse.status(), write: adminReject.status() }

    await expect(panel.getByText(archivedLabel, { exact: true })).toBeVisible()
    archivedStatus = await panel.getByText(archivedLabel, { exact: true }).innerText()
    await page.screenshot({
      path: resolve(evidence, 'result-version-archived.png'),
      fullPage: true,
    })

    const state = fixture.resultVersionState()
    effectiveTransition = state.versions
      .filter((row) => row.businessKey === fixture.effectiveBusinessKey)
      .map(({ versionNo, status }) => ({ versionNo, status }))
      .sort((left, right) => left.versionNo - right.versionNo)
    expect(effectiveTransition).toEqual([
      { versionNo: 1, status: 'SUPERSEDED' },
      { versionNo: 2, status: 'EFFECTIVE' },
    ])
    expect(state.currentEffectiveCount).toBe(1)
    expect(
      state.versions.every((row) => row.payloadJson?.includes(fixture.payloadMarker)),
      '原始结果仍只保存在数据库中供业务读取',
    ).toBe(true)
    const archivedRows = state.versions.filter((row) =>
      [fixture.archivedBusinessKey, fixture.adminArchivedBusinessKey].includes(row.businessKey),
    )
    expect(archivedRows.map((row) => row.status)).toEqual(['ARCHIVED', 'ARCHIVED'])
    const successfulAudits = state.audits.filter((row) => row.result === 'SUCCESS')
    expect(successfulAudits).toHaveLength(3)
    expect(successfulAudits.map((row) => [row.action, row.tenantId])).toEqual(
      expect.arrayContaining([
        ['result_version.promote', fixture.tenantId],
        ['result_version.reject', fixture.tenantId],
        ['result_version.reject', fixture.tenantId],
      ]),
    )
    expect(successfulAudits.every((row) => row.operatorId !== 'UNKNOWN')).toBe(true)
    auditEvidence = successfulAudits.map(({ action, result }) => ({ action, result }))
  } catch (error) {
    primaryError = error
  } finally {
    try {
      cleanup = await fixture.finish(adminContext?.request ?? page.request, page.request)
    } catch (cleanupError) {
      if (primaryError)
        primaryError = new AggregateError(
          [primaryError, cleanupError],
          'Result version scenario and cleanup failed',
        )
      else primaryError = cleanupError
    } finally {
      for (const context of contexts) await context.close()
    }
    writeFileSync(
      resolve(evidence, 'real-evidence.json'),
      JSON.stringify(
        {
          anonymousAuthStatus: 401,
          apiPayloadFieldsOmitted,
          pagePayloadMarkerOmitted,
          effectiveTransition,
          archivedStatus,
          permissions,
          successfulAudits: auditEvidence,
          cleanup,
          cleanupAllZero:
            cleanup !== undefined &&
            cleanup.resultVersionRowsRemaining === 0 &&
            cleanup.credentialAccounts === 0 &&
            Object.entries(cleanup).every(([key, value]) => key.endsWith('Deleted') || value === 0),
        },
        null,
        2,
      ),
    )
  }
  if (primaryError) throw primaryError
})
