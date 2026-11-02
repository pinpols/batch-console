import { expect, test as browserTest } from '@playwright/test'
import { expectPageTitle, enterDemoApp, test } from './support/app'
import { e2eText, installE2eLocale, localized, type E2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'

const LOCALES: E2eLocale[] = ['zh-CN', 'en-US']
const CRITICAL_PAGES = [
  { path: '/ops/summary', title: localized('控制面板', /Operations|Dashboard|Summary/i) },
  { path: '/system/tenants', title: localized('租户实例', /Tenant/i) },
  { path: '/config/management', title: localized('变更与同步', /Change|Sync/i) },
  { path: '/monitor/job-instances', title: localized('作业运行', /Job|Instance/i) },
  { path: '/files/templates', title: localized('文件模板', /File|Template/i) },
]

test.describe('@slow i18n-critical-pages · bilingual smoke', () => {
  test.describe.configure({ mode: 'serial' })

  for (const locale of LOCALES) {
    test(`${locale} renders critical page titles`, async ({ page }) => {
      await enterDemoApp(page, locale)
      for (const target of CRITICAL_PAGES) {
        await page.goto(target.path, { waitUntil: 'domcontentloaded' })
        await expectPageTitle(page, target.title)
      }
    })
  }
})

browserTest.describe('date range layout', () => {
  browserTest.use({ serviceWorkers: 'block', storageState: { cookies: [], origins: [] } })

  browserTest.beforeEach(async ({ page }) => {
    await seedBrowserStorage(page, { session: '1', tenantId: 'tc', onboardingDone: '1' })
    await page.route('**/api/console/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const data =
        path === '/api/console/auth/me'
          ? {
              username: 'range-layout',
              tenantId: 'tc',
              authorities: ['ROLE_ADMIN'],
              menus: [
                {
                  key: 'test',
                  title: 'Test',
                  icon: '',
                  minRole: 'ADMIN',
                  children: [
                    { path: '/files/list', title: 'Files', icon: '', minRole: 'VIEWER' },
                    { path: '/observability/audits', title: 'Audits', icon: '', minRole: 'VIEWER' },
                    { path: '/monitor/job-instances', title: 'Jobs', icon: '', minRole: 'VIEWER' },
                  ],
                },
              ],
            }
          : { items: [], total: path === '/api/console/tenants' ? 1 : 0, pageNo: 1, pageSize: 15 }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'SUCCESS', message: 'ok', data }),
      })
    })
  })

  for (const locale of LOCALES) {
    for (const route of [
      '/files/list?desktop=1',
      '/observability/operation-audits?desktop=1',
      '/monitor/job-instances?desktop=1',
    ]) {
      browserTest(
        `date preset and range remain readable: ${route} (${locale})`,
        async ({ page }) => {
          browserTest.setTimeout(90_000)
          const resizeErrors: string[] = []
          page.on('pageerror', (error) => {
            if (error.message.includes('ResizeObserver loop')) resizeErrors.push(error.message)
          })
          await installE2eLocale(page, locale)
          await page.setViewportSize({ width: 1440, height: 900 })
          await page.goto(route)
          const query = page.locator('.query-form, .ops-filter-toolbar').first()
          const range = query.locator('.dr-preset').first()
          const preset = range.locator('.dr-preset__select')
          await expect(preset).toBeVisible({ timeout: 40_000 })
          await preset.click()
          await page
            .getByRole('option', { name: e2eText('dateRangePicker.last30d', locale), exact: true })
            .click()
          await page.evaluate(() => document.fonts.ready)

          for (const width of [1440, 1280, 1024, 768, 520, 375, 320]) {
            await page.setViewportSize({ width, height: 900 })
            await expect
              .poll(
                () =>
                  preset
                    .locator('.el-select__placeholder')
                    .evaluate((el) => el.scrollWidth - el.clientWidth),
                { message: `preset at ${width}px` },
              )
              .toBeLessThanOrEqual(1)
            for (const input of await range.locator('input.el-range-input').all()) {
              await expect(input).not.toHaveValue('')
              await expect
                .poll(() => input.evaluate((el) => el.scrollWidth - el.clientWidth), {
                  message: `date input at ${width}px`,
                })
                .toBeLessThanOrEqual(1)
            }
            const viewport = range.locator('.dr-preset__viewport')
            const hasLocalOverflow = await viewport.evaluate(
              (el) => el.scrollWidth > el.clientWidth + 1,
            )
            if (hasLocalOverflow) {
              await expect(viewport).toHaveAttribute('role', 'region')
              await expect(viewport).toHaveAttribute(
                'aria-label',
                e2eText('dateRangePicker.scrollRange', locale),
              )
              await viewport.focus()
              for (let i = 0; i < 5; i++) await viewport.press('ArrowRight')
              await expect(viewport).toBeFocused()
              await expect
                .poll(() => viewport.evaluate((el) => el.scrollLeft), {
                  message: `keyboard scroll at ${width}px`,
                })
                .toBeGreaterThan(0)
              for (let i = 0; i < 5; i++) await viewport.press('ArrowLeft')
              await expect
                .poll(() => viewport.evaluate((el) => el.scrollLeft), {
                  message: `keyboard scroll back at ${width}px`,
                })
                .toBe(0)
              await viewport.press('Tab')
              await expect(range.locator('input.el-range-input').first()).toBeFocused()
            } else {
              await expect(viewport).not.toHaveAttribute('tabindex', '0')
            }
            const layout = await range.evaluate((el) => {
              const bounds = el.getBoundingClientRect()
              return {
                width: bounds.width,
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
              }
            })
            expect(layout.width).toBeLessThanOrEqual(width)
            expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(1)
            await page.keyboard.press('Escape')
            const search = query.getByRole('button', {
              name: e2eText('common.search', locale),
              exact: true,
            })
            await expect(search).toBeVisible()
            await expect(search).toBeEnabled()
            await search.scrollIntoViewIfNeeded()
            const searchHit = await search.evaluate((el) => {
              const bounds = el.getBoundingClientRect()
              const target = document.elementFromPoint(
                bounds.left + bounds.width / 2,
                bounds.top + bounds.height / 2,
              )
              return {
                hit: target === el || (!!target && el.contains(target)),
                rect: bounds.toJSON(),
                target: target?.outerHTML.slice(0, 150),
              }
            })
            expect(searchHit.hit, `search button at ${width}px: ${JSON.stringify(searchHit)}`).toBe(
              true,
            )
          }
          expect(resizeErrors).toEqual([])
        },
      )
    }
  }

  browserTest('file list uses the mobile route by default on narrow screens', async ({ page }) => {
    await installE2eLocale(page, 'en-US')
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/files/list')
      await expect(page).toHaveURL(/\/m\/files(?:\?|$)/)
    }
  })

  browserTest(
    'operation audit remains available on its default route on narrow screens',
    async ({ page, browserName }) => {
      await installE2eLocale(page, 'en-US')
      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 800 })
        await page.goto('/observability/operation-audits')
        await expect(page).toHaveURL(/\/observability\/operation-audits(?:\?|$)/)
        const viewport = page.locator('.query-form .dr-preset__viewport').first()
        await expect(viewport).toHaveAttribute('role', 'region')
        await expect(viewport).toHaveAccessibleName(e2eText('dateRangePicker.scrollRange', 'en-US'))
        await viewport.focus()
        for (let i = 0; i < 5; i++) await viewport.press('ArrowRight')
        await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
        if (browserName === 'chromium') {
          await viewport.evaluate((el) => {
            el.scrollLeft = 0
          })
          await viewport.scrollIntoViewIfNeeded()
          const box = await viewport.boundingBox()
          expect(box).not.toBeNull()
          const cdp = await page.context().newCDPSession(page)
          await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
          await cdp.send('Input.synthesizeScrollGesture', {
            x: box!.x + box!.width / 2,
            y: box!.y + box!.height / 2,
            xDistance: -80,
            yDistance: 0,
            speed: 500,
            gestureSourceType: 'touch',
          })
          await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
          await cdp.detach()
        }
      }
    },
  )
})
