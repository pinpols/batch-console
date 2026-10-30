import { request as requestFactory, type BrowserContext } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { csrfHeaders, expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { ManualFileUploadFixture } from './fixtures/runtime-progress/manualFileUploadFixture'

const enabled = process.env.E2E_MANUAL_FILE_UPLOAD_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and fixture cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(180_000)
test.skip(
  !enabled,
  'Requires integrated WDI Console, PostgreSQL, MinIO and an exclusive acceptance slot',
)

type ApiEnvelope<T> = { data?: T }
type FilePage = { items?: Array<{ id: number; fileName: string; fileStatus: string }> }
type AuditPage = {
  items?: Array<{ fileId: number; operationType: string; operationResult: string }>
}
type ChannelResponse = { channelCode?: string }

async function authenticate(
  context: BrowserContext,
  username: string,
  tenantId: string,
  password: string,
) {
  const response = await context.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': tenantId },
    data: { username, password },
  })
  expect(response.status(), `${username} must authenticate`).toBe(200)
  expect((await context.request.get('/api/console/auth/check')).status()).toBe(204)
}

async function showTenantFilePage(page: import('@playwright/test').Page, tenantId: string) {
  await installE2eLocale(page)
  await seedBrowserStorage(page, { session: '1', tenantId, onboardingDone: '1' })
  await page.goto('/files/list')
  await expect(page).toHaveURL(/\/files\/list$/)
}

