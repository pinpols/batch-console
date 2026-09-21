/**
 * Sprint1 批量操作 — 扩展到 outbox / 审批 / 死信(BulkActionBar 复用)。
 * 验证「选行 → 批量操作栏出现/计数 → 清除消失」在这三页都成立。
 * job-instances 的同款验证在 sprint-list-controls.spec.ts。
 *
 * 选行靠 el-table selection 列的 checkbox。测试自行准备数据，避免依赖共享 seed。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

/** 在「当前可见的 el-table」上验证批量操作栏闭环。 */
async function assertBulkBar(page: import('@playwright/test').Page): Promise<void> {
  const firstRowCheckbox = page
    .locator('.el-table__body-wrapper:visible tbody tr')
    .first()
    .locator('.el-checkbox')
  await expect(firstRowCheckbox).toBeVisible({ timeout: 8_000 })

  const cbClass = (await firstRowCheckbox.getAttribute('class')) || ''
  expect(cbClass).not.toContain('is-disabled')

  await firstRowCheckbox.click()
  const bar = page.locator('.bulk-action-bar')
  await expect(bar).toBeVisible({ timeout: 5_000 })
  await expect(bar).toHaveAttribute('role', 'region')
  await expect(bar.locator('.bulk-action-bar__count')).toBeVisible()

  await bar.getByRole('button', { name: '清除' }).first().click()
  await expect(bar).toBeHidden({ timeout: 5_000 })
}

async function createPendingApproval(page: import('@playwright/test').Page): Promise<string> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const response = await page.request.post('/api/console/self-service/jobs/rerun-request', {
    headers: {
      'X-Tenant-Id': 'ta',
      'Idempotency-Key': `e2e-bulk-approval-${suffix}`,
    },
    data: {
      tenantId: 'ta',
      jobCode: `e2e-bulk-approval-${suffix}`,
      bizDate: '2026-09-21',
      reason: 'e2e bulk action bar',
    },
  })
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { data?: string }
  expect(body.data).toBeTruthy()
  return body.data!
}

test.describe('批量操作栏 — 多页面复用', () => {
  test('Outbox 列表', async ({ page }) => {
    await enterDemoApp(page)
    await page.route('**/api/console/queries/outbox-retries*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: {
            items: [
              {
                id: 91001,
                outboxEventId: 92001,
                tenantId: 'ta',
                eventType: 'JOB_FAILED',
                eventKey: 'e2e-bulk-outbox',
                retryStatus: 'FAILED',
                retryCount: 3,
                retryPolicy: 'EXPONENTIAL',
                nextRetryAt: '2026-09-21T09:00:00Z',
                createdAt: '2026-09-21T08:00:00Z',
                updatedAt: '2026-09-21T09:00:00Z',
              },
            ],
            total: 1,
            pageNo: 1,
            pageSize: 15,
          },
        }),
      }),
    )
    await page.goto('/observability/outbox')
    await expect(page.locator('.page-header .title')).toHaveText('Outbox', { timeout: 10_000 })
    await expect(page.locator('tr.el-table__row', { hasText: 'e2e-bulk-outbox' })).toBeVisible({
      timeout: 10_000,
    })
    await assertBulkBar(page)
  })

  test('审批中心 — 通用审批 Tab', async ({ page }) => {
    await enterDemoApp(page)
    const approvalNo = await createPendingApproval(page)
    await page.goto('/approvals')
    await expectPageTitle(page, '审批中心')
    const keyword = page.getByPlaceholder(/审批单号|申请人/)
    await keyword.fill(approvalNo)
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.locator('.el-table, .empty-state').first()).toBeAttached({ timeout: 10_000 })
    await expect(page.locator('tr.el-table__row').filter({ hasText: approvalNo })).toHaveCount(1)
    await assertBulkBar(page)
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
    await assertBulkBar(page)
  })
})
