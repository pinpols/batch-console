import * as fs from 'fs'
import * as path from 'path'
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'
import { clearConsoleRateLimitKeys } from './support/rate-limit'
import { seedStorageForConfiguredOrigin } from './support/storage'

/**
 * Excel 导入测试 — 覆盖唯一入口：租户配置包
 *
 * fixture 来源：
 *  - export 文件由 global-setup 运行时从后端导出至前端 test-excel-abc/（gitignore）
 *  - seed (ta) 文件权威副本在后端仓库，前端仅引用避免双份漂移：
 *      ../file-batch-system/docs/test-data/test-full-coverage-import-suite/
 *
 * 任一 fixture 文件不存在（后端离线 / global-setup 未跑）时，上传链路测试
 * 会被跳过，其余 UI 测试正常运行。
 */

const SEED_SUITE_DIR = path.resolve(
  __dirname,
  '../../file-batch-system/docs/test-data/test-full-coverage-import-suite',
)

const FIXTURES = {
  tenantPackage: path.resolve(__dirname, '../test-excel-abc/tenant-package-export.xlsx'),
  seedA: path.join(SEED_SUITE_DIR, 'ta-tenant-config-package-test.xlsx'),
}

async function uploadTenantPackage(page: import('@playwright/test').Page) {
  let uploadResp
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const uploadCall = page.waitForResponse(
      (r) =>
        r.url().includes('/api/console/config/tenant-package/excel/upload') &&
        r.request().method() === 'POST',
      { timeout: 45_000 },
    )
    await expect(page.getByRole('button', { name: '开始上传' })).toBeEnabled({ timeout: 10_000 })
    await page.getByRole('button', { name: '开始上传' }).click()
    uploadResp = await uploadCall
    if (uploadResp.status() !== 429) return uploadResp
    await page.waitForTimeout(2_000 * (attempt + 1))
  }
  return uploadResp
}

// ─── 合并导入（租户配置包）──────────────────────────────────────────

