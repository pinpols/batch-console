import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('tenant management (租户管理)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('租户列表可打开并展示表格与操作列', async ({ page }) => {
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')
    await expect(page.getByRole('button', { name: '刷新' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'tenantId' })).toBeVisible()
  })
})

test.describe('user accounts (用户账户)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('用户账户列表可打开并展示表格', async ({ page }) => {
    await page.goto('/system/user-accounts')
    await expectPageTitle(page, '登录账户')
    await expect(page.getByRole('button', { name: '刷新' }).first()).toBeVisible()
  })
})

test.describe('user role (用户 & 角色)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('用户 & 角色页面可打开', async ({ page }) => {
    await page.goto('/system/users')
    await expectPageTitle(page, '权限自查')
  })
})

test.describe('API key management (API Key 管理)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('API Key 页面可打开并展示表格与操作列', async ({ page }) => {
    await page.goto('/system/api-keys')
    await expectPageTitle(page, 'API Key')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '操作' })).toBeVisible()
  })
})

test.describe('trigger management (Trigger 管理)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Trigger 列表可打开并展示表格', async ({ page }) => {
    await page.goto('/system/triggers')
    await expectPageTitle(page, '触发器')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '状态' })).toBeVisible()
  })
})

test.describe('system parameters (系统参数)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('系统参数页面可打开并展示表格与新增按钮', async ({ page }) => {
    await page.goto('/system/parameters')
    await expectPageTitle(page, '系统参数')
    await expect(page.getByRole('button', { name: '新增参数' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '刷新' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Key' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Value' })).toBeVisible()
  })

  test('点击新增参数弹出对话框', async ({ page }) => {
    await page.goto('/system/parameters')
    await page.getByRole('button', { name: '新增参数' }).first().click()
    await expect(page.getByText('新增参数').first()).toBeVisible()
    await expect(page.getByLabel('Key')).toBeVisible()
    await expect(page.getByLabel('Value')).toBeVisible()
    await expect(page.getByRole('button', { name: '保存' })).toBeVisible()
    await expect(page.getByRole('button', { name: '取消' })).toBeVisible()
  })
})

test.describe('event catalog (事件目录)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('事件目录页面可打开', async ({ page }) => {
    await page.goto('/system/event-catalog')
    await expectPageTitle(page, '事件目录')
  })
})

test.describe('AI chat (AI 助手)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('AI 助手页面可打开', async ({ page }) => {
    await page.goto('/system/ai-chat')
    await expectPageTitle(page, 'AI 助手')
  })
})
