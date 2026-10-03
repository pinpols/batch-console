/**
 * UI Flow 01: 触发 Job → 实例列表能看 — 真正点页面按钮
 *
 * 风格:浏览器 + page.goto + 表单填写 + 点 trigger 按钮 + 验 toast/对话框
 * 断言深度:每步硬断言「页面真到位(URL 未被守卫弹回)+ 数据视图真渲染」;
 * trigger 操作有按钮时验对话框打开(数据无关,避免 seed 波动 flaky)。
 */
import { test, expect } from '../support/app'
import { enterDemoApp, expectPageTitle, isVisible } from '../support/app'

const LIST_OR_EMPTY = 'tbody tr.el-table__row, .el-table__empty-block, .el-empty, .empty-state'
const MANUAL_TRIGGER_JOB = 'TA_EXPORT_REPORT'

test.describe('UI Flow 01: trigger → instance', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('1. /jobs/definitions 列表数据视图渲染', async ({ page }) => {
    await page.goto('/jobs/definitions')
    await expect(page).toHaveURL(/\/jobs\/definitions/)
    await expectPageTitle(page, /任务定义|作业定义/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  })

  test('2. 点 trigger 按钮(若存在)→ 确认对话框打开', async ({ page }) => {
    await page.goto('/jobs/definitions')
    await expect(page).toHaveURL(/\/jobs\/definitions/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
    const codeInput = page
      .locator('.el-form-item')
      .filter({ hasText: /Job Code|作业编码|编码/ })
      .locator('input')
      .first()
    if (await isVisible(codeInput, 3000)) {
      await codeInput.fill(MANUAL_TRIGGER_JOB)
      await page.getByRole('button', { name: /搜索|查询/ }).first().click().catch(() => undefined)
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => undefined)
    }
    const row = page.locator('tbody tr.el-table__row').filter({ hasText: MANUAL_TRIGGER_JOB }).first()
    await expect(row, `未找到稳定手动触发作业 ${MANUAL_TRIGGER_JOB}`).toBeVisible({ timeout: 8_000 })

    let triggerBtn = row.getByRole('button', { name: /手动触发|trigger/i }).first()
    if (!(await isVisible(triggerBtn, 2000))) {
      const more = row.getByRole('button', { name: /^更多/ }).first()
      if (await isVisible(more, 1500)) {
        await more.click()
        triggerBtn = page
          .locator('.el-dropdown-menu__item, [role="menuitem"]')
          .filter({ hasText: /手动触发|trigger/i })
          .first()
      }
    }
    await expect(triggerBtn, `${MANUAL_TRIGGER_JOB} 应提供手动触发入口`).toBeVisible({ timeout: 4_000 })
    await triggerBtn.click()
    // 触发应弹确认对话框/表单(验交互真生效,而非静默)
    const dlg = page.locator('.el-message-box, .el-dialog:visible').first()
    await expect(dlg).toBeVisible({ timeout: 3000 })
    const payload = dlg.locator('textarea').first()
    if (await isVisible(payload, 1500)) await payload.fill('{}')
    const cancel = dlg.getByRole('button', { name: /取消|关闭/ }).first()
    if (await isVisible(cancel, 1500)) await cancel.click()
  })

  test('3. /monitor/job-instances 实例数据视图渲染', async ({ page }) => {
    await page.goto('/monitor/job-instances')
    await expect(page).toHaveURL(/\/monitor\/job-instances/)
    await expectPageTitle(page, /作业|实例|运行/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  })
})
