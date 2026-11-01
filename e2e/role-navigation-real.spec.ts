import { execFileSync } from 'node:child_process'
import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { PersistentWaitFixture } from './fixtures/runtime-progress/fixture'
import { requiredEnvironment } from './fixtures/closure-recovery/fixture'
import { pageTitleKey } from '../src/constants/pageMeta'

const enabled = process.env.E2E_ROLE_NAVIGATION_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns authentication and cleanup')

test.use({
  storageState: { cookies: [], origins: [] },
  serviceWorkers: 'block',
  trace: 'off',
  screenshot: 'off',
  video: 'off',
})
test.setTimeout(600_000)
test.skip(!enabled, 'Requires exclusive real-environment acceptance slot')

type Role = 'ADMIN' | 'AUDITOR' | 'TENANT_ADMIN' | 'TENANT_USER'
const roles: Role[] = ['ADMIN', 'AUDITOR', 'TENANT_ADMIN', 'TENANT_USER']
// 独立预期来自 docs/user-guide/role-page-matrix.md，而不是实现中的菜单过滤函数。
const routes: Array<{ path: string; allowed: Role[]; searchOnly?: boolean }> = [
  { path: '/jobs/definitions', allowed: roles },
  { path: '/monitor/workflow-runs', allowed: roles },
  { path: '/approvals', allowed: ['ADMIN', 'TENANT_ADMIN'] },
  { path: '/system/user-accounts', allowed: ['ADMIN', 'TENANT_ADMIN'] },
  { path: '/files/templates', allowed: ['ADMIN', 'AUDITOR', 'TENANT_ADMIN'] },
  { path: '/governance/queues', allowed: ['ADMIN'], searchOnly: true },
]

type CheckEvidence = { role: Role; surface: string; path: string; expected: string; actual: string }
type Observation = Record<string, unknown>

function withoutCredentials(error: unknown): unknown {
  if (error instanceof Error && /cookie:|authorization:|x-xsrf-token/i.test(error.message))
    return new Error(`${error.name}: 真实请求失败；认证请求头已省略`)
  return error
}

const mobileTabs: Array<{ path: string; allowed: Role[] }> = [
  { path: '/m/alerts', allowed: roles },
  { path: '/m/approvals', allowed: ['ADMIN', 'TENANT_ADMIN'] },
  { path: '/m/ops/summary', allowed: roles },
  { path: '/m/jobs', allowed: roles },
  { path: '/m/workers', allowed: ['ADMIN', 'TENANT_ADMIN'] },
]

/** 独立回读夹具不覆盖的认证审计和租户日用量；不改写 system 租户的共享聚合。 */
function authenticationResidue(fixture: PersistentWaitFixture) {
  const sql = `
SELECT json_build_object(
  'tenantUsageRows', (SELECT count(*) FROM batch.console_usage_daily WHERE tenant_id = :'tenant_id'),
  'loginAuditRows', (SELECT count(*) FROM batch.console_operation_audit
    WHERE aggregate_type = 'auth' AND action = 'auth.login'
      AND aggregate_id IN (:'admin_name', :'reader_name', :'auditor_name', :'user_name')),
  'logoutAuditRows', (SELECT count(*) FROM batch.console_operation_audit
    WHERE aggregate_type = 'auth' AND action = 'auth.logout'
      AND operator_id IN (:'admin_name', :'reader_name', :'auditor_name', :'user_name'))
);`
  const variables = {
    tenant_id: fixture.tenantId,
    admin_name: fixture.adminName,
    reader_name: fixture.readerName,
    auditor_name: fixture.auditorName,
    user_name: fixture.userName,
  }
  const args = [
    'exec',
    '-i',
    requiredEnvironment('E2E_CLOSURE_PG_CONTAINER'),
    'psql',
    '-X',
    '-qAt',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    requiredEnvironment('E2E_CLOSURE_PG_USER'),
    '-d',
    requiredEnvironment('E2E_CLOSURE_PG_DATABASE'),
  ]
  for (const [name, value] of Object.entries(variables)) args.push('-v', `${name}=${value}`)
  return JSON.parse(
    execFileSync('docker', args, { input: sql, encoding: 'utf8', timeout: 20_000 }).trim(),
  ) as Record<string, number>
}

