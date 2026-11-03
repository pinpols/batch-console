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
import { STORAGE_KEYS } from './support/storage'
import { test, expect } from '@playwright/test'

// 用 admin(跨租户)身份;global-setup.cjs 生成 role-admin.json
test.use({ storageState: 'e2e/.auth/role-admin.json' })

const TENANT_STORAGE_KEY = STORAGE_KEYS.tenantId

// 租户依赖的列表/详情页(空 tenantId 时最易触发空参请求)
const TENANT_SCOPED_PAGES = [
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
    // Firefox 在路由模块尚未加载完成时立即进行下一次整页导航，会把动态 import
    // 取消并上报为 pageerror。先等待首屏主体就绪，避免把导航竞态误判成组件崩溃。
    await expect(page.locator('.page-header, .m-page').first()).toBeVisible({ timeout: 15_000 })
    await page.evaluate((key) => window.localStorage.removeItem(key), TENANT_STORAGE_KEY)
  })

  for (const path of TENANT_SCOPED_PAGES) {
    test(`${path} 不应整页崩溃`, async ({ page }) => {
      const pageErrors: string[] = []
      page.on('pageerror', (e) => pageErrors.push(e.message))

      // 全量导航 → 应用以空 tenantId 重新初始化
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      // 观察异步路由与数据回调是否产生异常；页面就绪由后续断言核对。
      await page.waitForTimeout(1500)

      // 1) 路由级错误边界「组件渲染异常」不应出现
      await expect(page.getByText('组件渲染异常')).toHaveCount(0)

      // 2) 不应有未捕获异常逸出(API 错应被各页 loadError / 拦截器 toast / 全局兜底吸收)
      expect(pageErrors, `${path} 出现未捕获异常: ${pageErrors.join(' | ')}`).toHaveLength(0)
    })
  }
})

/**
 * admin 未选当前租户 · 新增入口不得“点了没反应”
 *
 * Why:2026-11-03 用户反馈多个页面新增按钮无反应。根因是新增处理函数在无租户时静默 return。
 *   修复后统一经 useTenantRequirement 提示“请先在顶部选择租户”；平台级资源（与租户无关）照常打开。
 *   本组断言每个新增入口点击后至少有一种可见反馈：打开抽屉/对话框、跳转，或出现提示。
 */
const ADD_ENTRY_PAGES = [
  '/system/notifications?tab=channels',
  '/system/notifications?tab=rules',
  '/system/notifications?tab=webhooks',
  '/files/templates',
  '/files/channels',
  '/config/releases',
  '/governance/calendars',
  '/governance/queues',
  '/governance/windows',
  '/system/parameters',
  '/system/api-keys',
]

const ADD_BUTTON_NAME = /^\s*(新增|新建)/

test.describe('@cross-browser admin 未选租户 · 新增入口有可见反馈', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.page-header, .m-page').first()).toBeVisible({ timeout: 15_000 })
    await page.evaluate((key) => window.localStorage.removeItem(key), TENANT_STORAGE_KEY)
  })

  for (const path of ADD_ENTRY_PAGES) {
    test(`${path} 的新增按钮点击后有反馈`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      const addButton = page
        .locator('.page-header')
        .getByRole('button', { name: ADD_BUTTON_NAME })
        .first()
      await expect(addButton).toBeVisible({ timeout: 15_000 })
      const before = page.url()
      await addButton.click()

      const feedback = page
        .locator('.el-drawer.open, .el-overlay-dialog .el-dialog, .el-message')
        .first()
      await expect
        .poll(
          async () => (await feedback.isVisible().catch(() => false)) || page.url() !== before,
          { message: `${path} 点击新增后既未打开表单、未跳转，也没有提示`, timeout: 5_000 },
        )
        .toBe(true)
    })
  }
})
