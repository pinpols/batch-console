import { expect, test } from './support/app'
import { enterDemoApp } from './support/app'

test.describe('alert routing 预留态校验', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/alert-routings')
  })

  test('预留态不暴露新增表单,避免用户误以为保存后生效', async ({ page }) => {
    await expect(page.getByText('预留配置，当前不生效')).toBeVisible()
    await expect(page.getByRole('button', { name: '新增路由' })).toHaveCount(0)
    await expect(
      page.locator('.el-dialog:visible, .el-drawer:visible').filter({ hasText: '新增告警路由' }),
    ).toHaveCount(0)
  })

  test('预留态刷新和筛选仍可用于审计历史配置', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.getByRole('columnheader', { name: '路由编码' })).toBeVisible()
    const keyword = page.locator('.query__search input').first()
    await expect(keyword).toBeVisible()
    await keyword.fill('e2e')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.getByRole('columnheader', { name: '路由编码' })).toBeVisible()
  })
})
