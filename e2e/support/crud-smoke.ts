/**
 * 只读页面 0-4xx/5xx 烟雾测试 helpers。
 * 用于在没有 CRUD 入口的页面(monitor 列表/详情、运维 panel、审计、目录等)
 * 验证「进页面 → 翻页 → 切 tab」一路不掉服务端错误。
 */
import { type Page, expect } from '@playwright/test'
import type { NetworkWatchdog } from './fixtures'
import { enterDemoApp, isVisible } from './app'

export type ReadOnlySmokeOptions = {
  /** 路由路径,如 /monitor/job-instances */
  path: string
  /** 页面标题文案(精确或正则),用于断言进入了正确页面 */
  title: string | RegExp
  /** 页面里期望可见的关键元素文案 (可选) */
  expectVisibleText?: string | RegExp
  /** 切到的 tab 名(可多个) */
  tabs?: (string | RegExp)[]
  /** 期望忽略的 URL 子串/正则(如详情非必需接口) */
  ignoreUrls?: (string | RegExp)[]
}

/**
 * 进入页面 → 等列表/主体出现 → 依次切 tab → 翻一页(若有分页)→ assertClean。
 */
export async function readOnlyPageSmoke(
  page: Page,
  network: NetworkWatchdog,
  opts: ReadOnlySmokeOptions,
): Promise<void> {
  for (const u of opts.ignoreUrls ?? []) network.ignore(u)

  await enterDemoApp(page)
  await page.goto(opts.path)

  // 等页面标题/关键元素出现
  await expect(page.getByText(opts.title).first()).toBeVisible({ timeout: 8000 })
  if (opts.expectVisibleText) {
    await expect(page.getByText(opts.expectVisibleText).first()).toBeVisible({ timeout: 8000 })
  }
  // 等一拍让 list/接口都打完
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

  for (const tab of opts.tabs ?? []) {
    const t = page.getByRole('tab', { name: tab }).first()
    if (await isVisible(t, 1500)) {
      await t.click({ force: true }).catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    }
  }

  // 翻页:el-pagination 的"下一页"按钮
  const next = page.locator('.el-pagination .btn-next').first()
  if (await isVisible(next, 1000)) {
    const disabled = await next.getAttribute('disabled')
    if (disabled === null) {
      await next.click({ force: true }).catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    }
  }

  network.assertClean(opts.path)
}
