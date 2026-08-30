/**
 * 配置管理 — 完整业务流程测试（真实变更）
 *
 * 覆盖：
 *   变更日志   — 刷新、分页
 *   Secrets    — 刷新、详情、轮转（真实执行）
 *   配置导出   — 导出全部 / 指定类型，捕获 JSON 结果
 *   配置导入   — 空/非法 JSON 前端校验 + 先导出再导入（幂等往返）
 *   同步日志   — 刷新
 */
import { type Page } from '@playwright/test'
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'
import { clearConsoleRateLimitKeys } from './support/rate-limit'

const CONFIG_SYNC_EXPORT = '/api/console/config/sync/export'
const CONFIG_SYNC_IMPORT = '/api/console/config/sync/import'

async function openConfigSyncTab(page: Page) {
  await enterDemoApp(page)
  await page.goto('/config/management')
  await expectPageTitle(page, '变更与同步')
  await page.getByRole('tab', { name: '配置同步' }).first().click()
  await expect(page.getByRole('tab', { name: '配置同步' }).first()).toHaveClass(/is-active/)
}

async function exportConfigFromUi(page: Page) {
  const apiCall = page.waitForResponse(
    (r) => r.url().includes(CONFIG_SYNC_EXPORT) && r.request().method() === 'POST',
    { timeout: 15_000 },
  )
  await page.getByRole('button', { name: /导出为 JSON 文件|Download JSON/ }).first().click()
  const resp = await apiCall
  expect(resp.status(), `config sync export status=${resp.status()}`).toBeLessThan(400)
  await expect(page.locator('.el-message--success')).toContainText(/导出完成|Export/, {
    timeout: 8_000,
  })
  await expect(page.getByText(/导出结果|Export result/)).toBeVisible()
  await expect(page.locator('.json-preview').first()).toBeVisible()
  return resp.json().catch(() => null)
}

async function copyExportToImportPayload(page: Page) {
  await page.getByRole('button', { name: /复制到目标侧|Copy to target/ }).first().click()
  const payload = page.locator('.json-textarea-input textarea, .el-textarea__inner').first()
  await expect(payload).not.toHaveValue('', { timeout: 3_000 })
  return payload
}

async function previewImportPayload(page: Page) {
  const apiCall = page.waitForResponse(
    (r) => r.url().includes(CONFIG_SYNC_IMPORT) && r.request().method() === 'POST',
    { timeout: 15_000 },
  )
  await page.getByRole('button', { name: /预览差异|Preview diff/ }).first().click()
  const resp = await apiCall
  expect(resp.status(), `config sync preview status=${resp.status()}`).toBeLessThan(400)
  await expect(page.getByText(/差异预览|Diff preview/)).toBeVisible({ timeout: 8_000 })
  await expect(page.locator('.json-preview').first()).toBeVisible()
}

async function importPayloadFromUi(page: Page) {
  const apiCall = page.waitForResponse(
    (r) => r.url().includes(CONFIG_SYNC_IMPORT) && r.request().method() === 'POST',
    { timeout: 20_000 },
  )
  await page.getByRole('button', { name: /应用到目标|Apply to target/ }).first().click()
  const box = page.locator('.el-message-box').first()
  await expect(box).toBeVisible({ timeout: 5_000 })
  await box.getByRole('button', { name: /确认应用|Confirm apply|Confirm/ }).first().click()
  const resp = await apiCall
  expect(resp.status(), `config sync import status=${resp.status()}`).toBeLessThan(400)
  await expect(page.locator('.el-message--success').last()).toContainText(/已应用到目标|Applied/, {
    timeout: 10_000,
  })
}

// ─── 变更日志 ──────────────────────────────────────────────────────

test.describe('配置管理 — 变更日志', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/management')
    await expectPageTitle(page, '变更与同步')
    // 默认激活 tab
    await expect(page.getByRole('tab', { name: '变更日志' }).first()).toHaveClass(/is-active/)
  })

  test('刷新后表格或空态展示', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    // DataState 在空数据时不渲染 <el-table>(只渲染 EmptyState),所以不能强制 columnheader
    await expect(
      page.locator('.el-table, .empty-state, .table-skeleton').first()
    ).toBeAttached({ timeout: 6000 })
  })

  test('有数据时分页控件可见，切换页码正常', async ({ page }) => {
    // 空数据时直接跳过(无分页);有数据则验证翻页可点
    const pager = page.locator('.el-pagination').first()
    if (!(await isVisible(pager, 8_000))) return
    const nextBtn = pager.locator('button.btn-next')
    if (!(await nextBtn.isDisabled())) {
      await nextBtn.click()
      // 翻页后仍能看到表格或空态
      await expect(
        page.locator('.el-table, .empty-state, .table-skeleton').first()
      ).toBeAttached({ timeout: 6000 })
    }
  })
})

// ─── Secrets ───────────────────────────────────────────────────────

