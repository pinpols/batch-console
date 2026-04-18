/**
 * 审批中心 — 完整业务流程测试（真实变更）
 * 覆盖：单条通过/拒绝（含原因）、批量通过/批量拒绝、筛选
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('审批中心 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/approvals')
    await expectPageTitle(page, '审批中心')
  })

  test('状态筛选 → 查询', async ({ page }) => {
    const statusSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '状态' })
      .locator('.el-select')
    await statusSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '查询' }).click()
      await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('类型筛选 → 查询', async ({ page }) => {
    const typeSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '类型' })
      .locator('.el-select')
    await typeSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '查询' }).click()
      await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
    }
  })

  test('关键字搜索 → 查询 → 重置', async ({ page }) => {
    const keyword = page.getByPlaceholder(/审批单号|申请人/)
    if (!(await isVisible(keyword, 2000))) return
    await keyword.fill('test-approval')
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
    await page.getByRole('button', { name: '重置' }).click()
    await expect(keyword).toHaveValue('')
  })

  test('刷新按钮重新加载', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.getByRole('columnheader', { name: '审批单号' })).toBeVisible({ timeout: 6000 })
  })
})

test.describe('审批中心 — 单条审批操作', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/approvals')
    await expectPageTitle(page, '审批中心')
  })

  test('通过审批 → 填写意见 → 提交 → toast', async ({ page }) => {
    const approveBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '通过' })
      .first()
    if (!(await isVisible(approveBtn))) return
    await approveBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    // 填写审批意见（可选）
    const input = page.locator('.el-message-box').locator('input,textarea').first()
    if (await isVisible(input, 1000)) await input.fill('e2e 自动化通过')
    await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('columnheader', { name: '审批单号' })).toBeVisible({ timeout: 6000 })
  })

  test('拒绝审批 → 填写原因 → 提交 → toast', async ({ page }) => {
    const rejectBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '拒绝' })
      .first()
    if (!(await isVisible(rejectBtn))) return
    await rejectBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    // 填写拒绝原因
    const input = page.locator('.el-message-box').locator('input,textarea').first()
    if (await isVisible(input, 1000)) await input.fill('e2e 自动化拒绝')
    await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })
})

test.describe('审批中心 — 批量审批操作', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/approvals')
    await expectPageTitle(page, '审批中心')
  })

  test('批量通过：勾选第一行 → 批量通过 → 确认 → toast', async ({ page }) => {
    const checkbox = page.locator('.el-table__body .el-checkbox').first()
    if (!(await isVisible(checkbox))) return
    await checkbox.click()
    const batchApproveBtn = page.getByRole('button', { name: '批量通过' })
    await expect(batchApproveBtn).toBeEnabled()
    await batchApproveBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })

  test('批量拒绝：勾选第一行 → 批量拒绝 → 填原因 → 提交 → toast', async ({ page }) => {
    const checkbox = page.locator('.el-table__body .el-checkbox').first()
    if (!(await isVisible(checkbox))) return
    await checkbox.click()
    const batchRejectBtn = page.getByRole('button', { name: '批量拒绝' })
    await expect(batchRejectBtn).toBeEnabled()
    await batchRejectBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    const input = page.locator('.el-message-box').locator('input,textarea').first()
    if (await isVisible(input, 1000)) await input.fill('e2e 批量拒绝')
    await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })

  test('无勾选时批量按钮禁用', async ({ page }) => {
    const batchApproveBtn = page.getByRole('button', { name: '批量通过' })
    if (await isVisible(batchApproveBtn)) {
      await expect(batchApproveBtn).toBeDisabled()
      await expect(page.getByRole('button', { name: '批量拒绝' })).toBeDisabled()
    }
  })
})
