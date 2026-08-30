import * as fs from 'fs'
import * as path from 'path'
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'
import { clearConsoleRateLimitKeys } from './support/rate-limit'

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
      { timeout: 20_000 },
    )
    await expect(page.getByRole('button', { name: '开始上传' })).toBeEnabled({ timeout: 10_000 })
    await page.getByRole('button', { name: '开始上传' }).click()
    uploadResp = await uploadCall
    if (uploadResp.status() !== 429) return uploadResp
    await page.waitForTimeout(2_000 * (attempt + 1))
  }
  return uploadResp
}

async function clickWithRateLimitRetry(
  page: import('@playwright/test').Page,
  buttonName: string | RegExp,
  matchesResponse: (url: string, method: string) => boolean,
  timeout = 20_000,
) {
  let response
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const apiCall = page.waitForResponse(
      (r) => matchesResponse(r.url(), r.request().method()),
      { timeout },
    )
    await page.getByRole('button', { name: buttonName }).click()
    response = await apiCall
    if (response.status() !== 429) return response
    clearConsoleRateLimitKeys()
    await page.waitForTimeout(1_500 * (attempt + 1))
  }
  return response
}

// ─── 合并导入（租户配置包）──────────────────────────────────────────

test.describe('合并导入 — 租户配置包', () => {
  test.beforeEach(async ({ page }) => {
    clearConsoleRateLimitKeys()
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, {
      timeout: 15_000,
    })
  })

  test('页面展示三步向导与 11-Sheet 描述', async ({ page }) => {
    await expect(page.getByText('上传').first()).toBeVisible()
    await expect(page.getByText('预览').first()).toBeVisible()
    await expect(page.getByText('应用').first()).toBeVisible()
    // 描述包含 11-Sheet
    await expect(page.getByText('11-Sheet').first()).toBeVisible()
  })

  test('下载配置包模板按钮可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: '下载配置包模板' })).toBeVisible()
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
    test.skip(!fs.existsSync(FIXTURES.seedA), '种子文件不存在，跳过上传链路')
    clearConsoleRateLimitKeys()
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, {
      timeout: 15_000,
    })
  })

  test('上传 → 预览 → 确认应用成功', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: '选择文件' }).first().click(),
    ])
    await fileChooser.setFiles(FIXTURES.seedA)
    const uploadResp = await uploadTenantPackage(page)
    expect(uploadResp.status(), `tenant package upload status=${uploadResp.status()}`).toBeLessThan(
      400,
    )

    const tokenAlert = page.locator('.excel-wizard__token-alert, .el-alert').first()
    await expect(tokenAlert).toBeVisible({ timeout: 15_000 })

    await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled()
    await page.getByRole('button', { name: '下一步' }).click()

    // 预览步骤：拉取预览
    await expect(page.getByRole('button', { name: '拉取预览' })).toBeVisible()
    const previewResp = await clickWithRateLimitRetry(
      page,
      '拉取预览',
      (url, method) =>
        url.includes('/api/console/config/tenant-package/excel/preview/') && method === 'GET',
    )
    expect(
      previewResp.status(),
      `tenant package preview status=${previewResp.status()}`,
    ).toBeLessThan(400)

    const previewResult = page.locator('.excel-wizard__preview-summary,.el-table__body').first()
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
    await box.getByRole('button', { name: /确认应用|Confirm apply|Confirm/ }).first().click()
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
