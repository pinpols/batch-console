/** 通过当前六步向导真实创建作业定义。 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('Job Definition CRUD', () => {
  const codeSuffix = Date.now()
  const jobCode = `IMPORT_E2E_JOB_${codeSuffix}`
  const jobName = `E2E Job ${codeSuffix}`

  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/jobs/definitions')
    await expectPageTitle(page, '作业定义')
    await expect(page.getByRole('button', { name: /新建作业|新增作业/ }).first()).toBeVisible()
  })

  test('新增入口进入六步向导并真实创建作业', async ({ page, network }) => {
    await page.getByRole('button', { name: /新建作业|新增作业/ }).first().click()
    await expect(page).toHaveURL(/\/jobs\/definitions\/new$/)
    await expect(page.locator('.wizard-step-banner__title')).toHaveText('基本信息')
    await page.locator('.code-name-builder .cnb-biz input').fill(`E2E_JOB_${codeSuffix}`)
    await page.locator('input[maxlength="256"]').first().fill(jobName)

    for (let index = 0; index < 5; index += 1) {
      await page.getByRole('button', { name: '下一步' }).click()
    }
    await expect(page.locator('.wizard-step-banner__title')).toHaveText('复核')
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/console/jobs/bundle/create') &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: '提交创建' }).click()
    const response = await createResponse
    expect(response.ok(), await response.text()).toBe(true)
    await expect(page).toHaveURL(/\/jobs\/definitions\?jobCode=/, { timeout: 10000 })
    await expect(page.getByRole('cell', { name: jobCode })).toBeVisible({ timeout: 10000 })
    network.assertClean('job-definition-create-wizard')
  })

  test('@cross-browser 列表分页 + 筛选无服务端错误', async ({ page, network }) => {
    const keyword = page.getByPlaceholder(/请输入/).first()
    if (await isVisible(keyword, 1500)) {
      await keyword.fill('e2e')
      await page.keyboard.press('Enter')
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    }
    const next = page.locator('.el-pagination .btn-next').first()
    if (await isVisible(next, 1000)) {
      const disabled = await next.getAttribute('disabled')
      if (disabled === null) await next.click({ force: true })
      await page.waitForTimeout(800)
    }
    network.assertClean('job-definition list')
  })
})
