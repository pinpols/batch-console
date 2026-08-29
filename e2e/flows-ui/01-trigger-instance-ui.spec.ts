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
const WRITE_RESPONSE_TIMEOUT_MS = 45_000

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
    const triggerBtn = page
      .locator('.table-actions, td')
      .getByRole('button', { name: /触发|trigger/i })
      .first()
    if (!(await isVisible(triggerBtn, 2000))) {
      test.skip(true, '无 trigger 按钮(空列表 / RBAC)')
      return
    }
    await triggerBtn.click({ force: true })
    // 触发应弹确认对话框/表单(验交互真生效,而非静默)
    const dlg = page.locator('.el-message-box, .el-dialog:visible').first()
    await expect(dlg).toBeVisible({ timeout: 3000 })
    const ok = dlg.getByRole('button', { name: /确定|确认|触发/ }).first()
    if (await isVisible(ok, 1500)) {
      const triggerResponse = page.waitForResponse(
        (res) =>
          res.request().method() === 'POST' &&
          res.url().includes('/api/console/jobs/trigger'),
        { timeout: WRITE_RESPONSE_TIMEOUT_MS },
      )
      await ok.click({ force: true })
      expect((await triggerResponse).status()).toBeLessThan(400)
    }
    await page.waitForTimeout(600)
  })

  test('3. /monitor/job-instances 实例数据视图渲染', async ({ page }) => {
    await page.goto('/monitor/job-instances')
    await expect(page).toHaveURL(/\/monitor\/job-instances/)
    await expectPageTitle(page, /作业|实例|运行/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  })
})
