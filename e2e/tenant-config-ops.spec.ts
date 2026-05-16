import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('tenant batch create with config init (批量建租户 + 配置初始化)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')
  })

  test('批量新建对话框展示配置初始化选项', async ({ page }) => {
    await page.getByRole('button', { name: '批量新增' }).click()
    await expect(page.getByText('批量新增租户')).toBeVisible()
    // 配置初始化分区
    await expect(page.getByText('配置初始化(可选)')).toBeVisible()
    // 源租户选择器可见
    await expect(page.getByText('源租户').first()).toBeVisible()
    // 初始化模式默认隐藏（需先选源租户）
    await page.getByRole('button', { name: '取消' }).click()
  })

  test('选择源租户后初始化模式显示', async ({ page }) => {
    await page.getByRole('button', { name: '批量新增' }).click()
    // 点源租户下拉
    const sourceSelect = page.locator('.el-dialog').locator('.el-select').last()
    await sourceSelect.click()
    // 选第一个选项
    const firstOption = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(firstOption, 2000)) {
      await firstOption.click()
      // 初始化模式 radio 应出现
      await expect(page.getByText('仅补缺失项').first()).toBeVisible()
      await expect(page.getByText('覆盖更新已有').first()).toBeVisible()
    }
    await page.getByRole('button', { name: '取消' }).click()
  })
})

test.describe('tenant init config dialog (初始化租户配置)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')
  })

  test('初始化配置对话框可打开并展示完整表单', async ({ page }) => {
    const initBtn = page.locator('.table-actions').getByRole('button', { name: '初始化' }).first()
    if (await isVisible(initBtn)) {
      await initBtn.click()
      await expect(page.getByText('初始化租户配置')).toBeVisible()
      // 10 个配置类型 checkbox
      await expect(page.getByText('JOB_DEFINITION')).toBeVisible()
      await expect(page.getByText('WORKFLOW_DEFINITION')).toBeVisible()
      await expect(page.getByText('ALERT_ROUTING')).toBeVisible()
      // 写入模式 radio
      await expect(page.getByText('仅补缺失项').first()).toBeVisible()
      // Spec JSON textarea
      await expect(page.getByPlaceholder(/完整的配置 JSON/)).toBeVisible()
      // 试运行 switch 默认开启
      await expect(page.getByText('试运行').first()).toBeVisible()
      // 按钮文本随 dryRun 变化
      await expect(page.getByRole('button', { name: '试运行' })).toBeVisible()
      await page.getByRole('button', { name: '取消' }).click()
    }
  })
})

test.describe('tenant copy config dialog (跨租户复制配置)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')
  })

  test('复制配置对话框可打开并展示完整表单', async ({ page }) => {
    await page.getByRole('button', { name: '复制配置' }).click()
    await expect(page.getByText('跨租户复制配置')).toBeVisible()
    // 源租户 & 目标租户
    await expect(page.getByText('源租户').first()).toBeVisible()
    await expect(page.getByText('目标租户').first()).toBeVisible()
    // 配置类型 checkbox
    await expect(page.getByText('JOB_DEFINITION')).toBeVisible()
    // 写入模式(label 改成中文了:仅补缺失项 / 覆盖更新已有)
    await expect(page.getByText('仅补缺失项').first()).toBeVisible()
    // 试运行
    await expect(page.getByText('试运行').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '试运行' })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click()
  })
})
