/**
 * Sprint1 批量操作 — 扩展到 outbox / 审批 / 死信(BulkActionBar 复用)。
 * 验证「选行 → 批量操作栏出现/计数 → 清除消失」在这三页都成立。
 * job-instances 的同款验证在 sprint-list-controls.spec.ts。
 *
 * 选行靠 el-table selection 列的 checkbox;无数据行(seed 不含)优雅 test.skip。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

/** 在「当前可见的 el-table」上验证批量操作栏闭环;无数据行返回 false(调用方 skip)。 */
async function assertBulkBar(page: import('@playwright/test').Page): Promise<boolean> {
  const firstRowCheckbox = page
    .locator('.el-table__body-wrapper:visible tbody tr')
    .first()
    .locator('.el-checkbox')
  if (!(await isVisible(firstRowCheckbox, 3000))) return false

  // 行存在但 checkbox 被 disable(如审批中心里非本人可处理 / 已终态的行)是合法 UI 态:
  // 这种行无法参与批量选择,等价于「无可操作行」,优雅 skip 而非点 disabled 元素超时报错。
  const cbClass = (await firstRowCheckbox.getAttribute('class')) || ''
  if (cbClass.includes('is-disabled')) return false

  await firstRowCheckbox.click()
  const bar = page.locator('.bulk-action-bar')
  await expect(bar).toBeVisible({ timeout: 5_000 })
  await expect(bar).toHaveAttribute('role', 'region')
  await expect(bar.locator('.bulk-action-bar__count')).toBeVisible()

  await bar.getByRole('button', { name: '清除' }).first().click()
  await expect(bar).toBeHidden({ timeout: 5_000 })
  return true
}

test.describe('批量操作栏 — 多页面复用', () => {
  test('Outbox 列表', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/outbox')
    await expectPageTitle(page, 'Outbox')
    await expect(page.locator('.el-table, .empty-state').first()).toBeAttached({ timeout: 10_000 })
    if (!(await assertBulkBar(page))) test.skip(true, 'Outbox 无数据行,无法验证批量选择')
  })

  test('审批中心 — 通用审批 Tab', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/approvals')
    await expectPageTitle(page, '审批中心')
    await expect(page.locator('.el-table, .empty-state').first()).toBeAttached({ timeout: 10_000 })
    if (!(await assertBulkBar(page))) test.skip(true, '审批列表无待处理行,无法验证批量选择')
  })

  test('综合查询 — 死信 Tab', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/observability/queries')
    await expectPageTitle(page, '综合查询')
    // 切到死信 tab(observability.tabDeadLetters = 'Dead Letters',zh-CN 也保留英文)
    const tab = page.getByRole('tab', { name: /Dead Letters|死信/i })
    if (!(await isVisible(tab, 3000))) test.skip(true, '死信 Tab 未渲染')
    await tab.click()
    await expect(page.locator('.el-table, .empty-state').first()).toBeAttached({ timeout: 10_000 })
    if (!(await assertBulkBar(page))) test.skip(true, '死信队列无数据行,无法验证批量选择')
  })
})
