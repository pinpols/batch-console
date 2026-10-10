import { STORAGE_KEYS } from './storage'
import { type Locator, type Page } from '@playwright/test'
import { test, expect } from './fixtures'
import {
  type E2eLocale,
  type LocalizedExpectation,
  resolveLocalizedExpectation,
  setE2eLocale,
} from './i18n'
export { test, expect }

export type RouteCheck = {
  path: string
  title: LocalizedExpectation
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
  { path: '/files/channels', title: '文件渠道' },
  { path: '/files/arrival-groups', title: '到达组治理' },
  { path: '/files/pipeline-obs', title: '流水线观测' },
  // 定义与编排
  { path: '/jobs/definitions', title: '作业定义' },
  { path: '/jobs/pipelines', title: '流水线定义' },
  { path: '/workflow/definitions', title: '工作流定义' },
  { path: '/workflow/designer', title: '编排设计器' },
  // Runs / 执行与观测
  { path: '/runs', title: '全部运行' },
  { path: '/monitor/job-instances', title: '作业运行' },
  { path: '/monitor/job-steps', title: '作业步骤' },
  { path: '/monitor/workflow-runs', title: '工作流运行' },
  // /logs 已 redirect 到 /observability/queries?tab=executionLogs,smoke 不再列
  { path: '/observability/alerts', title: /事件告警|告警/ },
  { path: '/observability/alert-routings', title: '告警路由（预留）' },
  { path: '/observability/trace', title: '链路诊断' },
  { path: '/observability/lineage', title: '血缘证据' },
  { path: '/observability/audits', title: '审计日志' },
  { path: '/observability/operation-audits', title: '操作审计' },
  { path: '/observability/outbox', title: 'Outbox' },
  { path: '/observability/queries', title: '综合查询' },
  { path: '/system/event-catalog', title: '事件目录' },
  // 调度与治理
  // /scheduler/catch-up-approvals 已 redirect 到 /approvals?tab=catch-up,smoke 不再列
  { path: '/scheduler/snapshot', title: '调度快照' },
  { path: '/scheduler/batch-days', title: '批次日与窗口' },
  { path: '/governance/windows', title: '批次窗口' },
  { path: '/governance/calendars', title: '业务日历' },
  { path: '/governance/quota', title: /配额策略|租户配额/ },
  { path: '/governance/queues', title: /队列/ },
  { path: '/workers/management', title: 'Worker' },
  { path: '/system/triggers', title: '触发器' },
  { path: '/ops/custom-task-types', title: /自定义\s*taskType|Custom\s*task\s*types/ },
  { path: '/ops/worker-fingerprints', title: 'Worker 指纹看板' },
  { path: '/ops/capacity-profile', title: '容量画像' },
  { path: '/ops/asset-freshness', title: '资产新鲜度策略' },
  { path: '/ops/shard-catalog', title: '分片目录' },
  { path: '/ops/tenant-placements', title: '租户分片' },
  { path: '/ops/batch-day-replay', title: '批次日重放' },
  // 系统
  { path: '/system/tenants', title: '租户实例' },
  { path: '/system/user-accounts', title: '登录账户' },
  { path: '/system/me', title: '我的账户' },
  { path: '/system/users', title: '权限自查' },
  { path: '/system/api-keys', title: 'API Key' },
  { path: '/system/parameters', title: '系统参数' },
  { path: '/system/notifications', title: '通知与投递' },
  {
    path: '/system/atomic-task-types',
    title: /Atomic\s*节点配置中心|Atomic\s*task\s*type\s*center/,
  },
]

export async function enterDemoApp(page: Page, locale: E2eLocale = 'zh-CN') {
  // 第一次访问任意页面前预置 localStorage:locale + onboarding 跳过。
  // 用 addInitScript 保证在每次 navigation 之前(含跳登录后回 ops/summary)都生效。
  // 本地存储键：
  //   - STORAGE_KEYS.locale           见 src/constants/locale.ts:1
  //   - STORAGE_KEYS.onboardingDone  见 src/composables/useOnboardingTour.ts:14
  await page.addInitScript((nextLocale: E2eLocale) => {
    try {
      localStorage.setItem(STORAGE_KEYS.locale, nextLocale)
      localStorage.setItem(STORAGE_KEYS.onboardingDone, '1')
    } catch {}
  }, locale)

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

  // URL 会在异步认证守卫完成前短暂命中；等页面主体渲染后再继续，避免后续 goto
  // 与守卫的 replace 导航互相取消。
  await expect(page.locator('.page-header .title, .m-page__title').first()).toBeVisible({
    timeout: 15_000,
  })

  // 兜底:如 driver overlay 已经渲染就移除
  await page.evaluate(() => {
    document
      .querySelectorAll('.driver-overlay, .driver-popover, .driver-active-element')
      .forEach((el) => el.remove())
  })
}

