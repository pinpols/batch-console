/**
 * 调度与治理 — 完整业务流程测试（真实变更）
 * 覆盖：调度快照全局暂停/恢复、批次日期筛选、Catch-up 审批筛选、
 *       队列/窗口/日历 Tab + 启用切换 + 节假日抽屉、Trigger 注册/注销/暂停/恢复、
 *       租户配额筛选与启用切换
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

// ─── 调度快照 ─────────────────────────────────────────────────────

test.describe('调度快照 — 全局暂停 / 恢复', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/scheduler/snapshot')
    await expectPageTitle(page, '调度快照')
  })

  test('刷新按钮重新加载', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).first().click({ timeout: 8000 })
    // 页面骨架(任何一个 SectionCard / panel / table / empty 都行)
    await expect(
      page.locator('.section-card, .el-card, .el-table, .el-empty').first(),
    ).toBeAttached({ timeout: 12_000 })
  })

  test('Tab 切换：策略 / 队列 / Workers / 历史', async ({ page }) => {
    for (const tabPattern of [/队列/, /Workers/, /历史/]) {
      const tab = page.getByRole('tab', { name: tabPattern })
      if (await isVisible(tab, 2000)) {
        await tab.click()
        await expect(tab).toHaveClass(/active/)
      }
    }
  })

  test('全局暂停 → 确认 → toast', async ({ page }) => {
    const pauseBtn = page.getByRole('button', { name: '全局暂停' })
    if (!(await isVisible(pauseBtn))) return
    await pauseBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('暂停')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('全局恢复 → 确认 → toast', async ({ page }) => {
    const resumeBtn = page.getByRole('button', { name: '全局恢复' })
    if (!(await isVisible(resumeBtn))) return
    await resumeBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('恢复')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})

// ─── 批次日历日 ───────────────────────────────────────────────────

test.describe('批次日历日 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/scheduler/batch-days')
    await expectPageTitle(page, '批次日与窗口')
  })

  test('日历选择后查询', async ({ page }) => {
    const calSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '日历' })
      .locator('.el-select')
    await calSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('起始日 / 结束日可填写', async ({ page }) => {
    const startInput = page
      .locator('.el-form-item')
      .filter({ hasText: '起始日' })
      .getByRole('textbox')
    const endInput = page
      .locator('.el-form-item')
      .filter({ hasText: '结束日' })
      .getByRole('textbox')
    if (await isVisible(startInput, 2000)) {
      await startInput.fill('2026-04-01')
      await endInput.fill('2026-04-30')
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('刷新', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})

// ─── Catch-up 审批 ────────────────────────────────────────────────

test.describe('Catch-up 审批 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    // /scheduler/catch-up-approvals 已 redirect 到 /approvals?tab=catch-up
    // 页头是"审批中心",Catch-up 是 tab 名
    await page.goto('/scheduler/catch-up-approvals')
    await expectPageTitle(page, '审批中心')
    await expect(page).toHaveURL(/\/approvals\?tab=catch-up/)
  })

  test('关键字搜索 → 查询 → 重置', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: '关键字' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    await page.getByRole('button', { name: '重置' }).click()
    await expect(input).toHaveValue('')
  })

  test('状态筛选 → 查询', async ({ page }) => {
    const statusSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '状态' })
      .locator('.el-select')
    if (!(await isVisible(statusSelect, 2000))) return
    await statusSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('业务日筛选', async ({ page }) => {
    const bizInput = page
      .locator('.el-form-item')
      .filter({ hasText: '业务日' })
      .getByRole('textbox')
    if (!(await isVisible(bizInput, 2000))) return
    await bizInput.fill('2026-04-01')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})

// ─── 队列 / 窗口 / 日历 ───────────────────────────────────────────

test.describe('队列 / 窗口 / 日历 — Tab 与操作', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/queues')
    await expectPageTitle(page, /队列/)
  })

  test('三个 Tab 可切换', async ({ page }) => {
    for (const tabName of ['队列', '批次窗口', '日历']) {
      const tab = page.getByRole('tab', { name: tabName })
      if (await isVisible(tab, 2000)) {
        await tab.click()
        await expect(tab).toHaveClass(/is-active/)
      }
    }
  })

  test('刷新', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('关键字筛选 → 查询', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: '关键字' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('启用 / 停用切换 → 确认 → toast', async ({ page }) => {
    const toggle = page.locator('.el-switch').first()
    if (!(await isVisible(toggle))) return
    await toggle.click()
    await expect(page.locator('.el-message-box')).toBeVisible({ timeout: 5000 })
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('查看节假日 → 抽屉打开 → 关闭', async ({ page }) => {
    // 切到日历 tab
    const calTab = page.getByRole('tab', { name: '日历' })
    if (await isVisible(calTab, 2000)) await calTab.click()
    const holidayBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '查看节假日' })
      .first()
    if (!(await isVisible(holidayBtn))) return
    await holidayBtn.click()
    await expect(page.locator('.el-drawer')).toBeVisible()
    await page.locator('.el-drawer__close-btn').first().click()
    await expect(page.locator('.el-drawer')).toBeHidden()
  })
})

// ─── 租户配额 ────────────────────────────────────────────────────

test.describe('租户配额 — 筛选与启用切换', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/quota')
    await expectPageTitle(page, /配额/)
  })

  test('关键字筛选 → 查询', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: '关键字' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('quota')
    await page.getByRole('button', { name: '搜索' }).first().click()
    await expect(page.locator('.el-table, .el-card').first()).toBeAttached({ timeout: 10_000 })
  })

  test('启用状态筛选 → 查询', async ({ page }) => {
    const enabledSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '启用状态' })
      .locator('.el-select')
    if (!(await isVisible(enabledSelect, 2000))) return
    await enabledSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).first().click()
      await expect(page.locator('.el-table, .el-card').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('启用 / 停用切换 → 确认 → toast', async ({ page }) => {
    const toggle = page.locator('.el-switch').first()
    if (!(await isVisible(toggle))) return
    await toggle.click()
    await expect(page.locator('.el-message-box')).toBeVisible({ timeout: 5000 })
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})

// ─── Trigger 管理 ─────────────────────────────────────────────────

test.describe('Trigger 管理 — 注册 / 注销 / 暂停 / 恢复', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/triggers')
    await expectPageTitle(page, '触发器')
  })

  test('刷新', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('注册 → 确认 → toast', async ({ page }) => {
    const registerBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '注册' })
      .first()
    if (!(await isVisible(registerBtn))) return
    await registerBtn.click()
    await expect(page.locator('.el-message-box')).toContainText('注册')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('注销 → 确认 → toast', async ({ page }) => {
    const unregisterBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '注销' })
      .first()
    if (!(await isVisible(unregisterBtn))) return
    await unregisterBtn.click()
    await expect(page.locator('.el-message-box')).toContainText('注销')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('暂停 → 确认 → toast', async ({ page }) => {
    const pauseBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '暂停' })
      .first()
    if (!(await isVisible(pauseBtn))) return
    await pauseBtn.click()
    await expect(page.locator('.el-message-box')).toContainText('暂停')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('恢复 → 确认 → toast', async ({ page }) => {
    const resumeBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '恢复' })
      .first()
    if (!(await isVisible(resumeBtn))) return
    await resumeBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})
