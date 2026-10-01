import { expectPageTitle, enterDemoApp, test } from './support/app'
import { localized, type E2eLocale } from './support/i18n'

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
