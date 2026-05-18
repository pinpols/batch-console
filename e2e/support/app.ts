import { type Locator, type Page } from '@playwright/test'
import { test, expect } from './fixtures'
export { test, expect }

export type RouteCheck = {
  path: string
  title: string | RegExp
}

export const smokeRoutes: RouteCheck[] = [
  // 工作台
  { path: '/ops/summary', title: '控制面板' },
  { path: '/approvals', title: '审批中心' },
  { path: '/reports', title: '报表中心' },
  { path: '/self-service', title: '自助服务' },
  { path: '/ops/diagnostic', title: '运维诊断' },
  // 配置与发布
  { path: '/config/releases', title: '发布管理' },
  { path: '/config/management', title: '变更与同步' },
  { path: '/config/tenant-package', title: '配置批量导入' },
  { path: '/system/tags', title: '标签管理' },
  // 文件中心
  { path: '/files/list', title: '文件列表' },
  { path: '/files/templates', title: '文件模板' },
  { path: '/files/arrival-groups', title: '到达组治理' },
  { path: '/files/pipeline-obs', title: '流水线观测' },
  // 定义与编排
  { path: '/jobs/definitions', title: '作业定义' },
  { path: '/workflow/definitions', title: '工作流定义' },
  { path: '/workflow/designer', title: '编排设计器' },
  // Runs / 执行与观测
  { path: '/runs', title: '全部运行' },
  { path: '/monitor/job-instances', title: '作业运行' },
  { path: '/monitor/job-steps', title: '作业步骤' },
  { path: '/monitor/workflow-runs', title: '工作流运行' },
  // /logs 已 redirect 到 /observability/queries?tab=executionLogs,smoke 不再列
  { path: '/observability/alerts', title: /事件告警|告警/ },
  { path: '/observability/audits', title: '审计日志' },
  { path: '/observability/outbox', title: 'Outbox' },
  { path: '/observability/queries', title: '综合查询' },
  { path: '/system/event-catalog', title: '事件目录' },
  // 调度与治理
  // /scheduler/catch-up-approvals 已 redirect 到 /approvals?tab=catch-up,smoke 不再列
  { path: '/governance/quota', title: /配额策略|租户配额/ },
  { path: '/governance/queues', title: /队列/ },
  { path: '/workers/management', title: 'Worker' },
  { path: '/system/triggers', title: '触发器' },
  // 系统
  { path: '/system/tenants', title: '租户实例' },
  { path: '/system/user-accounts', title: '登录账户' },
  { path: '/system/users', title: '权限自查' },
  { path: '/system/ai-chat', title: 'AI 助手' },
  { path: '/system/api-keys', title: 'API Key' },
  { path: '/system/parameters', title: '系统参数' },
  { path: '/system/notifications', title: '通知与投递' },
]

export async function enterDemoApp(page: Page) {
  // 第一次访问任意页面前预置 localStorage:locale + onboarding 跳过。
  // 用 addInitScript 保证在每次 navigation 之前(含跳登录后回 ops/summary)都生效。
  // STORAGE keys:
  //   - 'batch-console:locale'           见 src/constants/locale.ts:1
  //   - 'batch-console-onboarding-done'  见 src/composables/useOnboardingTour.ts:14
  await page.addInitScript(() => {
    try {
      localStorage.setItem('batch-console:locale', 'zh-CN')
      localStorage.setItem('batch-console-onboarding-done', '1')
    } catch {}
  })

  await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' })
  // FE 启动期 router.beforeEach 异步调 /auth/me,domcontentloaded 可能早于此完成 →
  // URL 短暂停留 /login 然后才弹回 /ops/summary。直接等终态 URL,不要在中间快照。
  try {
    await expect(page).toHaveURL(/\/ops\/summary/, { timeout: 15_000 })
  } catch (e) {
    if (page.url().includes('/login')) {
      throw new Error(
        'Redirected to /login — storageState token is expired or invalid. ' +
          'Run global-setup with a live backend to refresh it.',
      )
    }
    throw e
  }

  // 兜底:如 driver overlay 已经渲染就移除
  await page.evaluate(() => {
    document
      .querySelectorAll('.driver-overlay, .driver-popover, .driver-active-element')
      .forEach((el) => el.remove())
  })
}

export async function gotoAndAssertRoute(page: Page, route: RouteCheck) {
  await page.goto(route.path, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(new RegExp(escapeForRegex(route.path)), { timeout: 10_000 })
  await expectPageTitle(page, route.title)
}

export async function expectPageTitle(page: Page, title: string | RegExp) {
  const heading = page.locator('.page-header .title').first()
  // 部分页面(如 WorkflowDesigner 画布)没有 .page-header,直接放行
  const exists = await heading.count()
  if (exists === 0) return
  if (title instanceof RegExp) {
    await expect(heading).toHaveText(title, { timeout: 10_000 })
    return
  }
  await expect(heading).toHaveText(title, { timeout: 10_000 })
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Returns true when a locator is visible within the given timeout.
 * Avoids the verbose `.isVisible({ timeout }).catch(() => false)` pattern.
 */
export async function isVisible(locator: Locator, timeout = 3000): Promise<boolean> {
  return locator.isVisible({ timeout }).catch(() => false)
}

/**
 * Clicks a table-action button in the first row that contains `rowText`.
 * Skips silently when no matching row is found within `timeout`.
 */
export async function clickTableAction(
  page: Page,
  rowText: string,
  actionLabel: string,
  timeout = 3000,
): Promise<boolean> {
  const row = page.locator('tr', { hasText: rowText })
  const btn = row.getByRole('button', { name: actionLabel })
  if (!(await isVisible(btn, timeout))) return false
  await btn.click()
  return true
}

/**
 * Waits for an El-Message success toast containing `text`.
 */
export async function expectSuccessToast(page: Page, text: string | RegExp) {
  await expect(page.locator('.el-message--success')).toContainText(text)
}

/**
 * Navigates to a list page and returns the numeric ID from the first `.cell-link` href.
 * Returns null when the table has no rows (no runtime data available).
 *
 * Use this instead of hard-coding IDs like `/monitor/job-instances/1`.
 */
export async function getFirstCellLinkId(page: Page, listPath: string): Promise<string | null> {
  await page.goto(listPath)
  const link = page.locator('.cell-link').first()
  if (!(await isVisible(link, 3000))) return null
  const href = await link.getAttribute('href')
  const match = href?.match(/\/(\d+)(?:[/?#]|$)/)
  return match ? match[1] : null
}
