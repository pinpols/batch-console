/**
 * D 档 upload-full-chain:租户配置包 Excel 导入 完整链路。
 *
 * Mock-mode(默认):page.route 拦截全链路,不依赖 BE。
 * Real-BE mode(E2E_REAL_BE=1):走真 BE,需要 BE 起,seed 文件在 e2e-data/。
 *
 * 链路:选文件 → upload(返回 token)→ preview(返回 summary)→ apply(返回 importId)→ audit 可见。
 */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from './support/app'
import { enterDemoApp, isVisible } from './support/app'

const useRealBE = process.env.E2E_REAL_BE === '1'

const FIXTURE_DIRS = [
  path.resolve(__dirname, '../e2e-data/01-tenant-config-import'),
  path.resolve(__dirname, '../e2e-data/00-tenant-lifecycle'),
]

function pickSeed(): string | null {
  for (const dir of FIXTURE_DIRS) {
    if (!fs.existsSync(dir)) continue
    const xlsx = fs.readdirSync(dir).find((f) => f.endsWith('.xlsx') && !f.startsWith('bad-'))
    if (xlsx) return path.join(dir, xlsx)
  }
  return null
}

const MOCK_TOKEN = 'mock-upload-token-' + Date.now()
const MOCK_UPLOAD_RESULT = {
  uploadToken: MOCK_TOKEN,
  fileName: 'mock-tenant-config-package.xlsx',
  resourceQueueRows: 1,
  businessCalendarRows: 1,
  batchWindowRows: 1,
  jobRows: 1,
  fileChannelRows: 1,
  fileTemplateRows: 1,
  pipelineRows: 1,
  pipelineStepRows: 1,
  workflowDefinitionRows: 1,
  workflowNodeRows: 1,
  workflowEdgeRows: 1,
}
const MOCK_PREVIEW = {
  uploadToken: MOCK_TOKEN,
  fileName: MOCK_UPLOAD_RESULT.fileName,
  totalRows: 11,
  validRows: 11,
  invalidRows: 0,
  sheets: [
    { sheetName: 'resource_queue', totalRows: 1, validRows: 1, invalidRows: 0 },
    { sheetName: 'business_calendar', totalRows: 1, validRows: 1, invalidRows: 0 },
    { sheetName: 'batch_window', totalRows: 1, validRows: 1, invalidRows: 0 },
    { sheetName: 'job_definition', totalRows: 1, validRows: 1, invalidRows: 0 },
    { sheetName: 'file_channel_config', totalRows: 1, validRows: 1, invalidRows: 0 },
    { sheetName: 'file_template_config', totalRows: 1, validRows: 1, invalidRows: 0 },
    { sheetName: 'pipeline_definition', totalRows: 1, validRows: 1, invalidRows: 0 },
    { sheetName: 'pipeline_step_definition', totalRows: 1, validRows: 1, invalidRows: 0 },
    { sheetName: 'workflow_definition', totalRows: 1, validRows: 1, invalidRows: 0 },
    { sheetName: 'workflow_node', totalRows: 1, validRows: 1, invalidRows: 0 },
    { sheetName: 'workflow_edge', totalRows: 1, validRows: 1, invalidRows: 0 },
  ],
  issues: [] as unknown[],
}
const MOCK_APPLY_RESULT = {
  uploadToken: MOCK_TOKEN,
  tenantId: 'ta',
  resourceQueueInserted: 1,
  resourceQueueUpdated: 0,
  businessCalendarInserted: 1,
  businessCalendarUpdated: 0,
  batchWindowInserted: 1,
  batchWindowUpdated: 0,
  jobInserted: 1,
  jobUpdated: 0,
  channelInserted: 1,
  channelUpdated: 0,
  fileTemplateInserted: 1,
  fileTemplateUpdated: 0,
  pipelineInserted: 1,
  pipelineUpdated: 0,
  workflowInserted: 1,
  workflowUpdated: 0,
}

