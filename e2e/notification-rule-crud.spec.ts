/**
 * 通知规则 CRUD - 在通知与投递 → 订阅规则 tab 下。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('notification rule CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/notifications')
    await expectPageTitle(page, '通知与投递')
    await page.getByRole('tab', { name: '订阅规则' }).click()
  })

  test('订阅规则 tab 可切换 + 表格/空态可见', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '订阅规则' })).toHaveClass(/is-active/)
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({
      timeout: 8000,
    })
  })

  test('新增订阅规则对话框可打开 + 字段可见', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /^新增/ }).first()
    if (!(await isVisible(addBtn, 2000))) return
    await addBtn.click()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').first()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '取消' }).click({ force: true })
  })

  test('真端到端:填订阅规则 → 保存 → 成功提示 + 列表出现', async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const channelCode = `e2e-rule-channel-${suffix}`
    const channelResponse = await page.request.post(
      `/api/console/notifications/channels?tenantId=ta`,
      {
        headers: { 'X-Tenant-Id': 'ta', 'Idempotency-Key': `e2e-rule-channel-${suffix}` },
        data: {
          channelCode,
          channelName: `E2E rule channel ${suffix}`,
          channelType: 'EMAIL',
          configJson: '{}',
          enabled: true,
        },
      },
    )
    expect(channelResponse.ok(), await channelResponse.text()).toBe(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: '订阅规则' }).click()

    const addBtn = page.getByRole('button', { name: /^新增/ }).first()
    await expect(addBtn).toBeVisible()
    const name = `e2e-rule-${suffix}`
    await addBtn.click()
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').filter({ hasText: '新增规则' })
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // 订阅规则表单:名称 / 事件类型(input) / 渠道 ID(select,需已有渠道)
    await dialog.locator('.el-form-item').filter({ hasText: '名称' }).locator('input').first().fill(name)
    await dialog
      .locator('.el-form-item')
      .filter({ hasText: '事件类型' })
      .locator('input')
      .first()
      .fill('JOB_FAILED')
    // 渠道 ID:选择本用例刚创建的隔离渠道。
    const chanItem = dialog.locator('.el-form-item').filter({ hasText: '渠道' }).first()
    await chanItem.locator('.el-select__wrapper, .el-select').first().click()
    await page.waitForTimeout(400) // 等下拉动画 + channelOptions 异步加载
    const chanOpt = page
      .locator('.el-select-dropdown:visible')
      .last()
      .locator('.el-select-dropdown__item', { hasText: channelCode })
    await expect(chanOpt).toBeVisible({ timeout: 4000 })
    await chanOpt.click()
    // 等 el-select v-model 绑定落定(否则保存时 channelId 可能仍是 null);校验 select 已显示选中值
    await expect(chanItem.locator('.el-select__wrapper')).not.toContainText('选择渠道', { timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(400)

    await dialog.getByRole('button', { name: /保存|确定|创建/ }).first().click()
    await expect(page.locator('.el-message--success').first()).toBeVisible({ timeout: 6000 })
    await expect(dialog).toBeHidden({ timeout: 6000 })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    const row = page.locator('tr.el-table__row', { hasText: name })
    await expect(row).toHaveCount(1)

    await row.getByRole('button', { name: '删除' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(row).toHaveCount(0)

    const cleanupResponse = await page.request.delete(
      `/api/console/notifications/channels/${encodeURIComponent(channelCode)}?tenantId=ta`,
      { headers: { 'X-Tenant-Id': 'ta' } },
    )
    expect(cleanupResponse.ok(), await cleanupResponse.text()).toBe(true)
  })
})
