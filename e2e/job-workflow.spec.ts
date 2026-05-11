import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('job definitions (Job 定义)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Job 定义列表可打开并展示查询控件', async ({ page }) => {
    await page.goto('/jobs/definitions')
    await expectPageTitle(page, '作业定义')
    await expect(page.getByText('Job Code').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })

  test('Job 定义列表支持 jobCode 查询参数预填', async ({ page }) => {
    await page.goto('/jobs/definitions?jobCode=TEST_JOB')
    await expectPageTitle(page, '作业定义')
    const jobCodeInput = page.locator('.el-form-item').filter({ hasText: 'Job Code' }).getByRole('textbox')
    await expect(jobCodeInput).toHaveValue('TEST_JOB')
  })
})

test.describe('workflow definitions (Workflow 定义)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Workflow 定义列表可打开并展示查询控件', async ({ page }) => {
    await page.goto('/workflow/definitions')
    await expectPageTitle(page, '工作流定义')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })
})

test.describe('workflow designer (Workflow 编排)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Workflow 编排页面可打开', async ({ page }) => {
    await page.goto('/workflow/designer')
    await expectPageTitle(page, /Workflow/)
  })
})

test.describe('pipeline definitions (Pipeline 定义)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Pipeline 定义列表可打开并展示表格', async ({ page }) => {
    await page.goto('/jobs/pipelines')
    await expectPageTitle(page, '流水线定义')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })
})
