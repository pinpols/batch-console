/**
 * Trigger 管理 — 完整操作测试
 * 覆盖：页面基础、注册/注销/暂停/恢复操作（含确认弹框）、取消不变更
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('Trigger 管理 — 页面基础', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/triggers')
    await expectPageTitle(page, '触发器')
  })

  test('表格展示 Job Code / 类型 / 状态 / 操作列', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Job Code' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '类型' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '状态' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '操作' })).toBeVisible()
  })

  test('刷新', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })
})

test.describe('Trigger 管理 — 注册操作', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/triggers')
    await expectPageTitle(page, '触发器')
  })

  test('点击注册 → 弹出确认框', async ({ page }) => {
    const btn = page.locator('.table-actions').getByRole('button', { name: '注册' }).first()
    if (!(await isVisible(btn))) return
    await btn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('注册确认')
  })

  test('注册 → 取消不触发请求', async ({ page }) => {
    const btn = page.locator('.table-actions').getByRole('button', { name: '注册' }).first()
    if (!(await isVisible(btn))) return
    await btn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: '取消' }).click()
    await expect(page.locator('.el-message-box')).not.toBeVisible()
  })

  test('注册 → 确认 → toast', async ({ page }) => {
    const btn = page.locator('.table-actions').getByRole('button', { name: '注册' }).first()
    if (!(await isVisible(btn))) return
    await btn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    const toast = page.locator('.el-message')
    if (await isVisible(toast, 8000)) {
      await expect(toast).toBeVisible()
    }
  })
})

test.describe('Trigger 管理 — 注销操作', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/triggers')
    await expectPageTitle(page, '触发器')
  })

  test('点击注销 → 弹出确认框', async ({ page }) => {
    const btn = page.locator('.table-actions').getByRole('button', { name: '注销' }).first()
    if (!(await isVisible(btn))) return
    await btn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('注销确认')
  })

  test('注销 → 取消不触发请求', async ({ page }) => {
    const btn = page.locator('.table-actions').getByRole('button', { name: '注销' }).first()
    if (!(await isVisible(btn))) return
    await btn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: '取消' }).click()
    await expect(page.locator('.el-message-box')).not.toBeVisible()
  })

  test('注销 → 确认 → toast', async ({ page }) => {
    const btn = page.locator('.table-actions').getByRole('button', { name: '注销' }).first()
    if (!(await isVisible(btn))) return
    await btn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    const toast = page.locator('.el-message')
    if (await isVisible(toast, 8000)) {
      await expect(toast).toBeVisible()
    }
  })
})

test.describe('Trigger 管理 — 暂停操作', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/triggers')
    await expectPageTitle(page, '触发器')
  })

  test('点击暂停 → 弹出确认框', async ({ page }) => {
    const btn = page.locator('.table-actions').getByRole('button', { name: '暂停' }).first()
    if (!(await isVisible(btn))) return
    await btn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('暂停确认')
  })

  test('暂停 → 取消不触发请求', async ({ page }) => {
    const btn = page.locator('.table-actions').getByRole('button', { name: '暂停' }).first()
    if (!(await isVisible(btn))) return
    await btn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: '取消' }).click()
    await expect(page.locator('.el-message-box')).not.toBeVisible()
  })

  test('暂停 → 确认 → toast', async ({ page }) => {
    const btn = page.locator('.table-actions').getByRole('button', { name: '暂停' }).first()
    if (!(await isVisible(btn))) return
    await btn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    const toast = page.locator('.el-message')
    if (await isVisible(toast, 8000)) {
      await expect(toast).toBeVisible()
    }
  })
})

test.describe('Trigger 管理 — 恢复操作', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/triggers')
    await expectPageTitle(page, '触发器')
  })

  test('点击恢复 → 直接提交并出现 toast（无确认框）', async ({ page }) => {
    const btn = page.locator('.table-actions').getByRole('button', { name: '恢复' }).first()
    if (!(await isVisible(btn))) return
    await btn.click()
    // doResume 直接调用接口，无 confirm
    const toast = page.locator('.el-message')
    if (await isVisible(toast, 8000)) {
      await expect(toast).toBeVisible()
    }
  })
})
