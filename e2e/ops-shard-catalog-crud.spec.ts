/**
 * 分片目录 CRUD(biz 多租分片路由 #473,平台 ADMIN)——之前无 e2e 覆盖。
 * smoke 级:进页 + 标题 + 打开新增抽屉验字段 + 取消。不依赖后端数据状态。
 */
import { enterDemoApp, expectPageTitle, expect, test } from './support/app'

test.describe('分片目录 shard-catalog (ADMIN)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/ops/shard-catalog')
    await expectPageTitle(page, '分片目录')
  })

  test('页可达 + 列表区渲染', async ({ page }) => {
    // ADMIN 可见"新建"入口(canManage)
    await expect(page.getByRole('button', { name: '新建' }).first()).toBeVisible()
  })

  test('新增分片抽屉打开 + 字段齐 + 可取消', async ({ page }) => {
    await page.getByRole('button', { name: '新建' }).first().click()
    await page.waitForTimeout(400)
    const drawer = page.locator('.el-drawer:visible').filter({ hasText: '新增分片' })
    await expect(drawer).toBeVisible()
    for (const label of ['分片 key', '主机', '端口', '数据库', '凭据引用', '描述']) {
      await expect(drawer.getByText(label, { exact: true }).first()).toBeVisible()
    }
    await drawer.getByRole('button', { name: '取消' }).click({ force: true })
    await expect(drawer).toBeHidden()
  })
})