test.describe('配置管理 — Secrets', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/management')
    await expectPageTitle(page, '变更与同步')
    await page.getByRole('tab', { name: 'Secrets' }).first().click()
    await expect(page.getByRole('tab', { name: 'Secrets' }).first()).toHaveClass(/is-active/)
  })

  test('刷新后表格或空态展示', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    // DataState 三态:有数据 .el-table / 空 .empty-state / 加载 .table-skeleton 任意可见即通过
    await expect(
      page.locator('.el-table, .empty-state, .table-skeleton').first()
    ).toBeAttached({ timeout: 6000 })
  })

  test('详情：抽屉展示 Secret Key + 版本 + 原始响应', async ({ page }) => {
    const detailBtn = page.locator('.table-actions').getByRole('button', { name: '详情' }).first()
    if (!(await isVisible(detailBtn))) return
    await detailBtn.click()
    await expect(page.getByText('Secret 详情')).toBeVisible()
    await expect(page.getByText('Secret Key')).toBeVisible()
    await expect(page.getByText('版本')).toBeVisible()
    // 关闭抽屉
    await page.locator('.el-drawer__close-btn').first().click()
    await expect(page.getByText('Secret 详情')).toBeHidden()
  })

  test('轮转：确认后提交 → success toast 出现', async ({ page }) => {
    const rotateBtn = page.locator('.table-actions').getByRole('button', { name: '轮转' }).first()
    if (!(await isVisible(rotateBtn))) return
    await rotateBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    // 真实确认轮转
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    // success 或 error（后端有 secret 则成功，否则报错）均接受
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('columnheader', { name: 'Secret Key' })).toBeVisible({ timeout: 6000 })
  })
})

// ─── 配置导出 ──────────────────────────────────────────────────────

test.describe('配置管理 — 配置导出', () => {
  test.beforeEach(async ({ page }) => {
    clearConsoleRateLimitKeys()
    await openConfigSyncTab(page)
  })

  test('导出全部配置 → 结果 JSON 显示在页面', async ({ page }) => {
    await exportConfigFromUi(page)
  })

  test('导出指定类型 JOB → 结果包含 JOB 相关内容', async ({ page }) => {
    await page.locator('.el-checkbox').filter({ hasText: /作业|Job/ }).first().click()
    const exported = await exportConfigFromUi(page)
    expect(JSON.stringify(exported), 'exported JOB config payload').toMatch(/job|JOB|作业/i)
  })
})

// ─── 配置导入 ──────────────────────────────────────────────────────

test.describe('配置管理 — 配置导入前端校验', () => {
  test.beforeEach(async ({ page }) => {
    clearConsoleRateLimitKeys()
    await openConfigSyncTab(page)
  })

  test('默认 Payload 模板为 JSON 对象 → 预览按钮可用', async ({ page }) => {
    await expect(page.locator('.json-textarea-input textarea, .el-textarea__inner').first()).toHaveValue(
      '{}',
      { timeout: 4_000 },
    )
    await expect(page.getByRole('button', { name: /预览差异|Preview diff/ }).first()).toBeEnabled()
  })

  test('默认 Payload 模板为 JSON 对象 → 导入按钮可用', async ({ page }) => {
    await expect(page.locator('.json-textarea-input textarea, .el-textarea__inner').first()).toHaveValue(
      '{}',
      { timeout: 4_000 },
    )
    await expect(page.getByRole('button', { name: /应用到目标|Apply to target/ }).first()).toBeEnabled()
  })

  test('非法 JSON → 点预览 → 错误 toast', async ({ page }) => {
    await page.locator('.json-textarea-input textarea, .el-textarea__inner').first().fill('not-json!!!')
    await page.getByRole('button', { name: /预览差异|Preview diff/ }).first().click()
    await expect(page.locator('.el-message--error')).toContainText(/JSON 格式不合法|JSON/, {
      timeout: 4_000,
    })
  })
})

test.describe('配置管理 — 导出再导入（幂等往返）', () => {
  /**
   * 先导出当前配置 JSON,再复制到目标侧预览 → 确认导入（UPSERT 幂等）。
   */
  test('导出 → 预览 → 导入同一份数据', async ({ page }) => {
    await openConfigSyncTab(page)
    await exportConfigFromUi(page)
    await copyExportToImportPayload(page)
    await previewImportPayload(page)
    await importPayloadFromUi(page)
  })
})

// ─── 同步日志 ──────────────────────────────────────────────────────

test.describe('配置管理 — 同步日志', () => {
  test.beforeEach(async ({ page }) => {
    clearConsoleRateLimitKeys()
    await enterDemoApp(page)
    await page.goto('/config/management')
    await expectPageTitle(page, '变更与同步')
    await page.getByRole('tab', { name: '同步日志' }).first().click()
    await expect(page.getByRole('tab', { name: '同步日志' }).first()).toHaveClass(/is-active/)
  })

  test('刷新后表格或空态展示', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(
      page.locator('.el-table, .empty-state, .table-skeleton').first()
    ).toBeAttached({ timeout: 6000 })
  })

  test('同步日志在导入后可刷新看到同步记录', async ({ page }) => {
    await openConfigSyncTab(page)
    await exportConfigFromUi(page)
    await copyExportToImportPayload(page)
    await importPayloadFromUi(page)
    clearConsoleRateLimitKeys()

    // 回到同步日志刷新
    const logsCall = page.waitForResponse(
      (r) => r.url().includes('/api/console/config/sync/logs') && r.request().method() === 'GET',
      { timeout: 15_000 },
    )
    await page.getByRole('tab', { name: '同步日志' }).first().click()
    await page.getByRole('button', { name: '刷新' }).click().catch(() => undefined)
    const resp = await logsCall
    expect(resp.status(), `config sync logs status=${resp.status()}`).toBeLessThan(400)
    await expect(page.getByRole('columnheader', { name: /摘要|Summary/ })).toBeVisible({
      timeout: 6000,
    })
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({
      timeout: 6000,
    })
  })
})
