import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('file list (文件列表)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('文件列表可打开并展示查询控件与表格', async ({ page }) => {
    await page.goto('/files/list')
    await expectPageTitle(page, '文件列表')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })
})

test.describe('file templates (文件模板)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('文件模板列表可打开并展示表格', async ({ page }) => {
    await page.goto('/files/templates')
    await expectPageTitle(page, '文件模板')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })
})

test.describe('arrival groups (文件组到达治理)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('文件组到达治理页面可打开并展示表格', async ({ page }) => {
    await page.goto('/files/arrival-groups')
    await expectPageTitle(page, '文件组到达治理')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })
})

test.describe('file pipeline observability (流水线观测)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('流水线观测可打开并展示多维度标签页', async ({ page }) => {
    await page.goto('/files/pipeline-obs')
    await expectPageTitle(page, '流水线观测')
    await expect(page.getByRole('tab', { name: '流水线' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '步骤' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '投递' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '错单' })).toBeVisible()
  })
})
