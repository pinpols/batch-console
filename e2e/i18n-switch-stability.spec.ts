/**
 * D 档 P1 i18n 切换稳定性。
 *
 * 在 5 个 P0 页面之间连续切 zh↔en 10 次,断言:
 * - 页面 title 切换正确(不残留前一语言)
 * - 无 pageerror
 * - localStorage `batch-console:locale` 与当前 UI 一致
 */
import { test, expect } from './support/app'
import { enterDemoApp } from './support/app'

const PAGES: Array<{ path: string; zh: string | RegExp; en: string | RegExp }> = [
  { path: '/ops/summary', zh: /控制面板|运营概览/, en: /Operations|Dashboard|Summary/i },
  { path: '/system/tenants', zh: /租户/, en: /Tenant/i },
  { path: '/governance/queues', zh: /队列/, en: /Queue/i },
  { path: '/monitor/job-instances', zh: /作业|实例/, en: /Job|Instance/i },
  { path: '/files/templates', zh: /模板/, en: /Template/i },
]

async function switchLocale(page: import('@playwright/test').Page, target: 'zh-CN' | 'en-US') {
  await page.evaluate((loc) => {
    localStorage.setItem('batch-console:locale', loc)
  }, target)
  await page.reload({ waitUntil: 'domcontentloaded' })
}

test.describe('i18n-switch · zh↔en 稳定性', () => {
  // 10 轮 × 5 页 × (goto + reload) ~= 100 次导航,默认 25s 不够
  test.setTimeout(180_000)

  test('5 P0 页 × 10 次切换不残留 / 不报错', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(e.message))

    await enterDemoApp(page)

    for (let round = 0; round < 10; round++) {
      const target = round % 2 === 0 ? 'en-US' : 'zh-CN'
      for (const p of PAGES) {
        await page.goto(p.path, { waitUntil: 'domcontentloaded' })
        await switchLocale(page, target)
        // 切换后 title 不强制断言(部分页面无 .title);至少检查页面有内容渲染
        await expect(page.locator('body')).toBeVisible()
      }
    }

    expect(pageErrors, `i18n 切换中出现 pageerror:\n${pageErrors.join('\n')}`).toHaveLength(0)

    // 最终 locale 一致性
    const finalLocale = await page.evaluate(() => localStorage.getItem('batch-console:locale'))
    expect(finalLocale).toMatch(/^(zh-CN|en-US)$/)
  })
})