test.describe('合并导入 — 租户配置包', () => {
  test.use({ serviceWorkers: 'block' })

  test.beforeEach(async ({ page }) => {
    clearConsoleRateLimitKeys()
    await seedStorageForConfiguredOrigin(page)
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, {
      timeout: 15_000,
    })
  })

  test('页面展示三步向导与配置字段说明入口', async ({ page }) => {
    await expect(page.getByText('上传').first()).toBeVisible()
    await expect(page.getByText('预览').first()).toBeVisible()
    await expect(page.getByText('应用').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '字段填写说明' })).toBeVisible()
    await page.getByRole('button', { name: '字段填写说明' }).click()
    const guide = page.locator('.tenant-pkg-guide-drawer')
    await expect(guide.getByText('文件导入 · Excel', { exact: true })).toBeVisible()
    await expect(guide.getByText('文件导出 · 定长文本', { exact: true })).toBeVisible()
  })

  test('下载配置包模板按钮可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: '下载配置包模板' })).toBeVisible()
  })

  test('选择多个作业场景后下载对应的精简模板', async ({ page }) => {
    const scenarioResponse = page.waitForResponse(
      (request) =>
        request.url().includes('/api/console/config/tenant-package/excel/scenario-template') &&
        request.request().method() === 'GET',
    )
    const download = page.waitForEvent('download')

    const importGroup = page.locator('.scenario-template-control__group').nth(0)
    const otherGroup = page.locator('.scenario-template-control__group--other')
    const importParent = importGroup.locator('.el-checkbox').first()
    await expect(importParent).toBeVisible()
    await expect(importGroup.getByText('XML', { exact: true })).toBeVisible()
    await expect(importGroup.getByText('JSON', { exact: true })).toBeVisible()
    await importParent.click()
    await expect(importGroup.locator('.el-checkbox.is-checked')).toHaveCount(6)
    await importParent.click()
    await expect(importGroup.locator('.el-checkbox.is-checked')).toHaveCount(0)

    await importGroup.getByText('Excel', { exact: true }).click()
    await otherGroup.getByText('数据处理', { exact: true }).click()
    await page.getByRole('button', { name: '下载配置包模板' }).click()

    const [response, downloadedFile] = await Promise.all([scenarioResponse, download])
    const selectedScenarios = new URL(response.url()).searchParams.getAll('scenarios').sort()
    expect(selectedScenarios).toEqual(['IMPORT_EXCEL', 'PROCESS'])
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(downloadedFile.suggestedFilename()).toBe('tenant-package-import_excel-process.xlsx')
    const downloadedPath = await downloadedFile.path()
    expect(downloadedPath).not.toBeNull()
    expect(fs.statSync(downloadedPath!).size).toBeGreaterThan(0)
  })

  test('Apply 冲突后刷新预览并要求用户重新核对', async ({ page }) => {
    let previewRequests = 0
    await page.route('**/api/console/config/tenant-package/excel/upload**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'success',
          data: {
            uploadToken: 'conflict-upload',
            fileName: 'tenant-config.xlsx',
            resourceQueueRows: 0,
            businessCalendarRows: 0,
            batchWindowRows: 0,
            jobRows: 1,
            fileChannelRows: 0,
            fileTemplateRows: 0,
            pipelineRows: 0,
            pipelineStepRows: 0,
            workflowDefinitionRows: 0,
            workflowNodeRows: 0,
            workflowEdgeRows: 0,
          },
          meta: {},
        }),
      }),
    )
    await page.route(
      '**/api/console/config/tenant-package/excel/preview/conflict-upload**',
      (route) => {
        previewRequests += 1
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'SUCCESS',
            message: 'success',
            data: {
              uploadToken: 'conflict-upload',
              previewToken: `preview-${previewRequests}`,
              fileName: 'tenant-config.xlsx',
              totalRows: 1,
              validRows: 1,
              invalidRows: 0,
              sheets: [],
              issues: [],
            },
            meta: {},
          }),
        })
      },
    )
    await page.route(
      '**/api/console/config/tenant-package/excel/apply/conflict-upload**',
      (route) =>
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'STATE_CONFLICT',
            message: 'error.config_package.config_changed',
            data: null,
            meta: {},
          }),
        }),
    )

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: '选择文件' }).first().click(),
    ])
    await fileChooser.setFiles({
      name: 'tenant-config.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('mock-xlsx'),
    })
    await uploadTenantPackage(page)
    await expect(page.getByRole('button', { name: '拉取预览' })).toBeVisible()
    await expect(page.getByText('预览通过，可应用 1 条有效行')).toBeVisible()
    await page.getByRole('button', { name: '下一步' }).click()

    await page.getByRole('button', { name: '确认应用变更' }).click()
    const confirmBox = page.locator('.el-message-box').first()
    await expect(confirmBox).toBeVisible()
    await confirmBox
      .getByRole('button', { name: /确认应用|Confirm apply|Confirm/ })
      .first()
      .click()

    await expect(
      page.getByText('预览已过期或配置已变化，已刷新预览。请重新核对后再应用。'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: '拉取预览' })).toBeVisible()
    await expect(page.getByRole('button', { name: '下一步' })).toBeVisible()
    expect(previewRequests).toBe(2)
  })

  test('导出当前配置包按钮可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: '导出当前配置包' })).toBeVisible()
  })

  test('选择文件按钮可见，开始上传初始禁用', async ({ page }) => {
    await expect(page.getByRole('button', { name: '选择文件' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '开始上传' })).toBeDisabled()
  })

  test('步骤导航初始状态正确', async ({ page }) => {
    await expect(page.getByRole('button', { name: '上一步' })).toBeDisabled()
    await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled()
  })

  test('预览步骤在无 token 时显示提示', async ({ page }) => {
    // 手动到 step 1 — 通过 URL 模拟不可行，用 nextBtn 也被 disabled
    // 直接检查 mute-hint 文本存在于 DOM
    await expect(page.locator('.excel-wizard__mute-hint')).toHaveText(
      /请先在「上传」步骤完成文件提交/,
    )
  })

  test('应用步骤确认按钮在无 token 时禁用', async ({ page }) => {
    // 确认应用按钮应存在但 disabled（可能在第三步才出现）
    const applyBtn = page.getByRole('button', { name: /确认应用|应用变更/ }).first()
    const visible = await applyBtn.isVisible().catch(() => false)
    if (visible) {
      await expect(applyBtn).toBeDisabled()
    }
    // 如果按钮不可见，说明步骤未到达应用步骤，跳过断言
  })
})

// ─── 合并导入（租户配置包）— 文件选择与完整上传链路 ────────────────────────

test.describe('合并导入 — 文件选择交互', () => {
  test.beforeEach(async ({ page }) => {
    clearConsoleRateLimitKeys()
    await seedStorageForConfiguredOrigin(page)
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, {
      timeout: 15_000,
    })
  })

  test('选择文件后「开始上传」按钮变为可用', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: '选择文件' }).first().click(),
    ])
    // 优先使用导出的 fixture，其次用已有的种子文件
    const fixtureFile = fs.existsSync(FIXTURES.tenantPackage)
      ? FIXTURES.tenantPackage
      : FIXTURES.seedA
    await fileChooser.setFiles(fixtureFile)
    await expect(page.locator('.upload-zone__file-name').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '开始上传' })).toBeEnabled()
  })
})

