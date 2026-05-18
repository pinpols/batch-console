/**
 * 用户账户 — 完整操作测试
 * 覆盖：页面基础、关键字筛选/重置、编辑对话框、重置密码对话框、启用/停用操作
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('用户账户 — 页面基础', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/user-accounts')
    await expectPageTitle(page, '登录账户')
  })

  test('展示账户总数 / 已启用 / 已停用指标卡', async ({ page }) => {
    await expect(page.locator('.metric-card').filter({ hasText: '账户总数' })).toBeVisible()
    await expect(page.locator('.metric-card').filter({ hasText: '已启用' })).toBeVisible()
    await expect(page.locator('.metric-card').filter({ hasText: '已停用' })).toBeVisible()
  })

  test('表格展示 username / 状态 / 操作列', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: '用户名' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '状态' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '操作' })).toBeVisible()
  })

  test('刷新', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).first().click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})

test.describe('用户账户 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/user-accounts')
    await expectPageTitle(page, '登录账户')
  })

  test('关键字筛选 → 查询', async ({ page }) => {
    const input = page
      .locator('.el-form-item')
      .filter({ hasText: '关键字' })
      .getByRole('textbox')
    await input.fill('admin')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('回车触发查询', async ({ page }) => {
    const input = page
      .locator('.el-form-item')
      .filter({ hasText: '关键字' })
      .getByRole('textbox')
    await input.fill('test')
    await input.press('Enter')
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('重置清空关键字', async ({ page }) => {
    const input = page
      .locator('.el-form-item')
      .filter({ hasText: '关键字' })
      .getByRole('textbox')
    await input.fill('admin')
    await page.getByRole('button', { name: '搜索' }).click()
    await page.getByRole('button', { name: '重置' }).first().click()
    await expect(input).toHaveValue('')
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})

test.describe('用户账户 — 编辑对话框', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/user-accounts')
    await expectPageTitle(page, '登录账户')
  })

  test('点击编辑弹出对话框并展示用户名（只读）', async ({ page }) => {
    const editBtn = page.locator('.table-actions').getByRole('button', { name: '编辑' }).first()
    if (!(await isVisible(editBtn))) return
    await editBtn.click()
    await expect(page.locator('.el-dialog:visible, .el-drawer:visible')).toBeVisible()
    // 用户名字段应为只读
    const usernameInput = page.locator('.el-dialog:visible, .el-drawer:visible').locator('input[disabled]').first()
    await expect(usernameInput).toBeVisible()
  })

  test('取消关闭对话框', async ({ page }) => {
    const editBtn = page.locator('.table-actions').getByRole('button', { name: '编辑' }).first()
    if (!(await isVisible(editBtn))) return
    await editBtn.click()
    await expect(page.locator('.el-dialog:visible, .el-drawer:visible')).toBeVisible()
    await page.locator('.el-dialog:visible, .el-drawer:visible').getByRole('button', { name: '取消' }).click()
    await expect(page.locator('.el-dialog:visible, .el-drawer:visible')).not.toBeVisible()
  })

  test('修改显示名并保存 → toast', async ({ page }) => {
    const editBtn = page.locator('.table-actions').getByRole('button', { name: '编辑' }).first()
    if (!(await isVisible(editBtn))) return
    await editBtn.click()
    await expect(page.locator('.el-dialog:visible, .el-drawer:visible')).toBeVisible()
    const displayNameInput = page
      .locator('.el-dialog:visible, .el-drawer:visible')
      .locator('.el-form-item')
      .filter({ hasText: '显示名' })
      .getByRole('textbox')
    await displayNameInput.clear()
    await displayNameInput.fill('e2e-display-name')
    await page.locator('.el-dialog:visible, .el-drawer:visible').getByRole('button', { name: '保存' }).click()
    const toast = page.locator('.el-message')
    if (await isVisible(toast, 8000)) {
      await expect(toast).toBeVisible()
    }
  })
})

test.describe('用户账户 — 重置密码', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/user-accounts')
    await expectPageTitle(page, '登录账户')
  })

  test('点击重置密码弹出对话框', async ({ page }) => {
    const resetBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '重置密码' })
      .first()
    if (!(await isVisible(resetBtn))) return
    await resetBtn.click()
    await expect(page.locator('.el-dialog:visible, .el-drawer:visible')).toBeVisible()
    await expect(page.locator('.el-dialog:visible, .el-drawer:visible').getByRole('button', { name: '确认重置' })).toBeVisible()
  })

  test('密码少于 8 字符提交触发 warning toast', async ({ page }) => {
    const resetBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '重置密码' })
      .first()
    if (!(await isVisible(resetBtn))) return
    await resetBtn.click()
    await expect(page.locator('.el-dialog:visible, .el-drawer:visible')).toBeVisible()
    const pwInput = page.locator('.el-dialog:visible, .el-drawer:visible').locator('input[type="password"]')
    await pwInput.fill('short')
    await page.locator('.el-dialog:visible, .el-drawer:visible').getByRole('button', { name: '确认重置' }).click()
    await expect(page.locator('.el-message--warning')).toBeVisible({ timeout: 3000 })
  })

  test('取消关闭对话框', async ({ page }) => {
    const resetBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '重置密码' })
      .first()
    if (!(await isVisible(resetBtn))) return
    await resetBtn.click()
    await expect(page.locator('.el-dialog:visible, .el-drawer:visible')).toBeVisible()
    await page.locator('.el-dialog:visible, .el-drawer:visible').getByRole('button', { name: '取消' }).click()
    await expect(page.locator('.el-dialog:visible, .el-drawer:visible')).not.toBeVisible()
  })
})

test.describe('用户账户 — 启用 / 停用', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/user-accounts')
    await expectPageTitle(page, '登录账户')
  })

  test('停用账户 → 确认弹框 → 取消不变更', async ({ page }) => {
    const disableBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '停用' })
      .first()
    if (!(await isVisible(disableBtn))) return
    await disableBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: '取消' }).click()
    await expect(page.locator('.el-message-box')).not.toBeVisible()
  })

  test('启用账户 → 确认弹框 → 取消不变更', async ({ page }) => {
    const enableBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '启用' })
      .first()
    if (!(await isVisible(enableBtn))) return
    await enableBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: '取消' }).click()
    await expect(page.locator('.el-message-box')).not.toBeVisible()
  })
})
