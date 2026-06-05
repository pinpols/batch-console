/**
 * admin 未选当前租户 · 全页面「不整页崩溃」回归守卫
 *
 * Why:admin(跨租户)登录后尚未选择当前租户时,tenant.tenantId 为空。租户依赖页面若用空
 *   tenantId 发请求,会被 BE 拒为 400「租户参数缺失」/ 403,未捕获的异常经路由级 ErrorBoundary
 *   升级成整页「组件渲染异常」(Vue runtime-6)。该缺陷曾一次性打崩 23 个页面。
 *
 *   修复(2026-06):
 *     - useTenantReload:空 tenantId 不触发加载 + 同步调用并兜底 catch
 *     - useSseAutoReload:空 scope 不开流
 *     - ErrorBoundary:API/网络错误不再升级为整页错误态(只真渲染错才显示边界)
 *     - main.ts:全局 unhandledrejection 兜底(API 错 preventDefault + 记录)
 *
 *   本 spec 锁死该回归:在 admin-无租户态逐页断言「无组件渲染异常 + 无未捕获 pageerror」。
 *   既往巡检(all-pages-zero-error)仅在「有租户」态跑,从未覆盖这条最易暴露空参的路径。
 */
import { test, expect } from '@playwright/test'

// 用 admin(跨租户)身份;global-setup.cjs 生成 role-admin.json
test.use({ storageState: 'e2e/.auth/role-admin.json' })

const TENANT_STORAGE_KEY = 'batch-console-tenant-id'

// 租户依赖的列表/详情页(空 tenantId 时最易触发空参请求)
const TENANT_SCOPED_PAGES = [
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
  '/files/pipeline-obs',
  '/observability/alerts',
  '/observability/outbox',
  '/observability/audits',
  '/observability/operation-audits',
  '/observability/queries',
  '/scheduler/batch-days',
  '/ops/custom-task-types',
  '/ops/worker-fingerprints',
  '/system/notifications',
  '/config/management',
  '/config/releases',
  '/workers/management',
]

test.describe('@cross-browser admin 未选租户 · 页面不整页崩溃(组件渲染异常回归守卫)', () => {
  test.beforeEach(async ({ page }) => {
    // 先进应用清空「当前租户」,模拟 admin 登录后尚未选择租户
    await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' })
    await page.evaluate((key) => window.localStorage.removeItem(key), TENANT_STORAGE_KEY)
  })

  for (const path of TENANT_SCOPED_PAGES) {
    test(`${path} 不应整页崩溃`, async ({ page }) => {
      const pageErrors: string[] = []
      page.on('pageerror', (e) => pageErrors.push(e.message))

      // 全量导航 → 应用以空 tenantId 重新初始化
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)

      // 1) 路由级错误边界「组件渲染异常」不应出现
      await expect(page.getByText('组件渲染异常')).toHaveCount(0)

      // 2) 不应有未捕获异常逸出(API 错应被各页 loadError / 拦截器 toast / 全局兜底吸收)
      expect(pageErrors, `${path} 出现未捕获异常: ${pageErrors.join(' | ')}`).toHaveLength(0)
    })
  }
})
