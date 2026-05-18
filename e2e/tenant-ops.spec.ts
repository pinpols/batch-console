/**
 * 租户管理 — 完整业务流程测试（真实变更）
 * 覆盖：筛选、新建租户、编辑、暂停/恢复、初始化配置、复制配置
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

// 模块级 ID 加 random,防多 worker 并行加载时同毫秒撞 unique 约束(已有 21+ 个 e2e- 前缀租户)
const uniqueTenantId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

test.describe('租户管理 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')
  })

  test('关键字搜索', async ({ page }) => {
    const input = page.getByPlaceholder(/tenantId|名称/)
    if (!(await isVisible(input, 2000))) return
    await input.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
  })

  test('状态筛选 → 查询 → 重置', async ({ page }) => {
    const statusSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '状态' })
      .locator('.el-select')
    if (!(await isVisible(statusSelect, 2000))) return
    await statusSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    }
    await page.getByRole('button', { name: '重置' }).click()
  })

  test('刷新按钮', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).first().click()
    await expect(page.getByRole('columnheader', { name: 'tenantId' }).or(
      page.getByRole('columnheader', { name: '租户' }),
    )).toBeVisible({ timeout: 6000 })
  })
})

test.describe('租户管理 — 新建租户', () => {
  test('新建租户 → 填写 → 提交 → toast', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')

    await page.getByRole('button', { name: '新增租户' }).first().click()
    await expect(page.getByText('新增租户').first()).toBeVisible()

    await page.getByLabel('租户 ID').fill(uniqueTenantId)
    await page.getByLabel('名称').fill('E2E 测试租户')
    // 账号 + 密码必填(useDestroyConfirm/createTenant body)
    const accountInput = page.getByLabel('账号名')
    if (await isVisible(accountInput, 1000)) await accountInput.fill('e2e-admin')
    const pwdInput = page.getByLabel('初始密码')
    // 密码 ≥ 12 位(P0 强化)
    if (await isVisible(pwdInput, 1000)) await pwdInput.fill('Test@2026e2e1')

    await page.getByRole('button', { name: /保存|创建/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('租户管理 — 编辑租户', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')
  })

  test('编辑第一个租户 → 修改名称 → 保存 → toast', async ({ page }) => {
    const editBtn = page.locator('.table-actions').getByRole('button', { name: '编辑' }).first()
    if (!(await isVisible(editBtn))) return
    await editBtn.click()
    await expect(page.getByText('编辑租户')).toBeVisible()
    const nameInput = page.getByLabel('名称')
    await nameInput.clear()
    await nameInput.fill('E2E Tenant Updated')
    await page.getByRole('button', { name: /保存|确定/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('租户管理 — 状态切换', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')
  })

  test('暂停租户 → 确认 → toast', async ({ page }) => {
    const suspendBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '暂停' })
      .first()
    if (!(await isVisible(suspendBtn))) return
    await suspendBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await expect(page.locator('.el-message-box')).toContainText('暂停')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('恢复租户 → 确认 → toast', async ({ page }) => {
    const resumeBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '恢复' })
      .first()
    if (!(await isVisible(resumeBtn))) return
    await resumeBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
  })

  test('设为当前租户', async ({ page }) => {
    const setCurrentBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '设为当前' })
      .first()
    if (!(await isVisible(setCurrentBtn))) return
    await setCurrentBtn.click()
    // 按钮应变为"当前"
    await expect(
      page.locator('.table-actions').getByRole('button', { name: '当前' }).first(),
    ).toBeVisible({ timeout: 4000 })
  })
})

test.describe('租户管理 — 初始化配置（试运行）', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')
  })

  test('初始化配置 → 选类型 → 试运行 → 结果展示', async ({ page }) => {
    // 行操作"初始化配置"现在收纳在"更多"下拉菜单
    const moreBtn = page.locator('.table-actions').getByRole('button', { name: /^更多/ }).first()
    if (!(await isVisible(moreBtn))) return
    await moreBtn.click()
    const initItem = page.getByRole('menuitem', { name: '初始化配置' }).first()
    if (!(await isVisible(initItem, 2000))) return
    await initItem.click()
    await expect(page.getByText('初始化租户配置')).toBeVisible()

    // 选第一个配置类型 checkbox
    const firstCheckbox = page
      .locator('.el-dialog:visible, .el-drawer:visible')
      .locator('.el-checkbox')
      .first()
    await firstCheckbox.click()

    // 2026-05 后改成两个独立按钮:「试运行」+「执行」。直接点试运行。
    await page
      .locator('.el-dialog:visible, .el-drawer:visible')
      .getByRole('button', { name: /试运行|预览/ })
      .first()
      .click()
    // 等待执行结果弹窗或 toast
    await expect(
      page.getByText('执行结果').or(page.locator('.el-message')),
    ).toBeVisible({ timeout: 10000 })
  })
})

test.describe('租户管理 — 复制配置（试运行）', () => {
  test('复制配置 → 选类型 → 试运行 → 结果展示', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')

    await page.getByRole('button', { name: '复制配置' }).click()
    await expect(page.getByText('跨租户复制配置')).toBeVisible()

    // 选源租户（第一个选项）
    const sourceSelect = page
      .locator('.el-dialog:visible, .el-drawer:visible')
      .locator('.el-form-item')
      .filter({ hasText: '源租户' })
      .locator('.el-select')
    await sourceSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (!(await isVisible(opt, 2000))) {
      await page.getByRole('button', { name: '取消' }).click()
      return
    }
    await opt.click()

    // 选目标租户（第二个选项以避免与源相同）
    const targetSelect = page
      .locator('.el-dialog:visible, .el-drawer:visible')
      .locator('.el-form-item')
      .filter({ hasText: '目标租户' })
      .locator('.el-select')
    await targetSelect.click()
    const targetOpt = page.locator('.el-select-dropdown__item').nth(1)
    if (await isVisible(targetOpt, 2000)) await targetOpt.click()
    else {
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: '取消' }).click()
      return
    }

    // 2026-05 后改成独立「试运行」按钮(无 dry-run switch)
    await page
      .locator('.el-dialog:visible, .el-drawer:visible')
      .getByRole('button', { name: /试运行|预览/ })
      .first()
      .click()
    await expect(
      page.getByText('执行结果').or(page.locator('.el-message')),
    ).toBeVisible({ timeout: 10000 })
  })
})
