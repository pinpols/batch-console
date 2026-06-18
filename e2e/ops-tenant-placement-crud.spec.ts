/**
 * 租户分片 placement CRUD(biz 多租分片路由 #473,平台 ADMIN)——之前无 e2e 覆盖。
 * smoke 级:进页 + 标题 + 打开指派抽屉验字段 + 取消。不依赖后端数据状态。
 */
import { enterDemoApp, expectPageTitle, expect, test } from './support/app'

test.describe('租户分片 tenant-placements (ADMIN)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/ops/tenant-placements')
    await expectPageTitle(page, '租户分片')
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
})
