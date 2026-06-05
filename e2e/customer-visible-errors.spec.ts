/**
 * 客户可见报错 · 全页面强断言守卫(多角色)
 *
 * Why:既有 *-crud / *-ops spec 断言「操作成功/不崩」,会漏「值渲染对不对」——典型如
 *   表格所有列显示「—」(字段映射漂移)、加载期弹「资源不存在/请求失败/unsupported」
 *   错误 toast、导航过渡误触发的 not-found。这些 CRUD 测试照样过,但客户一眼就看到报错。
 *
 *   本 spec 换断言层次,对每个页面在多角色下断言「客户看不到报错」:
 *     ① 加载后无错误 toast(.el-message--error / .el-notification--error)
 *     ② 加载后无未捕获 JS 错(pageerror)+ 无「组件渲染异常」错误边界
 *     ③ 有数据的表格:首行关键列不全是「—」(抓字段映射漂移,如 file-templates/channels)
 *
 *   覆盖 admin(跨租户,最易暴露)+ tenantAdmin + tenantUser(非 admin 角色)。
 *   role-*.json 由 global-setup.cjs 生成;无权页会被守卫重定向,按 skip 处理不算失败。
 */
import { test, expect, type Page } from '@playwright/test'

const TENANT_KEY = 'batch-console-tenant-id'

// 错误 toast 文案白判:这些词出现在 .el-message--error 即客户可见报错
const ERROR_TEXT = /资源不存在|请求失败|unsupported|not found|加载失败|系统错误|渲染异常/i

// 受租户数据驱动、最易暴露渲染/加载错的页面
const PAGES = [
  '/jobs/pipelines',
  '/jobs/definitions',
  '/monitor/job-instances',
  '/monitor/job-steps',
  '/monitor/workflow-runs',
  '/workflow/definitions',
  '/files/list',
  '/files/templates',
  '/files/channels',
  '/files/arrival-groups',
  '/observability/alerts',
  '/observability/outbox',
  '/observability/audits',
  '/observability/operation-audits',
  '/scheduler/batch-days',
  '/ops/custom-task-types',
  '/ops/worker-fingerprints',
  '/system/notifications',
  '/config/releases',
  '/runs',
  '/approvals',
  '/workers/management',
]

const ROLES = [
  { key: 'admin', storage: 'e2e/.auth/role-admin.json', setTenant: 'ta' },
  { key: 'tenantAdmin', storage: 'e2e/.auth/role-tenantAdmin.json', setTenant: null },
  { key: 'tenantUser', storage: 'e2e/.auth/role-tenantUser.json', setTenant: null },
] as const

async function assertNoCustomerVisibleError(page: Page, route: string, pageErrors: string[]) {
  // ② 渲染崩溃边界
  await expect(page.getByText('组件渲染异常')).toHaveCount(0)

  // ① 错误 toast
  const toasts = await page
    .locator('.el-message--error, .el-notification--error')
    .allTextContents()
  const errorToasts = toasts.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => ERROR_TEXT.test(s))
  expect(errorToasts, `${route} 加载弹出错误 toast: ${errorToasts.join(' | ')}`).toHaveLength(0)

  // ② 未捕获 JS 错
  expect(pageErrors, `${route} 加载抛未捕获异常: ${pageErrors.join(' | ')}`).toHaveLength(0)

  // ③ 表格数据渲染:首行前几列不全是「—」(字段映射漂移守卫)
  const rows = page.locator('.el-table__row')
  if ((await rows.count()) > 0) {
    const cells = (await rows.first().locator('td .cell').allTextContents()).map((c) => c.trim())
    const firstCols = cells.slice(0, Math.min(5, cells.length))
    if (firstCols.length >= 3) {
      const emptyCount = firstCols.filter((c) => !c || c === '—' || c === '-').length
      expect(emptyCount, `${route} 表格首行前 ${firstCols.length} 列全为空/—(疑似字段映射漂移)`).toBeLessThan(
        firstCols.length,
      )
    }
  }
}

for (const role of ROLES) {
  test.describe(`@customer-errors 客户可见报错守卫 · ${role.key}`, () => {
    test.use({ storageState: role.storage })

    test.beforeEach(async ({ page }) => {
      // admin 跨租户:显式设当前租户 ta,否则租户依赖页空 tenantId
      if (role.setTenant) {
        await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' })
        await page.evaluate(
          ([k, v]) => window.localStorage.setItem(k, v),
          [TENANT_KEY, role.setTenant],
        )
      }
    })

    for (const route of PAGES) {
      test(`${route} 无客户可见报错`, async ({ page }) => {
        const pageErrors: string[] = []
        page.on('pageerror', (e) => pageErrors.push(e.message.split('\n')[0].slice(0, 80)))

        await page.goto(route, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1800)

        // 无权角色会被守卫重定向到别处:不在该 route 即视为该角色无此页,跳过断言
        if (!page.url().includes(route)) {
          test.skip(true, `${role.key} 无权访问 ${route}(已重定向)`)
          return
        }
        await assertNoCustomerVisibleError(page, route, pageErrors)
      })
    }
  })
}
