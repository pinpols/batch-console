/**
 * ADR-020 批次日重放 E2E:覆盖 submit form 3 个 scope(ALL / ALL_FAILED / SUBSET_JOB_CODES)
 *
 * 注:OUTPUTS_ONLY scope 需要先有 result_version 数据,本地 seed 不一定备齐,留 backlog 单独治。
 * 本 spec 只测 UI 路径(填表 + 提交 → BE 返回 + 详情打开),不期望 BE 真创建 instance(BE 端有
 * orchestrator 的容错;若 calendar/bizDate 不存在 BE 返 4xx,FE 友好报错也算通过)。
 */
import { test, expect } from './support/app'

test.describe('@batch-day-replay 批次日重放', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ops/batch-day-replay')
    // 页面有多处「批次日重放」(header / tab / h1),先到任一可见即可
    await expect(page.getByRole('heading', { name: '批次日重放' }).first()).toBeVisible()
  })

  test('ALL scope:打开表单显示默认值', async ({ page }) => {
    await page.getByRole('button', { name: '新建重放' }).first().click()
    // 两个 drawer 都在 DOM(submit + detail),定位到可见的那个
    const submitDrawer = page.locator('.el-drawer', { hasText: '新建批次日重放' })
    await expect(submitDrawer).toBeVisible()

    // 不应该显示 SUBSET / OUTPUTS 字段(ALL 是默认 scope)
    await expect(submitDrawer.getByRole('radio', { name: '全部候选' })).toBeChecked()
    await expect(submitDrawer.locator('.el-form-item').filter({ hasText: /作业编码/ })).toBeHidden()
    await expect(submitDrawer.locator('.el-form-item').filter({ hasText: /^结果版本 ID/ })).toBeHidden()
  })

  test('ALL_FAILED scope:不需要 jobCodes 字段', async ({ page }) => {
    await page.getByRole('button', { name: '新建重放' }).first().click()
    const d = page.locator('.el-drawer', { hasText: '新建批次日重放' })
    await expect(d).toBeVisible()
    await d.getByRole('radio', { name: '仅失败项' }).check()
    await expect(d.getByRole('radio', { name: '仅失败项' })).toBeChecked()
    await expect(d.locator('.el-form-item').filter({ hasText: /作业编码/ })).toBeHidden()
    await expect(d.locator('.el-form-item').filter({ hasText: /^结果版本 ID/ })).toBeHidden()
  })

  test('SUBSET_JOB_CODES scope:显示 jobCodes 输入框', async ({ page }) => {
    await page.getByRole('button', { name: '新建重放' }).first().click()
    const d = page.locator('.el-drawer', { hasText: '新建批次日重放' })
    await expect(d).toBeVisible()
    await d.locator('.replay-scope-option').filter({ hasText: '指定作业' }).click()
    await expect(d.getByRole('radio', { name: '指定作业' })).toBeChecked()
    await expect(d.locator('.el-form-item').filter({ hasText: /作业编码/ }).locator('.el-select')).toBeVisible()
    await expect(d.locator('.el-form-item').filter({ hasText: /^结果版本 ID/ })).toBeHidden()
  })

  test('OUTPUTS_ONLY scope:显示 Version IDs 输入框', async ({ page }) => {
    await page.getByRole('button', { name: '新建重放' }).first().click()
    const d = page.locator('.el-drawer', { hasText: '新建批次日重放' })
    await expect(d).toBeVisible()
    await d.getByRole('radio', { name: '仅输出结果' }).check()
    await expect(d.getByRole('radio', { name: '仅输出结果' })).toBeChecked()
    await expect(
      d.locator('.el-form-item').filter({ hasText: /^结果版本 ID/ }).locator('.el-select'),
    ).toBeVisible()
    await expect(d.locator('.el-form-item').filter({ hasText: /作业编码/ })).toBeHidden()
  })
})