test('人工文件上传写入真实对象、确认到达并留下可读审计', async ({ browser, page }, testInfo) => {
  const fixture = new ManualFileUploadFixture()
  const contexts: BrowserContext[] = []
  const anonymous = await requestFactory.newContext({
    baseURL: String(testInfo.project.use.baseURL),
  })
  let prepared = false
  let uploadCreated = false
  let primaryError: unknown
  let roleCleanup = { roleAccountsRemaining: 0 }
  let uploadCleanup: Record<string, number> = {}
  const uploadNetworkEvents: Array<{
    method: string
    path: string
    status?: number
    failure?: string
  }> = []
  let releaseUploadResponse = () => undefined
  let uploadContentRouteInstalled = false

  page.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (/\/api\/console\/files\/(presign-upload|\d+\/(content|confirm-arrival))$/.test(path)) {
      uploadNetworkEvents.push({
        method: response.request().method(),
        path,
        status: response.status(),
      })
    }
  })
  page.on('requestfailed', (request) => {
    const path = new URL(request.url()).pathname
    if (/\/api\/console\/files\/(presign-upload|\d+\/(content|confirm-arrival))$/.test(path)) {
      uploadNetworkEvents.push({
        method: request.method(),
        path,
        failure: request.failure()?.errorText ?? 'request failed without browser detail',
      })
    }
  })

  try {
    fixture.prepare()
    prepared = true
    expect(fixture.prepareUploadRoles().roleAccountsCreated).toBe(2)
    await fixture.login(page.request)

    const channelResponse = await fixture.mutate(page.request, '/api/console/file-channels', {
      tenantId: fixture.tenantId,
      channelCode: fixture.channelCode,
      channelName: 'Manual upload real acceptance',
      channelType: 'LOCAL',
      targetEndpoint: '',
      authType: 'NONE',
      configJson: '{}',
      receiptPolicy: 'NONE',
      timeoutSeconds: 15,
      enabled: true,
    })
    expect(channelResponse.status()).toBe(200)
    expect(((await channelResponse.json()) as ApiEnvelope<ChannelResponse>).data?.channelCode).toBe(
      fixture.channelCode,
    )
    expect(fixture.prepareUploadBundleTarget().uploadTargetCount).toBe(1)

    await showTenantFilePage(page, fixture.tenantId)
    const uploadAction = page.getByRole('button', { name: e2eText('fileList.uploadAction') })
    await expect(uploadAction).toBeVisible()
    await uploadAction.click()
    const uploadDialog = page.getByRole('dialog').filter({ has: page.locator('.file-upload-form') })
    await uploadDialog.locator('.file-upload-form .el-select').first().click()
    await page.getByRole('option', { name: new RegExp(fixture.channelCode) }).click()
    await uploadDialog.locator('.file-upload-form .el-select').nth(1).click()
    await page.getByRole('option', { name: new RegExp(fixture.fileGroupCode) }).click()
    await uploadDialog.locator('input[type="file"]').setInputFiles({
      name: fixture.fileName,
      mimeType: 'text/csv',
      buffer: Buffer.from('account_id,amount\nWDI-REAL-UPLOAD,42\n', 'utf8'),
    })
    await uploadDialog.locator('.file-upload-form textarea').fill(fixture.fileName)
    await uploadDialog.locator('.file-upload-form .el-select').nth(2).click()
    await page.getByRole('option', { name: new RegExp(fixture.templateCode) }).click()
    await uploadDialog.locator('.el-date-editor input').fill(fixture.bizDate)
    await uploadDialog.locator('.file-upload-form textarea').click()
    await uploadDialog.getByRole('button', { name: e2eText('fileList.uploadSubmit') }).click()
    const confirmDialog = page.locator('.el-message-box')
    await expect(confirmDialog).toBeVisible()
    const uploadContentResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/console/files/') &&
        response.url().includes('/content?') &&
        response.request().method() === 'PUT',
      { timeout: 45_000 },
    )
    const uploadSessionPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/console/files/presign-upload') &&
        response.request().method() === 'POST',
    )
    let signalUploadResponseReady!: () => void
    const uploadResponseReady = new Promise<void>((resolve) => {
      signalUploadResponseReady = resolve
    })
    let releaseUploadResponseGate!: () => void
    const uploadResponseGate = new Promise<void>((resolve) => {
      releaseUploadResponseGate = resolve
    })
    releaseUploadResponse = releaseUploadResponseGate
    let uploadResponseFromServer: Awaited<ReturnType<typeof page.request.fetch>> | undefined
    let uploadResponseFetchError: unknown
    await page.route('**/api/console/files/*/content**', async (route) => {
      try {
        uploadResponseFromServer = await route.fetch({ timeout: 45_000 })
      } catch (error) {
        uploadResponseFetchError = error
      } finally {
        signalUploadResponseReady()
      }
      if (uploadResponseFetchError) throw uploadResponseFetchError
      if (!uploadResponseFromServer) {
        throw new Error('upload content request completed without a server response')
      }
      await uploadResponseGate
      await route.fulfill({ response: uploadResponseFromServer })
    })
    uploadContentRouteInstalled = true
    await confirmDialog.getByRole('button', { name: e2eText('common.confirm') }).click()
    const sessionResponse = await uploadSessionPromise
    expect(sessionResponse.status()).toBe(200)
    uploadCreated = true
    const session = (
      (await sessionResponse.json()) as ApiEnvelope<{
        fileId: number
        storageBucket: string
        storagePath: string
      }>
    ).data
    expect(session?.fileId).toBeGreaterThan(0)
    await uploadResponseReady
    if (uploadResponseFetchError) throw uploadResponseFetchError
    expect(uploadResponseFromServer?.status()).toBe(200)
    await page.waitForTimeout(35_000)
    const preConfirmation = fixture.uploadState()
    expect(preConfirmation).toMatchObject({
      fileId: session?.fileId,
      bizDate: fixture.bizDate,
      metadataBizDate: fixture.bizDate,
      fileGroupCode: fixture.fileGroupCode,
      bundleWorkflowCode: fixture.workflowCode,
      bundleTemplateCode: fixture.templateCode,
      requiredFileSet: fixture.fileName,
      arrivalConfirmedAt: null,
      workflowRunCount: 0,
    })
    const content = Buffer.from('account_id,amount\nWDI-REAL-UPLOAD,42\n', 'utf8')
    const objectBeforeConfirmation = fixture.readUploadedObject(
      session?.storageBucket ?? '',
      session?.storagePath ?? '',
    )
    expect(objectBeforeConfirmation.equals(content)).toBe(true)
    const confirmArrivalResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/confirm-arrival') && response.request().method() === 'POST',
      { timeout: 45_000 },
    )
    releaseUploadResponse()
    const uploadContentResponse = await uploadContentResponsePromise
    expect(uploadContentResponse.status()).toBe(200)
    await page.unroute('**/api/console/files/*/content**')
    uploadContentRouteInstalled = false
    const confirmed = await confirmArrivalResponse
    expect(confirmed.status()).toBe(200)

    await expect(uploadDialog.locator('.file-upload-stage')).toContainText(
      e2eText('fileList.uploadStageGroupComplete'),
    )
    await expect(uploadDialog.locator('.file-upload-alert').last()).toContainText(fixture.fileName)

    const listResponse = await page.request.get('/api/console/queries/files', {
      params: {
        tenantId: fixture.tenantId,
        fileId: String(session?.fileId),
        pageNo: '1',
        pageSize: '10',
      },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    expect(listResponse.status()).toBe(200)
    const listed = ((await listResponse.json()) as ApiEnvelope<FilePage>).data?.items ?? []
    const uploadedRecord = listed.find((row) => row.id === session?.fileId)
    expect(uploadedRecord).toMatchObject({ fileName: fixture.fileName, fileStatus: 'RECEIVED' })

    const auditResponse = await page.request.get('/api/console/queries/audits', {
      params: {
        tenantId: fixture.tenantId,
        fileId: String(session?.fileId),
        pageNo: '1',
        pageSize: '50',
      },
      headers: { 'X-Tenant-Id': fixture.tenantId },
    })
    expect(auditResponse.status()).toBe(200)
    const auditRows = ((await auditResponse.json()) as ApiEnvelope<AuditPage>).data?.items ?? []
    const fileAudits = auditRows.filter((row) => row.fileId === session?.fileId)
    expect(fileAudits.map((row) => row.operationType)).toEqual(
      expect.arrayContaining(['UPLOAD_SESSION_CREATED', 'CONFIRM_ARRIVAL']),
    )
    expect(fileAudits.every((row) => row.operationResult === 'SUCCESS')).toBe(true)

    await expect
      .poll(() => fixture.uploadState().workflowRunStatus, {
        timeout: 90_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe('SUCCESS')
    const persisted = fixture.uploadState()
    const linked = persisted
    const uploadedObject = fixture.readUploadedObject(
      persisted.storageBucket ?? '',
      persisted.storagePath ?? '',
    )
    const objectContentMatchesUploadedBytes = uploadedObject.equals(content)
    expect(objectContentMatchesUploadedBytes).toBe(true)
    const contentSize = content.byteLength
    expect(persisted).toMatchObject({
      fileId: session?.fileId,
      fileCount: 1,
      fileSizeBytes: contentSize,
      fileStatus: 'RECEIVED',
      uploadMode: 'APP_MANAGED',
      arrivalConfirmedAt: expect.any(String),
      bizDate: fixture.bizDate,
      metadataBizDate: fixture.bizDate,
      fileGroupCode: fixture.fileGroupCode,
      bundleWorkflowCode: fixture.workflowCode,
      bundleTemplateCode: fixture.templateCode,
      requiredFileSet: fixture.fileName,
      workflowDefinitionId: expect.any(Number),
      workflowRunCount: 1,
      workflowRunStatus: 'SUCCESS',
      auditOperations: expect.arrayContaining(['UPLOAD_SESSION_CREATED', 'CONFIRM_ARRIVAL']),
      channelCount: 1,
    })

    const tenantAdmin = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    const auditor = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    const tenantUser = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      serviceWorkers: 'block',
    })
    contexts.push(tenantAdmin, auditor, tenantUser)
    await authenticate(tenantAdmin, fixture.readerName, fixture.tenantId, fixture.password)
    await authenticate(auditor, fixture.auditorName, fixture.tenantId, fixture.password)
    await authenticate(tenantUser, fixture.userName, fixture.tenantId, fixture.password)

    const tenantAdminPage = await tenantAdmin.newPage()
    await showTenantFilePage(tenantAdminPage, fixture.tenantId)
    await expect(
      tenantAdminPage.getByRole('button', { name: e2eText('fileList.uploadAction') }),
    ).toBeVisible()
    const auditorPage = await auditor.newPage()
    await showTenantFilePage(auditorPage, fixture.tenantId)
    await expect(
      auditorPage.getByRole('button', { name: e2eText('fileList.uploadAction') }),
    ).toHaveCount(0)
    const userPage = await tenantUser.newPage()
    await showTenantFilePage(userPage, fixture.tenantId)
    await expect(
      userPage.getByRole('button', { name: e2eText('fileList.uploadAction') }),
    ).toHaveCount(0)

    const auditorUpload = await auditor.request.post('/api/console/files/presign-upload', {
      params: {
        tenantId: fixture.tenantId,
        channelCode: fixture.channelCode,
        fileName: 'auditor-check.csv',
      },
      headers: {
        ...(await csrfHeaders(auditor.request)),
        'X-Tenant-Id': fixture.tenantId,
        'Idempotency-Key': `upload-role-${randomUUID()}`,
      },
    })
    const tenantUserUpload = await tenantUser.request.post('/api/console/files/presign-upload', {
      params: {
        tenantId: fixture.tenantId,
        channelCode: fixture.channelCode,
        fileName: 'user-check.csv',
      },
      headers: {
        ...(await csrfHeaders(tenantUser.request)),
        'X-Tenant-Id': fixture.tenantId,
        'Idempotency-Key': `upload-role-${randomUUID()}`,
      },
      failOnStatusCode: false,
    })
    const anonymousUpload = await anonymous.post('/api/console/files/presign-upload', {
      params: {
        tenantId: fixture.tenantId,
        channelCode: fixture.channelCode,
        fileName: 'anonymous-check.csv',
      },
      headers: {
        'X-Tenant-Id': fixture.tenantId,
        'Idempotency-Key': `upload-role-${randomUUID()}`,
      },
      failOnStatusCode: false,
    })
    expect(auditorUpload.status()).toBe(403)
    expect(tenantUserUpload.status()).toBe(403)
    expect([401, 403]).toContain(anonymousUpload.status())

    await testInfo.attach('manual-upload-real-evidence.json', {
      body: JSON.stringify(
        {
          contentBytes: contentSize,
          objectStorageNamespace: fixture.objectStorageNamespace || null,
          objectContentMatchesUploadedBytes,
          persistedFileStatus: persisted.fileStatus,
          arrivalConfirmed: Boolean(persisted.arrivalConfirmedAt),
          preConfirmationWorkflowRunCount: preConfirmation.workflowRunCount,
          workflowDefinitionId: linked.workflowDefinitionId,
          workflowRunCount: linked.workflowRunCount,
          workflowRunStatus: linked.workflowRunStatus,
          auditOperations: ['UPLOAD_SESSION_CREATED', 'CONFIRM_ARRIVAL'],
          roleStatuses: {
            admin: 200,
            auditor: auditorUpload.status(),
            tenantUser: tenantUserUpload.status(),
            anonymous: anonymousUpload.status(),
          },
          uiWriteActions: {
            tenantAdminVisible: true,
            auditorHidden: true,
            tenantUserHidden: true,
          },
          downstreamWorkflowLinked:
            linked.workflowRunCount === 1 && linked.workflowRunStatus === 'SUCCESS',
        },
        null,
        2,
      ),
      contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    await testInfo.attach('manual-upload-network-events.json', {
      body: JSON.stringify(uploadNetworkEvents, null, 2),
      contentType: 'application/json',
    })
    throw error
  } finally {
    releaseUploadResponse()
    if (uploadContentRouteInstalled)
      await page.unroute('**/api/console/files/*/content**').catch(() => undefined)
    for (const context of contexts) await context.close().catch(() => undefined)
    await anonymous.dispose().catch(() => undefined)
    if (prepared) {
      const cleanupErrors: unknown[] = []
      let uploadIsSafeToDelete = false
      try {
        await fixture.ensureWorkflowTerminal(page.request)
        uploadIsSafeToDelete = true
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
      if (uploadIsSafeToDelete) {
        let persisted: ReturnType<typeof fixture.uploadState> | undefined
        try {
          persisted = fixture.uploadState()
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError)
        }
        if (persisted) {
          try {
            if (persisted.fileCount > 0)
              fixture.removeUploadedObject(persisted.storageBucket, persisted.storagePath)
          } catch (cleanupError) {
            cleanupErrors.push(cleanupError)
          }
          try {
            uploadCleanup = fixture.cleanupUploadRows()
            expect(uploadCleanup).toMatchObject({ fileRowsRemaining: 0, channelsRemaining: 0 })
            expect(Object.values(uploadCleanup).reduce((total, value) => total + value, 0)).toBe(0)
          } catch (cleanupError) {
            cleanupErrors.push(cleanupError)
          }
        }
      }
      try {
        roleCleanup = fixture.cleanupUploadRoles()
        expect(roleCleanup.roleAccountsRemaining).toBe(0)
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
      if (uploadIsSafeToDelete && Object.keys(uploadCleanup).length > 0) {
        try {
          const cleanup = await fixture.finish(page.request)
          expect(Object.values(cleanup).reduce((total, value) => total + value, 0)).toBe(0)
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError)
        }
      }
      if (cleanupErrors.length > 0) {
        if (primaryError)
          throw new AggregateError(
            [primaryError, ...cleanupErrors],
            'Upload E2E failed during cleanup',
          )
        throw new AggregateError(cleanupErrors, 'Upload E2E cleanup failed')
      }
    }
    if (uploadCreated && Object.keys(uploadCleanup).length > 0)
      await testInfo.attach('manual-upload-cleanup.json', {
        body: JSON.stringify({ ...uploadCleanup, ...roleCleanup }),
        contentType: 'application/json',
      })
  }
})
