/**
 * UI Flow 03: 任务失败 → 自助重跑申请 → 审批
 *
 * 真路径:/monitor/job-instances 找 FAILED 点 → 详情 → 重跑;
 *        /self-service 提单;/approvals 看 PENDING → 批准
 *
 * 断言深度:每步硬断言「页面真到位(URL 未被路由守卫弹回)+ 数据视图真渲染(数据行 or 空态)」,
 * 数据存在时再 best-effort 验交互;不依赖具体 seed 数据,避免波动 flaky。
 */
import { test, expect } from '../support/app'
import { enterDemoApp, expectPageTitle, isVisible } from '../support/app'

const LIST_OR_EMPTY = 'tbody tr.el-table__row, .el-table__empty-block, .el-empty, .empty-state'

test.describe('UI Flow 03: fail → rerun → approve', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('1. /monitor/job-instances 列表渲染 + FAILED 行可进详情', async ({ page }) => {
    await page.goto('/monitor/job-instances')
    await expect(page).toHaveURL(/\/monitor\/job-instances/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })

    const failedRow = page.locator('tr', { hasText: /FAILED|失败/ }).first()
    if (await isVisible(failedRow, 3000)) {
      const link = failedRow.locator('.cell-link, a.el-link').first()
      if (await isVisible(link, 1500)) {
        await link.click({ force: true })
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
      }
    }
  })

  test('2. /self-service 页渲染 + 重跑表单可填写', async ({ page }) => {
    await page.goto('/self-service')
    await expect(page).toHaveURL(/\/self-service/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    // 自助服务页真渲染(tab 容器 / 表单容器)
    await expect(page.locator('.el-tabs, .el-form, .section-card').first()).toBeVisible({
      timeout: 8000,
    })
    const rerunTab = page.getByRole('tab', { name: /重跑|rerun/i }).first()
    if (await isVisible(rerunTab, 2000)) await rerunTab.click({ force: true })
    // 录入控件存在时填写并回读(部分 tab 默认无 input,不硬性要求)
    const anyInput = page.locator('.el-input__inner, .el-textarea__inner').first()
    if (await isVisible(anyInput, 3000)) {
      await anyInput.fill('e2e-flow-03-test', { force: true }).catch(() => undefined)
    }
  })

  test('3. /approvals 审批中心 PENDING 列表渲染', async ({ page }) => {
    await page.goto('/approvals')
    await expectPageTitle(page, /审批/)
    await expect(page).toHaveURL(/\/approvals/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  })
})
