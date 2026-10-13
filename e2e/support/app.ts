import { STORAGE_KEYS } from './storage'
import { pageTitleKey } from '../../src/constants/pageMeta'
import { type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { test, expect } from './fixtures'
import {
  type E2eLocale,
  type LocalizedExpectation,
  E2E_DEFAULT_LOCALE,
  i18nKey,
  installE2eLocale,
  resolveLocalizedExpectation,
  setE2eLocale,
} from './i18n'
export { test, expect }

export async function csrfHeaders(request: APIRequestContext): Promise<Record<string, string>> {
  const { cookies } = await request.storageState()
  const token = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value
  return token ? { 'X-XSRF-TOKEN': token } : {}
}

export type RouteCheck = {
  path: string
  title?: LocalizedExpectation
}

function pageRoute(path: string): RouteCheck {
  return { path, title: i18nKey(pageTitleKey(path)) }
}

export const smokeRoutes: RouteCheck[] = [
  // 工作台
  pageRoute('/ops/summary'),
  pageRoute('/approvals'),
  pageRoute('/reports'),
  pageRoute('/self-service'),
  pageRoute('/ops/diagnostic'),
  // 配置与发布
  pageRoute('/config/releases'),
  pageRoute('/config/management'),
  pageRoute('/config/tenant-package'),
  pageRoute('/system/tags'),
  // 文件中心
  pageRoute('/files/list'),
  pageRoute('/files/templates'),
  pageRoute('/files/channels'),
  pageRoute('/files/arrival-groups'),
  pageRoute('/files/pipeline-obs'),
  // 定义与编排
  pageRoute('/jobs/definitions'),
  pageRoute('/jobs/pipelines'),
  pageRoute('/workflow/definitions'),
  pageRoute('/workflow/designer'),
  // Runs / 执行与观测
  pageRoute('/runs'),
  pageRoute('/monitor/job-instances'),
  pageRoute('/monitor/job-steps'),
  pageRoute('/monitor/workflow-runs'),
  // /logs 已 redirect 到 /observability/queries?tab=executionLogs,smoke 不再列
  pageRoute('/observability/alerts'),
  pageRoute('/observability/alert-routings'),
  pageRoute('/observability/trace'),
  pageRoute('/observability/lineage'),
  pageRoute('/observability/audits'),
  pageRoute('/observability/operation-audits'),
  pageRoute('/observability/outbox'),
  pageRoute('/observability/queries'),
  pageRoute('/system/event-catalog'),
  // 调度与治理
  // /scheduler/catch-up-approvals 已 redirect 到 /approvals?tab=catch-up,smoke 不再列
  pageRoute('/scheduler/snapshot'),
  pageRoute('/scheduler/batch-days'),
  pageRoute('/governance/windows'),
  pageRoute('/governance/calendars'),
  pageRoute('/governance/quota'),
  pageRoute('/governance/queues'),
  pageRoute('/workers/management'),
  pageRoute('/system/triggers'),
  pageRoute('/ops/custom-task-types'),
  pageRoute('/ops/worker-fingerprints'),
  pageRoute('/ops/capacity-profile'),
  pageRoute('/ops/asset-freshness'),
  pageRoute('/ops/shard-catalog'),
  pageRoute('/ops/tenant-placements'),
  pageRoute('/ops/batch-day-replay'),
  // 系统
  pageRoute('/system/tenants'),
  pageRoute('/system/user-accounts'),
  pageRoute('/system/me'),
  pageRoute('/system/users'),
  pageRoute('/system/api-keys'),
  pageRoute('/system/parameters'),
  pageRoute('/system/notifications'),
  pageRoute('/system/atomic-task-types'),
]

export async function enterDemoApp(page: Page, locale: E2eLocale = E2E_DEFAULT_LOCALE) {
  // 第一次访问任意页面前预置 localStorage:locale + onboarding 跳过。
  // 用 addInitScript 保证在每次 navigation 之前(含跳登录后回 ops/summary)都生效。
  // 本地存储键：
  //   - STORAGE_KEYS.locale           见 src/constants/locale.ts:1
  //   - STORAGE_KEYS.onboardingDone  见 src/composables/useOnboardingTour.ts:14
  await installE2eLocale(page, locale)
  await page.addInitScript(({ onboardingKey }) => {
    try {
      localStorage.setItem(onboardingKey, '1')
    } catch {}
  }, {
    onboardingKey: STORAGE_KEYS.onboardingDone,
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
  await expectPageTitle(page, route.title ?? i18nKey(pageTitleKey(route.path)))
}

export async function waitForRouteStable(page: Page, timeout = 15_000) {
  // 只等待路由切换指示器。页面内的表格、图表和 onboarding 进度条可能长期可见，
  // 不代表路由仍在加载；用通用 role=progressbar 会让页面标题巡检误超时。
  await expect(page.locator('.route-progress')).toBeHidden({ timeout })
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
