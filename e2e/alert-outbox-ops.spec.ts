/**
 * 告警 + Outbox — 完整业务流程测试（真实变更）
 * 覆盖：告警筛选、确认/静默/关闭操作、Outbox Tab 切换与筛选
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

// ─── 告警 ─────────────────────────────────────────────────────────

test.describe('告警 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/alerts')
    await expectPageTitle(page, /事件告警|告警/)
  })

  test('级别筛选(al-sel 下拉,选后自动查询)', async ({ page }) => {
    // 新 UI:级别下拉是 tab 行右侧第一个 .al-sel(MetaSelect),@change 自动触发搜索
    const levelSelect = page.locator('.al-sel').first()
    await levelSelect.click()
    const opt = page.locator('.el-select-dropdown__item:visible').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await expect(page.locator('.al-list').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('分组 tab 筛选(未处理/已确认/全部)', async ({ page }) => {
    // 新 UI:状态下拉裁撤,改为分组 pill tab(.al-tab)
    const ackedTab = page.locator('.al-tab').filter({ hasText: '已确认' })
    await ackedTab.click()
    await expect(ackedTab).toHaveClass(/is-active/)
    await expect(page.locator('.al-list').first()).toBeAttached({ timeout: 10_000 })
    const allTab = page.locator('.al-tab').filter({ hasText: '全部' })
    await allTab.click()
    await expect(allTab).toHaveClass(/is-active/)
  })

  test('Trace 输入 → 带条件刷新 → 重置', async ({ page }) => {
    // 新 UI:TraceIdInput 的 Enter 是「跳 Trace 诊断页」(组件内 @keydown.enter=onGo),
    // 列表内按 traceId 过滤的载体 = 填入后点「刷新」重查(load 带 filters.traceId)
    const input = page.locator('.al-trace input').first()
    if (!(await isVisible(input, 2000))) return
    await input.fill('trace-test')
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.al-list').first()).toBeAttached({ timeout: 10_000 })
    await page.getByRole('button', { name: '重置' }).click()
    await expect(input).toHaveValue('')
  })

  test('刷新', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.al-list').first()).toBeAttached({ timeout: 10_000 })
  })
})

test.describe('告警 — 操作流', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/alerts')
    await expectPageTitle(page, /事件告警|告警/)
  })

  // FE 走两步对话框:① confirmDanger 危险确认(无 input) ② optionalReason prompt(带 input)
  // 区分:① 的 confirmButton 是"确认告警/静默/关闭",② 的 confirmButton 是"确定"且有 input
  async function clickThroughTwoDialogs(page: import('@playwright/test').Page, reason: string) {
    // ─── 第 1 步:confirmDanger ─────────
    const box1 = page.locator('.el-message-box').first()
    await expect(box1).toBeVisible({ timeout: 3000 })
    // 等"确认 verb"按钮(不带 reason input 的 confirm 对话框)
    await box1.getByRole('button', { name: /^(确认告警|确认静默|确认关闭)$/ }).click({ timeout: 5000 })

    // ─── 第 2 步:optionalReason prompt(以 input 出现为信号)
    // FE optionalReason 用 ElMessageBox.prompt,confirmButton 文字是 i18n "提交" 不是默认"确定"
    await page.waitForTimeout(400)
    const prompt = page.locator('.el-message-box').filter({ has: page.locator('input,textarea') })
    if (await isVisible(prompt.first(), 3000)) {
      await prompt.first().locator('input,textarea').first().fill(reason)
      // 接受多种 confirm 文字:提交 / 确定 / 确认
      await prompt
        .first()
        .getByRole('button', { name: /^(提交|确定|确认)$/ })
        .click({ timeout: 5000 })
    }
  }

  // 验"toast 出"由"BE 收到 API 请求"代替 — toast 3s 自动消失,spec 等 8s race condition
  async function clickAndWaitApi(
    page: import('@playwright/test').Page,
    btn: import('@playwright/test').Locator,
    apiPathRe: RegExp,
    reason: string,
  ) {
    const respP = page
      .waitForResponse((r) => apiPathRe.test(r.url()), { timeout: 12000 })
      .catch(() => null)
    await btn.click()
    await clickThroughTwoDialogs(page, reason)
    const resp = await respP
    expect(resp, `BE 未收到 ${apiPathRe} 请求`).not.toBeNull()
  }

  // 新 UI:行操作从表格 .table-actions 迁到卡片 .al-card__ops 内的 .al-op 按钮
  test('确认告警 → 填写说明 → 提交 → toast', async ({ page }) => {
    const confirmBtn = page.locator('.al-card__ops .al-op--ack').first()
    if (!(await isVisible(confirmBtn))) return
    await clickAndWaitApi(page, confirmBtn, /\/alerts\/[^/]+\/ack/, 'e2e 自动化确认')
  })

  test('静默告警 → 填写说明 → 提交 → toast', async ({ page }) => {
    const silenceBtn = page
      .locator('.al-card__ops')
      .getByRole('button', { name: '静默 24h' })
      .first()
    if (!(await isVisible(silenceBtn))) return
    await clickAndWaitApi(page, silenceBtn, /\/alerts\/[^/]+\/silence/, 'e2e 自动化静默')
  })

  test('关闭告警 → 填写说明 → 提交 → toast', async ({ page }) => {
    const closeBtn = page.locator('.al-card__ops').getByRole('button', { name: '关闭' }).first()
    if (!(await isVisible(closeBtn))) return
    await clickAndWaitApi(page, closeBtn, /\/alerts\/[^/]+\/close/, 'e2e 自动化关闭')
  })
})

// ─── Outbox ───────────────────────────────────────────────────────

test.describe('Outbox — Tab 与筛选', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/outbox')
    await expectPageTitle(page, 'Outbox')
  })

  // 新 UI:el-tabs 换自绘 pill tab(.ob-tab 按钮),按可见文本定位
  test('重试 tab 默认激活', async ({ page }) => {
    await expect(page.locator('.ob-tab').filter({ hasText: '重试' })).toHaveClass(/is-active/)
  })

  test('切换到投递 tab', async ({ page }) => {
    const deliveryTab = page.locator('.ob-tab').filter({ hasText: '投递' })
    await deliveryTab.click()
    await expect(deliveryTab).toHaveClass(/is-active/)
  })

  test('重试 tab — 关键字搜索', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: '关键字' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('重试 tab — 状态筛选', async ({ page }) => {
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

  test('投递 tab — 关键字搜索', async ({ page }) => {
    await page.locator('.ob-tab').filter({ hasText: '投递' }).click()
    const input = page.locator('.el-form-item').filter({ hasText: '关键字' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('刷新', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})
