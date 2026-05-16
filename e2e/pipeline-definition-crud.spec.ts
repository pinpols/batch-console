/**
 * Pipeline 定义 CRUD - 覆盖 i18n 改过的 PipelineDefinitionList.vue。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('pipeline definition CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/jobs/pipelines')
    await expectPageTitle(page, '流水线定义')
  })

  test('新增 Pipeline 对话框可打开 + 验证 i18n 字段', async ({ page }) => {
    await page.getByRole('button', { name: '新增 Pipeline' }).first().click()
    await expect(page.getByText('新建 Pipeline')).toBeVisible()
    await page.waitForTimeout(400)
    const drawer = page.locator('.el-drawer').filter({ hasText: '新建 Pipeline' })
    await expect(drawer.getByText('编码', { exact: true })).toBeVisible()
    await expect(drawer.getByText('名称', { exact: true })).toBeVisible()
    await expect(drawer.getByText('类型', { exact: true })).toBeVisible()
    await expect(drawer.getByText('步骤编辑')).toBeVisible()
    // 关闭抽屉
    await page.keyboard.press('Escape')
  })
})
