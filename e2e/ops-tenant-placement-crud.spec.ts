/**
 * 租户分片 placement CRUD(biz 多租分片路由 #473,平台 ADMIN)。
 * smoke:进页 + 字段;persist:真指派→列表出现→取消指派→消失(删除步即自清理,afterEach API 兜底)。
 */
import { enterDemoApp, expectPageTitle, expect, test } from './support/app'

const TENANT = `e2e-tenant-${Date.now()}`
const PLACEMENT = 'e2e-shard-x'

test.describe('租户分片 tenant-placements (ADMIN)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/ops/tenant-placements')
    await expectPageTitle(page, '租户分片')
  })

  test.afterEach(async ({ request }) => {
    await request
      .delete(`/api/console/ops/tenant-placements/${encodeURIComponent(TENANT)}`)
      .catch(() => {})
  })

  test('页可达 + 新建入口可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: '新建' }).first()).toBeVisible()
  })

  test('指派抽屉打开 + 租户/分片字段齐 + 可取消', async ({ page }) => {
    await page.getByRole('button', { name: '新建' }).first().click()
    await page.waitForTimeout(400)
    const drawer = page.locator('.el-drawer:visible').filter({ hasText: '指派租户分片' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('租户', { exact: true }).first()).toBeVisible()
    await expect(drawer.getByText('分片 key', { exact: true }).first()).toBeVisible()
    await drawer.getByRole('button', { name: '取消' }).click({ force: true })
    await expect(drawer).toBeHidden()
  })

  test('真 CRUD:指派 → 列表出现 → 取消指派 → 消失', async ({ page }) => {
    await page.getByRole('button', { name: '新建' }).first().click()
    const drawer = page.locator('.el-drawer:visible').filter({ hasText: '指派租户分片' })
    await expect(drawer).toBeVisible()
    // 租户:普通 el-input
    await drawer.locator('.el-form-item').filter({ hasText: '租户' }).locator('input').first().fill(TENANT)
    // 分片 key:allow-create 的 el-select —— 点 wrapper → 输入 → 点下拉里的"创建项"提交
    // (仅按 Enter 偶发不提交 model 值 → 后端 NotBlank 400;点 dropdown item 更稳)
    const item = drawer.locator('.el-form-item').filter({ hasText: '分片 key' })
    await item.locator('.el-select__wrapper').first().click()
    const sel = item.locator('input.el-select__input, input').first()
    await sel.fill(PLACEMENT)
    await page.waitForTimeout(400)
    const createOpt = page
      .locator('.el-select-dropdown:visible .el-select-dropdown__item')
      .filter({ hasText: PLACEMENT })
      .first()
    if (await createOpt.isVisible().catch(() => false)) {
      await createOpt.click()
    } else {
      await page.keyboard.press('Enter')
    }
    // 校验:placementKey 应已写入(否则保存按钮 disabled)
    await expect(drawer.getByRole('button', { name: '保存' })).toBeEnabled()
    await drawer.getByRole('button', { name: '保存' }).click()
    await expect(drawer).toBeHidden({ timeout: 8000 })

    await expect(page.getByRole('cell', { name: TENANT })).toBeVisible({ timeout: 8000 })

    // 取消指派(行 danger 操作 '取消指派')
    const row = page.locator('tr', { hasText: TENANT })
    let delBtn = row.getByRole('button', { name: '取消指派' }).first()
    if (!(await delBtn.isVisible().catch(() => false))) {
      const more = row.getByRole('button', { name: /更多|More/i }).first()
      if (await more.isVisible().catch(() => false)) {
        await more.click()
        delBtn = page.getByRole('menuitem', { name: '取消指派' }).first()
      }
    }
    await delBtn.click({ force: true })
    // 新 UI:confirmDanger 弹框确认钮文案为「确定」(非 irreversible 场景)
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /^(确定|确认)/ })
      .first()
      .click({ force: true })

    await expect(page.getByRole('cell', { name: TENANT })).toBeHidden({ timeout: 8000 })
  })
})
