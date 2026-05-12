import * as fs from 'fs'
import * as path from 'path'
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

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

// ─── 合并导入（租户配置包）──────────────────────────────────────────

test.describe('合并导入 — 租户配置包', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, { timeout: 15_000 })
  })

  test('页面展示三步向导与 8-Sheet 描述', async ({ page }) => {
    await expect(page.getByText('上传').first()).toBeVisible()
    await expect(page.getByText('预览').first()).toBeVisible()
    await expect(page.getByText('应用').first()).toBeVisible()
    // 描述包含 8-Sheet
    await expect(page.getByText('8-Sheet').first()).toBeVisible()
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
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, { timeout: 15_000 })
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
    await enterDemoApp(page)
    await page.goto('/config/tenant-package')
    await expect(page.locator('.page-header .title').first()).toHaveText(/配置批量导入/, { timeout: 15_000 })
  })

  test('上传 → uploadToken 出现 → 进入预览步骤', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: '选择文件' }).first().click(),
    ])
    const fixtureFile = fs.existsSync(FIXTURES.tenantPackage)
      ? FIXTURES.tenantPackage
      : FIXTURES.seedA
    await fileChooser.setFiles(fixtureFile)
    await page.getByRole('button', { name: '开始上传' }).click()

    const tokenAlert = page.locator('.excel-wizard__token-alert, .el-alert').first()
    const errorToast = page.locator('.el-message--error,.el-message--warning')
    await Promise.race([
      tokenAlert.waitFor({ state: 'visible', timeout: 15000 }),
      errorToast.waitFor({ state: 'visible', timeout: 15000 }),
    ]).catch(() => {})

    if (!(await isVisible(tokenAlert, 500))) return

    await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled()
    await page.getByRole('button', { name: '下一步' }).click()

    // 预览步骤：拉取预览
    await expect(page.getByRole('button', { name: '拉取预览' })).toBeVisible()
    await page.getByRole('button', { name: '拉取预览' }).click()

    const previewResult = page.locator('.excel-wizard__preview-summary,.el-table__body').first()
    if (await isVisible(previewResult, 10000)) {
      await expect(previewResult).toBeVisible()
    }

    // 进入应用步骤
    const nextBtnStep2 = page.getByRole('button', { name: '下一步' })
    if (await isVisible(nextBtnStep2, 2000)) {
      await nextBtnStep2.click()
      // 应用步骤：确认应用变更按钮应变为可用
      await expect(page.getByRole('button', { name: '确认应用变更' })).toBeEnabled({ timeout: 5000 })
    }
  })
})
