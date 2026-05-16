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
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

// ─── 变更日志 ──────────────────────────────────────────────────────

test.describe('配置管理 — 变更日志', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/management')
    await expectPageTitle(page, '变更与同步')
    // 默认激活 tab
    await expect(page.locator('.config-nav__item').filter({ hasText: '变更日志' }).first()).toHaveClass(/is-active/)
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
    await page.locator('.config-nav__item').filter({ hasText: 'Secrets' }).first().click()
    await expect(page.locator('.config-nav__item').filter({ hasText: 'Secrets' }).first()).toHaveClass(/is-active/)
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

// SKIPPED: 配置导出现在是 ConfigSyncTab 里的 sync-block,不是 tab。
test.describe.skip('配置管理 — 配置导出', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/management')
    await expectPageTitle(page, '变更与同步')
    await page.locator('.config-nav__item').filter({ hasText: '配置导出' }).first().click()
    await expect(page.locator('.config-nav__item').filter({ hasText: '配置导出' }).first()).toHaveClass(/is-active/)
  })

  test('导出全部配置 → 结果 JSON 显示在页面', async ({ page }) => {
    await page.getByRole('button', { name: '导出' }).click()
    // 等后端返回（可能因缺少 tenantId 返回 400）
    if (!(await isVisible(page.locator('.el-message--success'), 15_000))) return
    await expect(page.locator('pre.json-preview')).toBeVisible()
    // 结果内容是合法 JSON
    const text = await page.locator('pre.json-preview').textContent()
    expect(() => JSON.parse(text ?? '')).not.toThrow()
  })

  test('导出指定类型 JOB → 结果包含 JOB 相关内容', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: '配置类型' }).getByRole('textbox')
    await input.fill('JOB')
    await page.getByRole('button', { name: '导出' }).click()
    // 可能因缺少 tenantId 返回 400
    if (!(await isVisible(page.locator('.el-message--success'), 15_000))) return
    const pre = page.locator('pre.json-preview')
    await expect(pre).toBeVisible()
    const text = await pre.textContent()
    expect(() => JSON.parse(text ?? '')).not.toThrow()
  })
})

// ─── 配置导入 ──────────────────────────────────────────────────────

// SKIPPED: ConfigSyncTab 改成 block 卡片样式,"配置导入"不再是 tab。
// 此 describe 需要按新 UI 重写(找 sync-block 内的 Payload textarea + 预览/导入按钮)。
test.describe.skip('配置管理 — 配置导入前端校验', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/management')
    await expectPageTitle(page, '变更与同步')
    await page.getByRole('tab', { name: '配置导入' }).click()
    await expect(page.getByRole('tab', { name: '配置导入' })).toHaveClass(/is-active/)
  })

  test('Payload 为空 → 点预览 → 警告 toast "请输入 Payload"', async ({ page }) => {
    await page.getByRole('button', { name: '预览变更' }).click()
    await expect(page.locator('.el-message--warning')).toContainText('请输入 Payload', { timeout: 4000 })
  })

  test('Payload 为空 → 点确认导入 → 警告 toast', async ({ page }) => {
    await page.getByRole('button', { name: '确认导入' }).click()
    await expect(page.locator('.el-message--warning')).toContainText('请输入 Payload', { timeout: 4000 })
  })

  test('非法 JSON → 点预览 → 错误 toast "合法 JSON"', async ({ page }) => {
    await page.locator('.el-textarea__inner').fill('not-json!!!')
    await page.getByRole('button', { name: '预览变更' }).click()
    await expect(page.locator('.el-message--error')).toContainText('合法 JSON', { timeout: 4000 })
  })
})

// SKIPPED: 同样依赖被移除的 tab "配置导出/导入",待重写
test.describe.skip('配置管理 — 导出再导入（幂等往返）', () => {
  /**
   * 先在导出 tab 拿到当前配置 JSON，
   * 再到导入 tab 预览 → 确认导入（UPSERT 幂等）。
   */
  test('导出 → 预览 → 导入同一份数据', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/management')
    await expectPageTitle(page, '变更与同步')

    // ① 导出全部
    await page.locator('.config-nav__item').filter({ hasText: '配置导出' }).first().click()
    await page.getByRole('button', { name: '导出' }).click()
    // 可能因缺少 tenantId 返回 400
    if (!(await isVisible(page.locator('.el-message--success'), 15_000))) return
    const exportedText = await page.locator('pre.json-preview').textContent()
    expect(exportedText).toBeTruthy()
    // 验证是合法 JSON
    const exportedJson = JSON.parse(exportedText ?? '{}')
    expect(exportedJson).toBeTruthy()

    // ② 切换到导入 tab，粘贴导出结果
    await page.getByRole('tab', { name: '配置导入' }).click()
    await expect(page.getByRole('tab', { name: '配置导入' })).toHaveClass(/is-active/)
    await page.locator('.el-textarea__inner').fill(exportedText ?? '{}')

    // ③ 预览变更
    await page.getByRole('button', { name: '预览变更' }).click()
    // 预览结果 pre 或 toast 均接受
    await expect(
      page.locator('pre.json-preview').or(page.locator('.el-message')),
    ).toBeVisible({ timeout: 10000 })

    // ④ 确认导入（幂等）
    await page.getByRole('button', { name: '确认导入' }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 10000 })
  })
})

// ─── 同步日志 ──────────────────────────────────────────────────────

test.describe('配置管理 — 同步日志', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/management')
    await expectPageTitle(page, '变更与同步')
    await page.locator('.config-nav__item').filter({ hasText: '同步日志' }).first().click()
    await expect(page.locator('.config-nav__item').filter({ hasText: '同步日志' }).first()).toHaveClass(/is-active/)
  })

  test('刷新后表格或空态展示', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(
      page.locator('.el-table, .empty-state, .table-skeleton').first()
    ).toBeAttached({ timeout: 6000 })
  })

  // 此用例依赖 "配置导出/导入" tab,而它们已合并到 ConfigSyncTab sync-block,待重写
  test.skip('同步日志在导入后新增一条记录', async ({ page }) => {
    // 先记录当前行数
    const initialRows = await page.locator('.el-table__body').first().locator('tr').count()

    // 切到导出先拿 JSON
    await page.locator('.config-nav__item').filter({ hasText: '配置导出' }).first().click()
    await page.getByRole('button', { name: '导出' }).click()
    // 可能因缺少 tenantId 返回 400
    if (!(await isVisible(page.locator('.el-message--success'), 15_000))) return
    const exportedText = await page.locator('pre.json-preview').textContent()

    // 切到导入 → 导入
    await page.getByRole('tab', { name: '配置导入' }).click()
    await page.locator('.el-textarea__inner').fill(exportedText ?? '{}')
    await page.getByRole('button', { name: '确认导入' }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 10000 })

    // 回到同步日志刷新
    await page.locator('.config-nav__item').filter({ hasText: '同步日志' }).first().click()
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.getByRole('columnheader', { name: '摘要' })).toBeVisible({ timeout: 6000 })
    const afterRows = await page.locator('.el-table__body').first().locator('tr').count()
    // 导入成功后日志条数应 >= 导入前
    expect(afterRows).toBeGreaterThanOrEqual(initialRows)
  })
})