/** 通过真实引导按钮完成当前身份的导览，关闭按钮不会写入完成状态。 */
async function completeOnboarding(page: Page, waitMs = 0) {
  const overlay = page.locator('.driver-overlay')
  if (waitMs) {
    try {
      await overlay.waitFor({ state: 'visible', timeout: waitMs })
    } catch {
      return
    }
  }
  for (let step = 0; step < 4 && (await overlay.isVisible()); step++)
    await page.locator('.driver-popover-next-btn').click()
  await expect(overlay).toBeHidden()
}

/** 首次引导可能在资料加载后迟到，完成导览后重试打开搜索。 */
async function openCommandPalette(page: Page) {
  const button = page.getByRole('button', { name: e2eText('nav.openCommandPalette') })
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await button.click({ timeout: 4000 })
      return
    } catch (error) {
      if (!(await page.locator('.driver-overlay').isVisible()) || attempt === 2) throw error
      await completeOnboarding(page)
    }
  }
}

async function checkNavigation(
  page: Page,
  role: Role,
  tenantId: string,
  checks: CheckEvidence[],
  observations: Observation[],
) {
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      const url = frame.url()
      if (url.startsWith('http'))
        observations.push({ role, type: 'navigation', path: new URL(url).pathname })
    }
  })
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (path === '/api/console/auth/me' || path === '/api/console/job-definitions')
      observations.push({ role, type: 'response', path, status: response.status() })
  })
  page.on('requestfailed', (request) => {
    const path = new URL(request.url()).pathname
    if (path === '/api/console/auth/me' || path === '/api/console/job-definitions')
      observations.push({
        role,
        type: 'request-failed',
        path,
        reason: request.failure()?.errorText,
      })
  })
  await installE2eLocale(page)
  await seedBrowserStorage(page, { session: '1', tenantId, onboardingDone: '1' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/ops/summary')
  await expect(page.locator('.layout-sidebar')).toBeVisible({ timeout: 30_000 })
  await completeOnboarding(page, 5000)
  const closeGroups = page.getByRole('button', { name: e2eText('nav.collapseAllGroups') })
  if (await closeGroups.isVisible()) await closeGroups.click()
  await page.getByRole('button', { name: e2eText('nav.expandAllGroups') }).click()

  for (const route of routes) {
    const allowed = route.allowed.includes(role)
    const sidebarAllowed = allowed && !route.searchOnly
    const sidebar = page.locator(`.nav__item[href="${route.path}"]`)
    if (sidebarAllowed) await expect.soft(sidebar, `${role} 侧栏 ${route.path}`).toBeVisible()
    else await expect.soft(sidebar, `${role} 侧栏 ${route.path}`).toHaveCount(0)
    checks.push({
      role,
      surface: 'sidebar',
      path: route.path,
      expected: sidebarAllowed ? 'visible' : 'absent',
      actual: (await sidebar.count())
        ? (await sidebar.first().isVisible())
          ? 'visible'
          : 'hidden'
        : 'absent',
    })

    await openCommandPalette(page)
    const search = page.getByRole('combobox', { name: e2eText('palette.placeholder') })
    const title = e2eText(pageTitleKey(route.path))
    await search.fill(title)
    const result = page.getByRole('option').filter({
      has: page.locator('.cp-item__title', { hasText: title }),
    })
    if (allowed) await expect.soft(result, `${role} 搜索 ${route.path}`).toBeVisible()
    else await expect.soft(result, `${role} 搜索 ${route.path}`).toHaveCount(0)
    checks.push({
      role,
      surface: 'search',
      path: route.path,
      expected: allowed ? 'visible' : 'absent',
      actual: (await result.count())
        ? (await result.first().isVisible())
          ? 'visible'
          : 'hidden'
        : 'absent',
    })
    await page.keyboard.press('Escape')
    await expect(search).toBeHidden()
  }

  await openCommandPalette(page)
  const search = page.getByRole('combobox', { name: e2eText('palette.placeholder') })
  const jobTitle = e2eText(pageTitleKey('/jobs/definitions'))
  await search.fill(jobTitle)
  const jobOption = page
    .getByRole('option')
    .filter({ has: page.locator('.cp-item__title', { hasText: jobTitle }) })
  const optionMeta = await jobOption.locator('.cp-item__meta').innerText()
  await jobOption.click()
  try {
    await expect(page, `${role} 搜索结果可进入作业定义`).toHaveURL(
      /\/jobs\/definitions(?:[?#]|$)/,
      { timeout: 20_000 },
    )
  } finally {
    observations.push({
      role,
      type: 'search-navigation',
      title: jobTitle,
      optionMeta,
      expectedPath: '/jobs/definitions',
      actualPath: new URL(page.url()).pathname,
    })
  }
  await page.locator('.nav__item[href="/monitor/workflow-runs"]').click()
  await expect(page, `${role} 侧栏可进入工作流运行`).toHaveURL(/\/monitor\/workflow-runs(?:[?#]|$)/)

  for (const route of routes) {
    await page.goto(route.path)
    if (route.allowed.includes(role)) {
      await expect
        .soft(page, `${role} URL ${route.path}`)
        .toHaveURL(new RegExp(`${route.path.replaceAll('/', '\\/')}(?:[?#]|$)`), {
          timeout: 20_000,
        })
    } else {
      await expect.soft(page, `${role} URL ${route.path}`).toHaveURL(/\/ops\/summary(?:[?#]|$)/, {
        timeout: 20_000,
      })
    }
    checks.push({
      role,
      surface: 'direct-url',
      path: route.path,
      expected: route.allowed.includes(role) ? route.path : '/ops/summary',
      actual: new URL(page.url()).pathname,
    })
  }
}

async function checkMobileNavigation(page: Page, role: Role, checks: CheckEvidence[]) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/m/ops/summary')
  await expect(page.locator('.mobile-tab-bar')).toBeVisible({ timeout: 30_000 })
  for (const tab of mobileTabs) {
    const allowed = tab.allowed.includes(role)
    const item = page.locator(`.mobile-tab[href="${tab.path}"]`)
    if (allowed) await expect.soft(item, `${role} 移动 Tab ${tab.path}`).toBeVisible()
    else await expect.soft(item, `${role} 移动 Tab ${tab.path}`).toHaveCount(0)
    checks.push({
      role,
      surface: 'mobile-tab',
      path: tab.path,
      expected: allowed ? 'visible' : 'absent',
      actual: (await item.count())
        ? (await item.first().isVisible())
          ? 'visible'
          : 'hidden'
        : 'absent',
    })
  }
  await page.locator('.mobile-tab[href="/m/jobs"]').click()
  await expect(page, `${role} 移动作业 Tab 可进入`).toHaveURL(/\/m\/jobs(?:[?#]|$)/)
  for (const tab of mobileTabs.filter((item) => !item.allowed.includes(role))) {
    await page.goto(tab.path)
    await expect
      .soft(page, `${role} 移动直链 ${tab.path}`)
      .toHaveURL(/\/m\/ops\/summary(?:[?#]|$)/, {
        timeout: 20_000,
      })
    checks.push({
      role,
      surface: 'mobile-direct-url',
      path: tab.path,
      expected: '/m/ops/summary',
      actual: new URL(page.url()).pathname,
    })
  }
}

test('四角色真实菜单、搜索、直链和后端权限', async ({ page, browser }, testInfo) => {
  const fixture = new PersistentWaitFixture()
  const contexts: BrowserContext[] = []
  const extraSessions: BrowserContext[] = []
  const checks: CheckEvidence[] = []
  const observations: Observation[] = []
  let cleanupEvidence: Record<string, number> | undefined
  let authResidue: Record<string, number> | undefined
  let adminContext: BrowserContext | undefined
  let tenantAdminLogged = false
  let primaryError: unknown
  try {
    fixture.prepare()
    fixture.prepareWaitRoles()
    const baseURL = String(testInfo.project.use.baseURL)
    adminContext = await browser.newContext({ baseURL, serviceWorkers: 'block' })
    contexts.push(adminContext)
    await fixture.login(adminContext.request)
    await fixture.login(page.request, true)
    tenantAdminLogged = true

    const pages: Record<Role, Page> = {
      ADMIN: await adminContext.newPage(),
      TENANT_ADMIN: page,
      AUDITOR: page,
      TENANT_USER: page,
    }
    for (const role of ['AUDITOR', 'TENANT_USER'] as const) {
      const context = await browser.newContext({ baseURL, serviceWorkers: 'block' })
      contexts.push(context)
      const response = await context.request.post('/api/console/auth/login', {
        headers: { 'X-Tenant-Id': fixture.tenantId },
        data: {
          username: role === 'AUDITOR' ? fixture.auditorName : fixture.userName,
          password: fixture.password,
        },
      })
      expect(response.status(), `${role} 真实登录`).toBe(200)
      extraSessions.push(context)
      pages[role] = await context.newPage()
    }

    for (const role of roles) {
      const rolePage = pages[role]
      const me = await rolePage.request.get('/api/console/auth/me', {
        headers: { 'X-Tenant-Id': fixture.tenantId },
      })
      expect(me.status(), `${role} 当前身份`).toBe(200)
      const body = await me.json()
      expect(body.data.authorities, `${role} authority`).toContain(`ROLE_${role}`)
      const menuPaths = (body.data.menus as Array<{ children: Array<{ path: string }> }>).flatMap(
        (group) => group.children.map((item) => item.path),
      )
      observations.push({
        role,
        type: 'profile',
        status: me.status(),
        authorities: body.data.authorities,
        jobDefinitionsAllowed: menuPaths.includes('/jobs/definitions'),
      })
      for (const endpoint of [
        { path: '/api/console/queues', allowed: role === 'ADMIN' },
        { path: '/api/console/users', allowed: role === 'ADMIN' || role === 'TENANT_ADMIN' },
      ]) {
        const response = await rolePage.request.get(endpoint.path, {
          headers: { 'X-Tenant-Id': fixture.tenantId },
          params: { tenantId: fixture.tenantId, pageNo: '1', pageSize: '1' },
        })
        expect
          .soft(response.status(), `${role} API ${endpoint.path}`)
          .toBe(endpoint.allowed ? 200 : 403)
        checks.push({
          role,
          surface: 'api',
          path: endpoint.path,
          expected: String(endpoint.allowed ? 200 : 403),
          actual: String(response.status()),
        })
      }
      await checkNavigation(rolePage, role, fixture.tenantId, checks, observations)
      await checkMobileNavigation(rolePage, role, checks)
    }
  } catch (error) {
    primaryError = withoutCredentials(error)
  } finally {
    const cleanupErrors: unknown[] = []
    for (const context of extraSessions) {
      try {
        const logout = await fixture.mutate(context.request, '/api/console/auth/logout', {})
        expect(logout.status(), '本例额外身份登出').toBeLessThan(400)
      } catch (error) {
        cleanupErrors.push(
          new Error(`本例额外身份登出失败：${error instanceof Error ? error.name : 'unknown'}`),
        )
      }
    }
    try {
      const cleanup = await fixture.finish(
        adminContext?.request ?? page.request,
        tenantAdminLogged ? page.request : undefined,
      )
      cleanupEvidence = cleanup
      expect(
        Object.values(cleanup).every((count) => count === 0),
        '本例身份与租户清理后零残留',
      ).toBe(true)
    } catch (error) {
      cleanupErrors.push(
        new Error(`本例夹具清理失败：${error instanceof Error ? error.name : 'unknown'}`),
      )
    } finally {
      try {
        authResidue = authenticationResidue(fixture)
      } catch (error) {
        cleanupErrors.push(error)
      }
      for (const context of contexts) await context.close()
      await testInfo.attach('role-navigation-evidence.json', {
        body: JSON.stringify(
          {
            checks,
            observations,
            fixtureCleanup: cleanupEvidence,
            authResidue,
            cleanupScope:
              'Fixture counts cover the owned accounts and business tenant; auth audit, daily usage and shared system aggregates require final disposal of the isolated environment.',
          },
          null,
          2,
        ),
        contentType: 'application/json',
      })
    }
    if (cleanupErrors.length)
      primaryError = new AggregateError(
        primaryError ? [primaryError, ...cleanupErrors] : cleanupErrors,
        '角色验收或清理失败',
      )
  }
  if (primaryError) throw primaryError
})