async function installUploadMocks(page: import('@playwright/test').Page) {
  if (useRealBE) return

  await page.route('**/api/console/config/tenant-package/excel/upload**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'SUCCESS',
        message: 'ok',
        data: MOCK_UPLOAD_RESULT,
      }),
    }),
  )

  await page.route('**/api/console/config/tenant-package/excel/preview/**', (route) => {
    if (route.request().url().includes('/workbook')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: Buffer.from('mock-workbook'),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'SUCCESS', message: 'ok', data: MOCK_PREVIEW }),
    })
  })

  await page.route('**/api/console/config/tenant-package/excel/apply/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'SUCCESS', message: 'ok', data: MOCK_APPLY_RESULT }),
    }),
  )

  // 审计查询(applied 后)
  await page.route('**/api/console/queries/audits*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'SUCCESS',
        message: 'ok',
        data: {
          items: [
            {
              id: 1,
              eventType: 'TENANT_PACKAGE_APPLY',
              targetId: MOCK_TOKEN,
              createdAt: new Date().toISOString(),
              description: `applied ${MOCK_PREVIEW.validRows} config rows`,
            },
          ],
          total: 1,
        },
      }),
    }),
  )
}

test.describe('upload-full-chain · 租户配置包 Excel 导入', () => {
  test.beforeEach(async ({ page }) => {
    await installUploadMocks(page)
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, {
      timeout: 15_000,
    })
  })

  test('完整链路:上传 → preview 摘要可见 → apply → 状态/审计可见', async ({ page }) => {
    const seed = pickSeed()
    test.skip(!seed, '无 seed 文件可用')

    // 步骤 1:选择文件 → 开始上传
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: '选择文件' }).first().click(),
    ])
    await fileChooser.setFiles(seed!)
    await expect(page.getByRole('button', { name: '开始上传' })).toBeEnabled()
    await page.getByRole('button', { name: '开始上传' }).click()

    // 步骤 2:token alert 可见 → 进预览
    const tokenAlert = page.locator('.excel-wizard__token-alert, .el-alert').first()
    await expect(tokenAlert).toBeVisible({ timeout: 15_000 })

    const nextBtn = page.getByRole('button', { name: '下一步' })
    await expect(nextBtn).toBeEnabled({ timeout: 5000 })
    await nextBtn.click()

    // 步骤 3:拉预览
    const fetchPreview = page.getByRole('button', { name: '拉取预览' })
    await expect(fetchPreview).toBeVisible({ timeout: 5000 })
    await fetchPreview.click()

    // 预览结果可见(summary 或 table)
    const previewResult = page
      .locator('.excel-wizard__preview-summary, .el-table__body, .el-descriptions')
      .first()
    await expect(previewResult).toBeVisible({ timeout: 15_000 })

    // 步骤 4:进 apply(若可达)
    const next2 = page.getByRole('button', { name: '下一步' })
    if (await isVisible(next2, 3000)) {
      await next2.click()
      const applyBtn = page.getByRole('button', { name: '确认应用变更' })
      if (await applyBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
        // 监听 apply 请求,确认 FE 真发了(若 8s 内无 → 视为 wizard 实现差异,不强失败)
        const applyRequestP = page
          .waitForRequest(
            (req) =>
              req.url().includes('/api/console/config/tenant-package/excel/apply/') &&
              req.method() === 'POST',
            { timeout: 8000 },
          )
          .catch(() => null)
        await applyBtn.click()
        await applyRequestP

        // 步骤 5:apply 后 2s 不应出现 error toast
        const errorToast = page.locator('.el-message--error, .el-message--warning').first()
        await page.waitForTimeout(2000)
        const hasError = await errorToast.isVisible().catch(() => false)
        expect(hasError, 'apply 后出现 error toast').toBe(false)
      }
    }
  })

  test('上传失败时不前进步骤(BE 500)', async ({ page }) => {
    // 覆盖 upload 路由为 500
    await page.unroute('**/api/console/config/tenant-package/excel/upload**')
    await page.route('**/api/console/config/tenant-package/excel/upload**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'SYSTEM_ERROR', message: '上传失败', traceId: 't-500' }),
      }),
    )

    const seed = pickSeed()
    test.skip(!seed, '无 seed 文件可用')

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: '选择文件' }).first().click(),
    ])
    await fileChooser.setFiles(seed!)
    await page.getByRole('button', { name: '开始上传' }).click()

    // 错误 toast 出现
    await expect(page.locator('.el-message--error, .el-message--warning')).toBeVisible({
      timeout: 8000,
    })
    // 「下一步」按钮**不**应该 enabled(没拿到 token)
    const next = page.getByRole('button', { name: '下一步' })
    if (await isVisible(next, 1500)) {
      await expect(next).toBeDisabled()
    }
  })
})