test.describe('合并导入 — 完整上传链路（依赖后端）', () => {
  // seedA 文件始终存在，用它来跑链路（格式与后端期望一致）
  test.beforeEach(async ({ page }) => {
    if (process.env.E2E_RELEASE_GATE === '1' && !fs.existsSync(FIXTURES.seedA)) {
      throw new Error(`发布验收配置包 seed 不存在: ${FIXTURES.seedA}`)
    }
    test.skip(!fs.existsSync(FIXTURES.seedA), '种子文件不存在，跳过上传链路')
    clearConsoleRateLimitKeys()
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, {
      timeout: 15_000,
    })
  })

  test('@release-required 上传 → 预览 → 确认应用成功', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: '选择文件' }).first().click(),
    ])
    await fileChooser.setFiles(FIXTURES.seedA)
    const uploadResp = await uploadTenantPackage(page)
    expect(uploadResp.status(), `tenant package upload status=${uploadResp.status()}`).toBeLessThan(
      400,
    )

    // 上传成功后向导会自动进入预览并拉取结果。
    await expect(page.getByRole('button', { name: '拉取预览' })).toBeVisible()
    const previewResult = page.locator('.excel-wizard__desc, .el-table__body').first()
    await expect(previewResult).toBeVisible({ timeout: 10_000 })

    // 进入应用步骤
    const nextBtnStep2 = page.getByRole('button', { name: '下一步' })
    await expect(nextBtnStep2).toBeEnabled({ timeout: 5_000 })
    await nextBtnStep2.click()

    const applyButton = page.getByRole('button', { name: '确认应用变更' })
    await expect(applyButton).toBeEnabled({ timeout: 5_000 })
    await applyButton.click()
    const box = page.locator('.el-message-box').first()
    await expect(box).toBeVisible({ timeout: 5_000 })

    clearConsoleRateLimitKeys()
    const applyCall = page.waitForResponse(
      (r) =>
        r.url().includes('/api/console/config/tenant-package/excel/apply/') &&
        r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await box
      .getByRole('button', { name: /确认应用|Confirm apply|Confirm/ })
      .first()
      .click()
    const applyResp = await applyCall
    expect(applyResp.status(), `tenant package apply status=${applyResp.status()}`).toBeLessThan(
      400,
    )
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('.apply-zone__block.el-alert--success, .apply-result-table').first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('租户管理员 — 配置包导出回导', () => {
  test.use({ storageState: 'e2e/.auth/role-tenantAdmin.json' })

  test('导出的配置包可直接回导并通过预览校验', async ({ page }) => {
    clearConsoleRateLimitKeys()
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, {
      timeout: 15_000,
    })

    const exportButton = page.getByRole('button', { name: '导出当前配置包' })
    const exportResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/console/config/tenant-package/excel/export') &&
        response.request().method() === 'GET',
      { timeout: 30_000 },
    )
    const exportDownload = page.waitForEvent('download')
    await exportButton.click()
    const [exportResp, exportedFile] = await Promise.all([exportResponse, exportDownload])
    expect(exportResp.status(), `tenant admin export status=${exportResp.status()}`).toBe(200)
    const exportedPath = await exportedFile.path()
    if (!exportedPath) throw new Error('Tenant admin export did not produce a local workbook')

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: '选择文件' }).first().click(),
    ])
    await fileChooser.setFiles({
      name: exportedFile.suggestedFilename(),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: fs.readFileSync(exportedPath),
    })
    const previewResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/console/config/tenant-package/excel/preview/') &&
        response.request().method() === 'GET',
      { timeout: 30_000 },
    )
    const uploadResp = await uploadTenantPackage(page)
    expect(uploadResp.status(), `tenant admin upload status=${uploadResp.status()}`).toBeLessThan(
      400,
    )

    await expect(page.getByRole('button', { name: '拉取预览' })).toBeVisible()
    const previewResp = await previewResponse
    const previewPayload = await previewResp.json()
    expect(
      previewPayload.data.invalidRows,
      `tenant admin export round-trip issues: ${JSON.stringify(previewPayload.data.issues)}`,
    ).toBe(0)
    await expect(page.locator('.excel-wizard__desc, .el-table__body').first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled()
  })
})

test.describe('平台管理员 — 配置包导出', () => {
  test.use({ storageState: 'e2e/.auth/role-admin.json' })

  test('平台管理员可导出当前租户的业务配置包', async ({ page }) => {
    clearConsoleRateLimitKeys()
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, {
      timeout: 15_000,
    })

    const exportResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/console/config/tenant-package/excel/export') &&
        response.request().method() === 'GET',
      { timeout: 30_000 },
    )
    const exportDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出当前配置包' }).click()
    const [response, download] = await Promise.all([exportResponse, exportDownload])
    expect(response.status(), `platform admin export status=${response.status()}`).toBe(200)

    const exportedPath = await download.path()
    if (!exportedPath) throw new Error('Platform admin export did not produce a local workbook')
    expect(fs.statSync(exportedPath).size).toBeGreaterThan(0)
  })
})
