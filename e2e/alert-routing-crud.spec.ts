import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('alert routing reserved state (告警路由预留)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/alert-routings')
    await expectPageTitle(page, '告警路由（预留）')
  })

  test('预留页展示历史列表,不暴露新增入口', async ({ page }) => {
    await expect(page.getByText('预留配置，当前不生效')).toBeVisible()
    await expect(page.getByRole('button', { name: '新增路由' })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: '路由编码' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '接收人' })).toBeVisible()
  })

  test('预留页已有行只能查看,不能编辑或切换生效状态', async ({ page }) => {
    const editButtons = page.getByRole('button', { name: '编辑' })
    const count = await editButtons.count()
    for (let i = 0; i < count; i++) {
      await expect(editButtons.nth(i)).toBeDisabled()
    }
  })
})
