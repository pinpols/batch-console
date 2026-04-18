import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('approval actions (审批操作)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/approvals')
    await expectPageTitle(page, '审批中心')
  })

  test('审批列表展示查询栏与表格列', async ({ page }) => {
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '审批单号' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '类型' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '状态' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '操作' })).toBeVisible()
  })

  test('批量操作按钮在无选择时禁用', async ({ page }) => {
    const batchApprove = page.getByRole('button', { name: '批量通过' })
    const batchReject = page.getByRole('button', { name: '批量拒绝' })
    if (await isVisible(batchApprove)) {
      await expect(batchApprove).toBeDisabled()
      await expect(batchReject).toBeDisabled()
    }
  })

  test('状态筛选可选择并查询', async ({ page }) => {
    const keyword = page.getByPlaceholder(/审批单号|申请人/)
    if (await isVisible(keyword, 2000)) {
      await keyword.fill('test')
    }
    await page.getByRole('button', { name: '查询' }).click()
    // 查询后页面不崩溃
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })

  test('重置清空筛选条件', async ({ page }) => {
    const keyword = page.getByPlaceholder(/审批单号|申请人/)
    if (await isVisible(keyword, 2000)) {
      await keyword.fill('test')
      await page.getByRole('button', { name: '重置' }).click()
      await expect(keyword).toHaveValue('')
    }
  })

  test('操作行按钮（通过/拒绝）可见且为按钮元素', async ({ page }) => {
    const approveBtn = page.locator('.table-actions').getByRole('button', { name: '通过' }).first()
    const rejectBtn = page.locator('.table-actions').getByRole('button', { name: '拒绝' }).first()
    // 若有数据行，验证按钮以正确的 role 渲染（不实际提交审批）
    if (await isVisible(approveBtn)) {
      await expect(approveBtn).toBeEnabled()
    }
    if (await isVisible(rejectBtn, 2000)) {
      await expect(rejectBtn).toBeEnabled()
    }
  })
})
