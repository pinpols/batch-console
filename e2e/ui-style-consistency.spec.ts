import { expect, test } from './support/app'
import { enterDemoApp, smokeRoutes, waitForRouteStable } from './support/app'

const REPRESENTATIVE_ROUTES = [
  '/ops/summary',
  '/monitor/job-instances',
  '/observability/alerts',
  '/observability/outbox',
  '/config/tenant-package',
  '/config/management',
  '/workflow/designer',
  '/system/user-accounts',
]

type AuditIssue = {
  route: string
  message: string
}

async function setTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.evaluate((value) => localStorage.setItem('batch-console:theme', value), theme)
  await page.reload({ waitUntil: 'domcontentloaded' })
  if (theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/dark/)
  } else {
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  }
}

async function auditRoute(page: import('@playwright/test').Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await waitForRouteStable(page, 20_000)
  await expect(page.locator('body')).toBeVisible()

  return page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    hasErrorBoundary: Array.from(document.querySelectorAll('body *')).some((element) =>
      /组件渲染异常|Component render error/i.test(element.textContent ?? ''),
    ),
  }))
}

test.describe('@slow @ui-style 页面 UI 一致性', () => {
  test.setTimeout(900_000)
  test.use({ viewport: { width: 1440, height: 900 } })

  test('全导航页深色模式无页面级横向溢出、渲染异常或 Vue 警告', async ({ page }) => {
    const issues: AuditIssue[] = []
    let currentRoute = '/ops/summary'

    page.on('pageerror', (error) => {
      issues.push({ route: currentRoute, message: `pageerror: ${error.message}` })
    })
    page.on('console', (message) => {
      const text = message.text()
      if (
        message.type() === 'warning' &&
        /(Vue warn|Invalid prop|Extraneous non-props attributes)/i.test(text)
      ) {
        issues.push({ route: currentRoute, message: `console warning: ${text.slice(0, 500)}` })
      }
    })

    await enterDemoApp(page)
    await setTheme(page, 'dark')

    for (const route of smokeRoutes) {
      currentRoute = route.path
      const result = await auditRoute(page, route.path)
      if (result.overflow > 2) {
        issues.push({ route: route.path, message: `viewport overflow: ${result.overflow}px` })
      }
      if (result.hasErrorBoundary) {
        issues.push({ route: route.path, message: 'render error boundary is visible' })
      }
    }

    expect(issues, JSON.stringify(issues, null, 2)).toHaveLength(0)
  })

  test('代表页面浅色模式保持同一布局边界', async ({ page }) => {
    const issues: AuditIssue[] = []
    await enterDemoApp(page)
    await setTheme(page, 'light')

    for (const route of REPRESENTATIVE_ROUTES) {
      const result = await auditRoute(page, route)
      if (result.overflow > 2) {
        issues.push({ route, message: `viewport overflow: ${result.overflow}px` })
      }
      if (result.hasErrorBoundary) issues.push({ route, message: 'render error boundary is visible' })
    }

    expect(issues, JSON.stringify(issues, null, 2)).toHaveLength(0)
  })
})
