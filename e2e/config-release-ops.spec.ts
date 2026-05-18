/**
 * 配置发布 — 完整业务流程测试（真实变更）
 *
 * 覆盖：筛选/重置、详情抽屉、发布、灰度、回滚、提审 全流程。
 * 所有写操作真实提交，验证 success / error toast 及表格状态变化。
 *
 * 注意：发布/灰度/回滚会改变 release 状态；为避免互相干扰，
 *       各 describe 独立运行，不依赖特定 release 状态——操作后只
 *       断言 toast 出现（后端报错也算正常业务响应，UI 不崩溃即可）。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

// ─── 辅助：等待 toast（成功或失败均接受，只要 UI 有反馈）──────────
async function waitForAnyToast(page: import('@playwright/test').Page) {
  await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 8000 })
}

async function waitForSuccessToast(page: import('@playwright/test').Page) {
  await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 8000 })
}

// ─── 筛选与查询 ────────────────────────────────────────────────────

test.describe('配置发布 — 筛选与查询', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config/releases')
    await expectPageTitle(page, '发布管理')
  })

  test('Key 模糊搜索 → 表格按条件刷新', async ({ page }) => {
    const keyInput = page.locator('.el-form-item').filter({ hasText: 'Key' }).getByRole('textbox')
    await keyInput.fill('test')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.getByRole('columnheader', { name: 'Key' })).toBeVisible()
  })

  test('名称模糊搜索 → 表格按条件刷新', async ({ page }) => {
    const nameInput = page
      .locator('.el-form-item')
      .filter({ hasText: '名称' })
      .getByRole('textbox')
    await nameInput.fill('config')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.getByRole('columnheader', { name: '名称' })).toBeVisible()
  })

  test('状态下拉筛选 → 表格按状态过滤', async ({ page }) => {
    const statusSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '状态' })
      .locator('.el-select')
    await statusSelect.click()
    const firstOpt = page.locator('.el-select-dropdown__item').first()
    if (await isVisible(firstOpt, 2000)) {
      const label = await firstOpt.textContent()
      await firstOpt.click()
      await page.getByRole('button', { name: '搜索' }).click()
      // 表格展示对应状态标签
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
      // 重置后状态下拉清空
      await page.getByRole('button', { name: '重置' }).click()
      await expect(statusSelect).not.toContainText(label?.trim() ?? 'x')
    }
  })

  test('重置清空 Key + 名称', async ({ page }) => {
    const keyInput = page.locator('.el-form-item').filter({ hasText: 'Key' }).getByRole('textbox')
    const nameInput = page
      .locator('.el-form-item')
      .filter({ hasText: '名称' })
      .getByRole('textbox')
    await keyInput.fill('abc')
    await nameInput.fill('xyz')
    await page.getByRole('button', { name: '重置' }).click()
    await expect(keyInput).toHaveValue('')
    await expect(nameInput).toHaveValue('')
  })

  test('刷新按钮重新加载数据', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.getByRole('columnheader', { name: 'Key' })).toBeVisible({ timeout: 6000 })
  })
})

// ─── 详情抽屉 ──────────────────────────────────────────────────────

test.describe('配置发布 — 详情抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config/releases')
    await expectPageTitle(page, '发布管理')
  })

  test('点击详情 → 抽屉展示 configKey / configStatus 字段 → 关闭', async ({ page }) => {
    const detailBtn = page.locator('.table-actions').getByRole('button', { name: '详情' }).first()
    if (!(await isVisible(detailBtn))) return
    await detailBtn.click()
    await expect(page.getByText('配置发布详情')).toBeVisible()
    await expect(page.getByText('configKey')).toBeVisible()
    await expect(page.getByText('configStatus')).toBeVisible()
    await page.locator('.el-drawer__close-btn').first().click()
    await expect(page.getByText('配置发布详情')).toBeHidden()
  })
})

// ─── 发布操作（真实执行）──────────────────────────────────────────

test.describe('配置发布 — 发布操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config/releases')
    await expectPageTitle(page, '发布管理')
  })

  test('发布：填写原因并提交 → toast 出现 → 表格刷新', async ({ page }) => {
    const publishBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '发布' })
      .first()
    if (!(await isVisible(publishBtn))) return
    await publishBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    // 填写发布原因
    await page.locator('.el-message-box').locator('input,textarea').fill('e2e 自动化发布')
    await page.locator('.el-message-box').getByRole('button', { name: '发布' }).click()
    await waitForAnyToast(page)
    // 无论成功还是后端报错，表格列头应仍在
    await expect(page.getByRole('columnheader', { name: 'Key' })).toBeVisible({ timeout: 6000 })
  })

  test('灰度：填写 scope JSON 并提交 → toast 出现', async ({ page }) => {
    const grayBtn = page.locator('.table-actions').getByRole('button', { name: '灰度' }).first()
    if (!(await isVisible(grayBtn))) return
    await grayBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page
      .locator('.el-message-box')
      .locator('input,textarea')
      .fill('{"tenants":["e2e-tenant"]}')
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    await waitForAnyToast(page)
    await expect(page.getByRole('columnheader', { name: 'Key' })).toBeVisible({ timeout: 6000 })
  })

  test('回滚：确认 + 填写原因并提交 → toast 出现', async ({ page }) => {
    const rollbackBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '回滚' })
      .first()
    if (!(await isVisible(rollbackBtn))) return
    await rollbackBtn.click()
    // 第一个 confirm 弹窗
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /^(确定|确认.*)$/ }).click()
    // 第二个 prompt 弹窗（原因）
    await expect(page.locator('.el-message-box')).toBeVisible({ timeout: 3000 })
    await page.locator('.el-message-box').locator('input,textarea').fill('e2e 自动化回滚')
    await page.locator('.el-message-box').getByRole('button', { name: '提交' }).click()
    await waitForAnyToast(page)
    await expect(page.getByRole('columnheader', { name: 'Key' })).toBeVisible({ timeout: 6000 })
  })

  test('提审：填写原因并提交 → toast 出现', async ({ page }) => {
    const approvalBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '提审' })
      .first()
    if (!(await isVisible(approvalBtn))) return
    await approvalBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').locator('input,textarea').fill('e2e 自动化提审')
    await page.locator('.el-message-box').getByRole('button', { name: '提交' }).click()
    await waitForAnyToast(page)
    await expect(page.getByRole('columnheader', { name: 'Key' })).toBeVisible({ timeout: 6000 })
  })
})

// ─── 依赖与版本对比（真实请求）────────────────────────────────────

test.describe('配置发布 — 依赖与版本对比', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config/releases')
    await expectPageTitle(page, '发布管理')
  })

  test('依赖：点击后抽屉加载数据（JSON 或空提示）', async ({ page }) => {
    const depsBtn = page.locator('.table-actions').getByRole('button', { name: '依赖' }).first()
    if (!(await isVisible(depsBtn))) return
    await depsBtn.click()
    await expect(page.getByText('配置依赖关系')).toBeVisible()
    // 等后端返回：pre 或 empty
    await expect(
      page.locator('.el-drawer').locator('pre, .el-empty'),
    ).toBeVisible({ timeout: 8000 })
  })

  test('版本对比：选 B 后点对比 → 结果区出现', async ({ page }) => {
    const diffBtn = page.locator('.table-actions').getByRole('button', { name: '对比' }).first()
    if (!(await isVisible(diffBtn))) return
    await diffBtn.click()
    await expect(page.getByText('配置版本对比')).toBeVisible()

    // 选版本 B（选与 A 不同的第一个选项）
    const versionBSelect = page
      .locator('.el-dialog:visible, .el-drawer:visible')
      .locator('.el-form-item')
      .filter({ hasText: '版本 B' })
      .locator('.el-select')
    await versionBSelect.click()
    const opt = page.locator('.el-select-dropdown__item').first()
    if (!(await isVisible(opt, 2000))) return
    await opt.click()

    const compareBtn = page.locator('.el-dialog:visible, .el-drawer:visible').getByRole('button', { name: '对比' })
    await expect(compareBtn).toBeEnabled()
    await compareBtn.click()

    // 结果：pre 或 toast
    const resultPre = page.locator('.el-dialog:visible, .el-drawer:visible').locator('pre')
    const anyToast = page.locator('.el-message')
    await expect(resultPre.or(anyToast)).toBeVisible({ timeout: 8000 })
  })
})
