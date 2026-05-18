/**
 * 文件模板 + 文件渠道 CRUD - 覆盖 i18n 改过的 FileTemplateList.vue 两个对话框。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('file template + channel CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/files/templates')
    await expectPageTitle(page, '文件模板')
  })

  test('新增模板对话框可打开 + 验证 i18n field 字段', async ({ page }) => {
    await page.getByRole('button', { name: '新建文件模板' }).first().click()
    await expect(page.getByText('新增文件模板')).toBeVisible()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').filter({ hasText: '新增文件模板' })
    await expect(dialog.getByText('模板编码', { exact: true })).toBeVisible()
    await expect(dialog.getByText('模板类型', { exact: true })).toBeVisible()
    await expect(dialog.getByText('文件格式', { exact: true })).toBeVisible()
    await expect(dialog.getByText('字符集', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click({ force: true })
  })

  // 文件渠道 是独立路由(/files/channels),不再共享 /files/templates 的 tab 切换
  test('文件渠道页面 + 新增渠道对话框', async ({ page }) => {
    await page.goto('/files/channels')
    await expectPageTitle(page, '文件渠道')
    await page.getByRole('button', { name: '新建文件渠道' }).first().click()
    await expect(page.getByText('新增文件渠道')).toBeVisible()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').filter({ hasText: '新增文件渠道' })
    await expect(dialog.getByText('渠道编码', { exact: true })).toBeVisible()
    await expect(dialog.getByText('渠道类型', { exact: true })).toBeVisible()
    await expect(dialog.getByText('目标端点', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click({ force: true })
  })
})
