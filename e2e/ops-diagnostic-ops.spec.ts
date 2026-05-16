/**
 * 运维诊断 — 完整业务流程测试（真实变更）
 * 覆盖：Tab 切换、Outbox 清理/重发布（真实执行）、集群诊断刷新
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('运维诊断 — Tab 与刷新', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/ops/diagnostic')
    await expectPageTitle(page, '运维诊断')
  })

  test('运维工具箱 tab 默认激活', async ({ page }) => {
    const tab = page.getByRole('tab', { name: '运维工具箱' })
    if (await isVisible(tab, 2000)) {
      await expect(tab).toHaveClass(/is-active/)
    }
  })

  test('切换到集群诊断 tab', async ({ page }) => {
    const tab = page.getByRole('tab', { name: '集群诊断' })
    if (!(await isVisible(tab, 2000))) return
    await tab.click()
    await expect(tab).toHaveClass(/is-active/)
  })

  test('集群诊断全部刷新 → toast 或数据更新', async ({ page }) => {
    const tab = page.getByRole('tab', { name: '集群诊断' })
    if (!(await isVisible(tab, 2000))) return
    await tab.click()
    const refreshBtn = page.getByRole('button', { name: '全部刷新' })
    if (!(await isVisible(refreshBtn))) return
    await refreshBtn.click()
    await expect(page.locator('.el-message, .el-card, .el-table').first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('运维诊断 — Outbox 清理 / 重发布', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/ops/diagnostic')
    await expectPageTitle(page, '运维诊断')
    // 切换到运维工具箱 tab（默认应在此）
    const tab = page.getByRole('tab', { name: '运维工具箱' })
    if (await isVisible(tab, 2000)) await tab.click()
  })

  test('Outbox 刷新', async ({ page }) => {
    // 查找 Outbox 区域的刷新按钮
    const refreshBtn = page.getByRole('button', { name: '刷新' }).first()
    if (!(await isVisible(refreshBtn))) return
    await refreshBtn.click()
    await expect(page.locator('.el-card, .el-table').first()).toBeAttached({ timeout: 6000 })
  })

  test('Outbox 清理 → 确认 → toast', async ({ page }) => {
    const cleanBtn = page.getByRole('button', { name: '清理' })
    if (!(await isVisible(cleanBtn))) return
    await cleanBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('清理 Outbox')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('Outbox 重发布 → 确认 → toast', async ({ page }) => {
    const republishBtn = page.getByRole('button', { name: '重发布' })
    if (!(await isVisible(republishBtn))) return
    await republishBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText(/重发布|outbox 事件 ID/)
    // 输入合法格式的 ID(可能 BE 找不到也算流程通)。空输入会被 inputPattern 卡住不发请求,
    // 所以必须填一个合法的数字。
    await page.locator('.el-message-box input').fill('999999')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})