/** 为使用路由桩验证 AI 交互的用例补充能力；真实 AI 联测不得调用。 */
export async function grantAiCapability(page: Page) {
  await page.route('**/api/console/auth/me', async (route) => {
    const response = await route.fetch()
    const payload = (await response.json()) as {
      data?: { capabilities?: string[] }
    }
    if (payload.data) {
      payload.data.capabilities = Array.from(
        new Set([...(payload.data.capabilities ?? []), 'AI_ASSISTANT_USE']),
      )
    }
    await route.fulfill({ response, json: payload })
  })
}

export async function gotoAndAssertRoute(page: Page, route: RouteCheck) {
  await page.goto(route.path, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(new RegExp(escapeForRegex(route.path)), { timeout: 10_000 })
  await expectPageTitle(page, route.title)
}

export async function waitForRouteStable(page: Page, timeout = 15_000) {
  await expect(page.getByRole('progressbar').first()).toBeHidden({ timeout })
}

export async function expectPageTitle(page: Page, title: LocalizedExpectation) {
  await waitForRouteStable(page)
  const heading = page.locator('.page-header .title').first()
  // 部分页面(如 WorkflowDesigner 画布)没有 .page-header,直接放行
  const exists = await heading.count()
  if (exists === 0) return
  // 路由守卫 redirect 兜底:若实际渲染的是默认页(控制面板),直接给清晰错误,
  // 避免下游 button-not-visible / dialog-timeout 等误导性失败掩盖根因。
  const resolvedTitle = await resolveLocalizedExpectation(page, title)
  try {
    await expect(heading).toHaveText(resolvedTitle, { timeout: 10_000 })
  } catch (e) {
    const actual = (await heading.textContent({ timeout: 500 }).catch(() => null)) ?? ''
    const expected = resolvedTitle instanceof RegExp ? resolvedTitle.source : resolvedTitle
    if (actual.includes('控制面板') && !expected.includes('控制面板')) {
      throw new Error(
        `expectPageTitle: 期望 "${expected}",实际 "${actual}" — 页面被 router guard redirect 到控制面板,` +
          '通常意味着当前角色对该路由无权限 / tenant seed 不全。' +
          '不要在 e2e 层 mask:等 BE seed/ReservedPrefixGuard 决策落地后再开。' +
          `\nURL: ${page.url()}`,
      )
    }
    throw e
  }
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 定位器在给定超时时间内可见时返回 true。
 * 用于避免重复书写 `.isVisible({ timeout }).catch(() => false)`。
 */
export async function isVisible(locator: Locator, timeout = 3000): Promise<boolean> {
  return locator.isVisible({ timeout }).catch(() => false)
}

/**
 * 点击首个包含 `rowText` 的表格行操作按钮。
 * 在 `timeout` 内找不到匹配行时静默跳过。
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
 * 等待包含 `text` 的 El-Message 成功提示。
 */
export async function expectSuccessToast(page: Page, text: string | RegExp) {
  await expect(page.locator('.el-message--success')).toContainText(text)
}

/**
 * 进入列表页，并从首个 `.cell-link` 链接中返回数字 ID。
 * 表格无数据时返回 null，表示当前没有可用运行数据。
 *
 * 使用该方法，避免硬编码 `/monitor/job-instances/1` 一类 ID。
 */
export async function getFirstCellLinkId(page: Page, listPath: string): Promise<string | null> {
  await page.goto(listPath)
  const link = page.locator('.cell-link').first()
  if (!(await isVisible(link, 3000))) return null
  const href = await link.getAttribute('href')
  const match = href?.match(/\/(\d+)(?:[/?#]|$)/)
  return match ? match[1] : null
}
