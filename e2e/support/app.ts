import { type Locator, type Page } from '@playwright/test'
import { test, expect } from './fixtures'
export { test, expect }

export type RouteCheck = {
  path: string
  title: string | RegExp
}

export const smokeRoutes: RouteCheck[] = [
  // 运营概览
  { path: '/ops/summary', title: '运营概览' },
  { path: '/approvals', title: '审批中心' },
  { path: '/reports', title: '导出中心' },
  { path: '/self-service', title: '自助服务' },
  { path: '/ops/diagnostic', title: '运维诊断' },
  // 配置与发布
  { path: '/config/releases', title: '配置发布' },
  { path: '/config/excel', title: /Excel 维护/ },
  { path: '/config/management', title: '配置管理' },
  { path: '/config/tenant-package', title: '合并导入' },
  { path: '/system/tags', title: '标签管理' },
  // 文件中心
  { path: '/files/list', title: '文件列表' },
  { path: '/files/templates', title: '文件模板' },
  { path: '/files/arrival-groups', title: '文件组到达治理' },
  { path: '/files/pipeline-obs', title: '流水线观测' },
  // 任务管理
  { path: '/jobs/definitions', title: 'Job 定义' },
  { path: '/workflow/definitions', title: 'Workflow 定义' },
  { path: '/workflow/designer', title: 'Workflow 编排' },
  // 执行与观测
  { path: '/monitor/job-instances', title: 'Job Instance 列表' },
  { path: '/monitor/job-steps', title: /Job Step Instance/ },
  { path: '/monitor/workflow-runs', title: 'Workflow Run 列表' },
  { path: '/logs', title: /执行日志/ },
  { path: '/observability/alerts', title: '告警' },
  { path: '/observability/audits', title: '审计日志' },
  { path: '/observability/outbox', title: 'Outbox' },
  { path: '/observability/queries', title: '可观测性查询' },
  { path: '/system/event-catalog', title: '事件目录' },
  // 调度与治理
  { path: '/scheduler/catch-up-approvals', title: 'Catch-up 审批' },
  { path: '/governance/quota', title: '配额策略' },
  { path: '/governance/queues', title: '队列 / 窗口 / 日历' },
  { path: '/workers/management', title: 'Worker 管理' },
  { path: '/system/triggers', title: 'Trigger 管理' },
  // 系统
  { path: '/system/tenants', title: '租户管理' },
  { path: '/system/user-accounts', title: '用户账户' },
  { path: '/system/users', title: '用户 & 角色' },
  { path: '/system/ai-chat', title: 'AI 助手' },
  { path: '/system/api-keys', title: 'API Key 管理' },
  { path: '/system/parameters', title: '系统参数' },
  { path: '/system/notifications', title: '通知与投递' },
]

export async function enterDemoApp(page: Page) {
  await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' })
  // 如果被重定向到登录页，说明 token 无效/过期
  const url = page.url()
  if (url.includes('/login')) {
    throw new Error(
      'Redirected to /login — storageState token is expired or invalid. ' +
      'Run global-setup with a live backend to refresh it.',
    )
  }
  await expect(page).toHaveURL(/\/ops\/summary/, { timeout: 15_000 })
}

export async function gotoAndAssertRoute(page: Page, route: RouteCheck) {
  await page.goto(route.path, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(new RegExp(escapeForRegex(route.path)), { timeout: 10_000 })
  await expectPageTitle(page, route.title)
}

export async function expectPageTitle(page: Page, title: string | RegExp) {
  const heading = page.locator('.page-header .title').first()
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
