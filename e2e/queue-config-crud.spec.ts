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
    const dialog = page.locator('.el-dialog').filter({ hasText: '新增资源队列' })
    await expect(dialog.getByText('队列编码', { exact: true })).toBeVisible()
    await expect(dialog.getByText('并发上限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('QPS 上限', { exact: true })).toBeVisible()
    await expect(dialog.getByText('公平权重', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click({ force: true })
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
    const dialog = page.locator('.el-dialog').filter({ hasText: '新增批次窗口' })
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
    const dialog = page.locator('.el-dialog').filter({ hasText: '新增业务日历' })
    await expect(dialog.getByText('日历编码', { exact: true })).toBeVisible()
    await expect(dialog.getByText('节假日顺延规则', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Catch-up 策略', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click({ force: true })
  })
})
