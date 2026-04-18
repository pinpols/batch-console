/**
 * 任务管理 — 完整业务流程测试
 * 覆盖：Job 定义 / Workflow 定义 / Pipeline 定义
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

// ─── Job 定义 ──────────────────────────────────────────────────────

test.describe('Job 定义 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/jobs/definitions')
    await expectPageTitle(page, 'Job 定义')
  })

  test('Job Code 模糊搜索后表格刷新', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: 'Job Code' }).getByRole('textbox')
    await input.fill('test')
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
  })

  test('名称搜索', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: '名称' }).getByRole('textbox')
    await input.fill('job')
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
  })

  test('启用状态筛选 → 查询 → 重置', async ({ page }) => {
    const enabledSelect = page
      .locator('.el-form-item')
      .filter({ hasText: '启用' })
      .locator('.el-select')
    await enabledSelect.click()
    const opt = page.locator('.el-select-dropdown__item').filter({ hasText: '启用' }).first()
    if (await isVisible(opt, 2000)) {
      await opt.click()
      await page.getByRole('button', { name: '查询' }).click()
      await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
    }
    await page.getByRole('button', { name: '重置' }).click()
    await expect(enabledSelect).not.toContainText('启用')
  })

  test('刷新按钮重新加载', async ({ page }) => {
    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.getByRole('columnheader', { name: 'Job Code' })).toBeVisible({ timeout: 6000 })
  })
})

test.describe('Job 定义 — 操作流', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/jobs/definitions')
    await expectPageTitle(page, 'Job 定义')
  })

  test('停用 / 启用切换 → 确认 → toast', async ({ page }) => {
    const toggleBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: /停用|启用/ })
      .first()
    if (!(await isVisible(toggleBtn))) return
    const label = await toggleBtn.textContent()
    await toggleBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
    // 按钮文字应已翻转
    await expect(
      page.locator('.table-actions').getByRole('button', { name: /停用|启用/ }).first(),
    ).not.toHaveText(label?.trim() ?? '')
  })

  test('手动触发 → 填写 payload → 提交 → toast', async ({ page }) => {
    const triggerBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '手动触发' })
      .first()
    if (!(await isVisible(triggerBtn))) return
    await triggerBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    // 填写触发 payload（prompt textarea）
    const ta = page.locator('.el-message-box').locator('textarea')
    if (await isVisible(ta, 1000)) await ta.fill('{}')
    await page.locator('.el-message-box').getByRole('button', { name: '触发' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })

  test('克隆 Job → 确认 → toast', async ({ page }) => {
    const cloneBtn = page.locator('.table-actions').getByRole('button', { name: '克隆' }).first()
    if (!(await isVisible(cloneBtn))) return
    await cloneBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })

  test('查看实例 → 跳转到 Job Instance 列表并预填 jobCode', async ({ page }) => {
    const instanceBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '查看实例' })
      .first()
    if (!(await isVisible(instanceBtn))) return
    await instanceBtn.click()
    await expect(page).toHaveURL(/\/monitor\/job-instances/)
    await expectPageTitle(page, 'Job Instance 列表')
  })
})

// ─── Workflow 定义 ─────────────────────────────────────────────────

test.describe('Workflow 定义 — 筛选查询', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/workflow/definitions')
    await expectPageTitle(page, 'Workflow 定义')
  })

  test('Workflow Code 搜索', async ({ page }) => {
    const input = page
      .locator('.el-form-item')
      .filter({ hasText: 'Workflow Code' })
      .getByRole('textbox')
    await input.fill('test')
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
  })

  test('重置清空筛选', async ({ page }) => {
    const input = page
      .locator('.el-form-item')
      .filter({ hasText: 'Workflow Code' })
      .getByRole('textbox')
    await input.fill('abc')
    await page.getByRole('button', { name: '重置' }).click()
    await expect(input).toHaveValue('')
  })
})

test.describe('Workflow 定义 — 操作流', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/workflow/definitions')
    await expectPageTitle(page, 'Workflow 定义')
  })

  test('停用 / 启用切换 → 确认 → toast', async ({ page }) => {
    const toggleBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: /停用|启用/ })
      .first()
    if (!(await isVisible(toggleBtn))) return
    const label = await toggleBtn.textContent()
    await toggleBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
    await expect(
      page.locator('.table-actions').getByRole('button', { name: /停用|启用/ }).first(),
    ).not.toHaveText(label?.trim() ?? '')
  })

  test('校验 Workflow → toast 或校验结果对话框', async ({ page }) => {
    const validateBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '校验' })
      .first()
    if (!(await isVisible(validateBtn))) return
    await validateBtn.click()
    const resultDialog = page.getByText('Workflow 校验结果')
    const anyToast = page.locator('.el-message')
    await expect(resultDialog.or(anyToast)).toBeVisible({ timeout: 8000 })
  })

  test('详情抽屉打开并含版本信息', async ({ page }) => {
    const detailBtn = page.locator('.table-actions').getByRole('button', { name: '详情' }).first()
    if (!(await isVisible(detailBtn))) return
    await detailBtn.click()
    await expect(
      page.getByText(/Workflow 详情|版本信息/),
    ).toBeVisible({ timeout: 4000 })
    await page.locator('.el-drawer__close-btn').first().click()
  })

  test('DAG 按钮跳转到 Workflow 编排页', async ({ page }) => {
    const dagBtn = page.locator('.table-actions').getByRole('button', { name: 'DAG' }).first()
    if (!(await isVisible(dagBtn))) return
    await dagBtn.click()
    await expect(page).toHaveURL(/\/workflow\/designer/)
  })

  test('删除 Workflow → 确认 → toast', async ({ page }) => {
    const deleteBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: '删除' })
      .first()
    if (!(await isVisible(deleteBtn))) return
    await deleteBtn.click()
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })
})

// ─── Pipeline 定义 ─────────────────────────────────────────────────

test.describe('Pipeline 定义 — 筛选与 CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/jobs/pipelines')
    await expectPageTitle(page, 'Pipeline 定义')
  })

  test('关键字搜索', async ({ page }) => {
    const input = page.locator('.el-form-item').filter({ hasText: '关键字' }).getByRole('textbox')
    if (!(await isVisible(input, 2000))) return
    await input.fill('pipe')
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.locator('.el-table').first()).toBeAttached({ timeout: 10_000 })
  })

  test('新建 Pipeline → 抽屉打开 → 填写并保存', async ({ page }) => {
    await page.getByRole('button', { name: '新建 Pipeline' }).click()
    await expect(page.getByText('新建 Pipeline').first()).toBeVisible()
    const unique = `e2e-pipe-${Date.now()}`
    await page.getByLabel('pipelineCode').fill(unique)
    await page.getByLabel('pipelineName').fill('E2E Pipeline')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })

  test('编辑 Pipeline → 修改名称 → 保存', async ({ page }) => {
    const editBtn = page.locator('.table-actions').getByRole('button', { name: '编辑' }).first()
    if (!(await isVisible(editBtn))) return
    await editBtn.click()
    await expect(page.getByText('编辑 Pipeline')).toBeVisible()
    const nameInput = page.getByLabel('pipelineName')
    await nameInput.clear()
    await nameInput.fill('E2E Pipeline Updated')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 8000 })
  })
})
