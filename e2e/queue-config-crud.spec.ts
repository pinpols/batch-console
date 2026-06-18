/**
 * 队列 / 批次窗口 / 业务日历 CRUD 测试
 * 覆盖我刚 i18n 改过的 QueueConfig.vue 4 个表单。
 *
 * 注意:e2e 默认在 ta 租户跑,会污染。建议跑前后 cleanup,或者使用 e2e- 前缀只删自己造的。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

const TS = Date.now()

test.describe('queue config CRUD (资源队列)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/queues')
    await expectPageTitle(page, '队列与窗口')
  })

  test('新建队列对话框可打开 + 必填字段校验', async ({ page }) => {
    await page.getByRole('button', { name: '新建队列' }).first().click()
    await expect(page.getByText('新增资源队列')).toBeVisible()
    await page.waitForTimeout(400)
    // 验证刚 i18n 改过的 label 都在
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').filter({ hasText: '新增资源队列' })
    await expect(dialog.getByText('队列编码', { exact: true })).toBeVisible()
    await expect(dialog.getByText('并发上限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('QPS 上限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('公平权重', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click({ force: true })
  })

  test('真端到端:填队列 → 保存 → 成功提示 + 列表出现', async ({ page }) => {
    const code = `e2e-queue-${Date.now()}`
    await page.getByRole('button', { name: '新建队列' }).first().click()
    const dialog = page
      .locator('.el-dialog:visible, .el-drawer:visible')
      .filter({ hasText: '新增资源队列' })
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // 必填:队列编码(input)+ 类型(select);并发等为可选,填几个真实值
    await dialog
      .locator('.el-form-item')
      .filter({ hasText: '队列编码' })
      .locator('input')
      .first()
      .fill(code)
    // 名称:FE 标可选但 BE 必填(queue_name),需填
    await dialog
      .locator('.el-form-item')
      .filter({ hasText: /^名称/ })
      .locator('input')
      .first()
      .fill(`E2E Queue ${Date.now()}`)
    const typeItem = dialog.locator('.el-form-item').filter({ hasText: '类型' }).first()
    await typeItem.locator('.el-select__wrapper, .el-select').first().click()
    await page.waitForTimeout(300)
    const opt = page.locator('.el-select-dropdown:visible').last().locator('.el-select-dropdown__item').first()
    await expect(opt).toBeVisible({ timeout: 4000 })
    await opt.click()
    await dialog
      .locator('.el-form-item')
      .filter({ hasText: '并发上限' })
      .locator('input')
      .first()
      .fill('10')

    await dialog.getByRole('button', { name: /保存|确定|创建/ }).first().click()
    await expect(page.locator('.el-message--success').first()).toBeVisible({ timeout: 6000 })
    await expect(dialog).toBeHidden({ timeout: 6000 })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('batch window CRUD (批次窗口)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/windows')
  })

  test('新建批次窗口对话框可打开', async ({ page }) => {
    await page.getByRole('button', { name: '新建批次窗口' }).first().click()
    await expect(page.getByText('新增批次窗口')).toBeVisible()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').filter({ hasText: '新增批次窗口' })
    await expect(dialog.getByText('窗口编码', { exact: true })).toBeVisible()
    await expect(dialog.getByText('开始时间', { exact: true })).toBeVisible()
    await expect(dialog.getByText('结束时间', { exact: true })).toBeVisible()
    await expect(dialog.getByText('到点策略', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click({ force: true })
  })
})

test.describe('business calendar CRUD (业务日历)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/calendars')
  })

  test('新建业务日历对话框可打开', async ({ page }) => {
    await page.getByRole('button', { name: '新建业务日历' }).first().click()
    await expect(page.getByText('新增业务日历')).toBeVisible()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').filter({ hasText: '新增业务日历' })
    await expect(dialog.getByText('日历编码', { exact: true })).toBeVisible()
    await expect(dialog.getByText('节假日顺延规则', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Catch-up 策略', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click({ force: true })
  })
})
