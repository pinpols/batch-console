/**
 * 只读角色的空态不应出现无权限的引导按钮：
 * 作业定义为空时，“去批量导入配置包”指向租户配置包页，只读用户进不去，按钮应隐藏而不是点了被送回首页。
 */
import { expect, test, type Page } from '@playwright/test'

async function mockEmptyJobDefinitions(page: Page) {
  await page.route('**/api/console/queries/job-definitions?**', (route) =>
    route.fulfill({
      json: {
        code: 'SUCCESS',
        message: 'success',
        data: { items: [], total: 0, pageNo: 1, pageSize: 15 },
        meta: { requestId: 'e2e', traceId: 'e2e', timestamp: new Date().toISOString() },
      },
    }),
  )
}

test.describe('只读用户空态引导', () => {
  test.use({ storageState: 'e2e/.auth/role-tenantUser.json' })

  test('作业定义为空时不显示无权限的“去批量导入配置包”', async ({ page }) => {
    await mockEmptyJobDefinitions(page)
    await page.goto('/jobs/definitions')
    const empty = page.locator('.empty-state')
    await expect(empty).toBeVisible({ timeout: 15_000 })
    await expect(empty.getByRole('button', { name: '去批量导入配置包' })).toHaveCount(0)
  })
})

test.describe('可写配置角色空态引导', () => {
  test.use({ storageState: 'e2e/.auth/role-admin.json' })

  test('作业定义为空时管理员仍可从空态进入配置包导入', async ({ page }) => {
    await mockEmptyJobDefinitions(page)
    await page.goto('/jobs/definitions')
    const empty = page.locator('.empty-state')
    await expect(empty).toBeVisible({ timeout: 15_000 })
    await expect(empty.getByRole('button', { name: '去批量导入配置包' })).toBeVisible()
  })
})
