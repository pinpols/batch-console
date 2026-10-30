import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import type { BrowserContext } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { ForensicExportFixture } from './fixtures/runtime-progress/forensicExportFixture'
import type { ForensicExportResponse } from '@/api/forensic'

const enabled = process.env.E2E_FORENSIC_EXPORT_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(180_000)
test.skip(!enabled, 'Requires current WDI Console and Orchestrator with real authentication')

test('取证导出真实持久化、ZIP校验、下载与权限边界', async ({ page, browser }, testInfo) => {
  const fixture = new ForensicExportFixture()
  const exportDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(
    new Date(),
  )
  const evidenceDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(
    new Date(),
  )
  const evidenceDir = resolve('docs/reports/assets', `forensic-export-${evidenceDate}`)
  mkdirSync(evidenceDir, { recursive: true })
  const contexts: BrowserContext[] = []
  let tenantAdminContext: BrowserContext | undefined
  let primaryError: unknown
  let anonymousAuthStatus = 0
  let tenantAdminExportStatus: number | undefined
  let fixturePrepared = false
  let responseData: ForensicExportResponse | undefined
  let persistedRowCount = 0
  let bundleEntries: string[] = []
  let bundleShaMatches = false
  let manifestVerified = false
  let storagePathHidden = false
  let cleanup: Record<string, number> | undefined
  let forensicCleanup:
    { deletedRows: number; filesRemoved: number; remainingRows: number } | undefined
  let fileSizeBytes: number | undefined

  try {
    anonymousAuthStatus = (await page.request.get('/api/console/auth/me')).status()
    expect(anonymousAuthStatus).toBe(401)
    fixture.prepare()
    fixturePrepared = true

    tenantAdminContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    contexts.push(tenantAdminContext)
    await fixture.login(tenantAdminContext.request, true)
    await fixture.login(page.request)

    const request = {
      tenantId: fixture.tenantId,
      bizDateFrom: exportDate,
      bizDateTo: exportDate,
      exportFormat: 'BUNDLE',
    }
    const forbiddenExport = await fixture.mutate(
      tenantAdminContext.request,
      '/api/console/forensic/export',
      request,
    )
    tenantAdminExportStatus = forbiddenExport.status()
    expect(tenantAdminExportStatus).toBe(403)

    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/ops/diagnostic')

    const exportSection = page.locator('.forensic-export')
    await expect(exportSection).toBeVisible()
    await expect(exportSection.getByText(e2eText('opsDiagnostic.forensicAdminOnly'))).toBeVisible()
    const creationResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/console/forensic/export',
    )
    await exportSection
      .getByRole('button', { name: e2eText('opsDiagnostic.forensicCreate'), exact: true })
      .click()
    const confirmation = page.locator('.el-message-box:visible')
    await expect(confirmation).toBeVisible()
    await confirmation.locator('button.el-button--danger').click()

    const creationResponse = await creationResponsePromise
    expect(creationResponse.status()).toBe(200)
    const responseBody = (await creationResponse.json()) as {
      data: ForensicExportResponse
    }
    responseData = responseBody.data
    expect(responseData.status).toBe('COMPLETED')
    expect(responseData.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(responseData.fileSizeBytes).toBeGreaterThan(0)
    expect(responseData.storagePath).toBeTruthy()
    await expect(exportSection.getByText('COMPLETED', { exact: true })).toBeVisible()
    await expect(exportSection.getByText(responseData.sha256!, { exact: true })).toBeVisible()
    storagePathHidden = !(await exportSection.innerText()).includes(responseData.storagePath!)
    expect(storagePathHidden).toBe(true)

    const rows = fixture.forensicState()
    persistedRowCount = rows.length
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row).toMatchObject({
      tenantId: fixture.tenantId,
      exportId: responseData.exportId,
      bizDateFrom: exportDate,
      bizDateTo: exportDate,
      exportFormat: 'BUNDLE',
      status: 'COMPLETED',
      fileSizeBytes: responseData.fileSizeBytes,
      sha256: responseData.sha256,
      requestedBy: expect.any(String),
    })
    expect(row.requestedBy.length).toBeGreaterThan(0)
    expect(row.storagePath).toBe(responseData.storagePath)
    expect(resolve(row.storagePath!)).toBe(join(fixture.storageDir, `${responseData.exportId}.zip`))

    const scratchDir = mkdtempSync(join(tmpdir(), 'forensic-export-download-'))
    try {
      const downloadedFile = join(scratchDir, 'bundle.zip')
      const downloadPromise = page.waitForEvent('download')
      await exportSection
        .getByRole('button', { name: e2eText('opsDiagnostic.forensicDownload'), exact: true })
        .click()
      const download = await downloadPromise
      await download.saveAs(downloadedFile)
      const bytes = readFileSync(downloadedFile)
      fileSizeBytes = bytes.byteLength
      const downloadedSha = createHash('sha256').update(bytes).digest('hex')
      bundleShaMatches = downloadedSha === responseData.sha256
      expect(bundleShaMatches).toBe(true)
      expect(fileSizeBytes).toBe(responseData.fileSizeBytes)

      bundleEntries = execFileSync('unzip', ['-Z1', downloadedFile], { encoding: 'utf8' })
        .trim()
        .split('\n')
        .sort()
      expect(bundleEntries).toEqual(
        ['batch-day-operation-audits.json', 'job-instances.json', 'manifest.json'].sort(),
      )
      const manifest = JSON.parse(
        execFileSync('unzip', ['-p', downloadedFile, 'manifest.json'], { encoding: 'utf8' }),
      ) as Record<string, unknown>
      expect(manifest).toMatchObject({
        exportId: responseData.exportId,
        tenantId: fixture.tenantId,
        bizDateFrom: exportDate,
        bizDateTo: exportDate,
        requestedBy: row.requestedBy,
        rowCounts: { job_instances: 0, batch_day_operation_audits: 0 },
      })
      manifestVerified = true
      expect(
        JSON.parse(
          execFileSync('unzip', ['-p', downloadedFile, 'job-instances.json'], {
            encoding: 'utf8',
          }),
        ),
      ).toEqual([])
      expect(
        JSON.parse(
          execFileSync('unzip', ['-p', downloadedFile, 'batch-day-operation-audits.json'], {
            encoding: 'utf8',
          }),
        ),
      ).toEqual([])
    } finally {
      rmSync(scratchDir, { recursive: true, force: true })
    }
  } catch (error) {
    primaryError = error
  } finally {
    try {
      forensicCleanup = fixture.cleanupForensic()
      expect(forensicCleanup.remainingRows).toBe(0)
    } catch (cleanupError) {
      primaryError = primaryError
        ? new AggregateError([primaryError, cleanupError], 'Forensic export cleanup failed')
        : cleanupError
    }
    try {
      cleanup = await fixture.finish(page.request, tenantAdminContext?.request)
      if (fixturePrepared) {
        expect(cleanup.credentialAccounts).toBe(0)
        expect(Object.values(cleanup).every((count) => count === 0)).toBe(true)
      } else {
        expect(Object.keys(cleanup)).toHaveLength(0)
      }
    } catch (cleanupError) {
      primaryError = primaryError
        ? new AggregateError(
            [primaryError, cleanupError],
            'Forensic and parent fixture cleanup failed',
          )
        : cleanupError
    } finally {
      for (const context of contexts) await context.close()
    }
    writeFileSync(
      resolve(evidenceDir, 'real-evidence.json'),
      JSON.stringify(
        {
          anonymousAuthStatus,
          tenantAdminExportStatus,
          exportCompleted: responseData?.status === 'COMPLETED',
          fileSizeBytes,
          sha256Matches: bundleShaMatches,
          bundleEntries,
          manifestVerified,
          storagePathHidden,
          persistedRowCount,
          forensicCleanup,
          parentCleanup: cleanup,
        },
        null,
        2,
      ) + '\n',
    )
  }

  if (primaryError) throw primaryError
})
