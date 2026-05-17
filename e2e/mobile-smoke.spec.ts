/**
 * 移动端冒烟测试 — /m/* 11 个路由。
 * 用 mobile viewport 跑,确认每页可打开 / 不挂 ErrorBoundary / 不持续报 console error。
 */
import { devices } from '@playwright/test'
import { expect, test } from './support/app'

// 用 Pixel 5 (Android Chromium-based) 替代 iPhone 14 (webkit 未安装)
test.use({ ...devices['Pixel 5'] })

const MOBILE_ROUTES = [
  '/m/ops/summary',
  '/m/approvals',
  '/m/alerts',
  '/m/jobs',
  '/m/catchup',
  '/m/files',
  '/m/workers',
  '/m/outbox',
  '/m/logs',
]

test.describe('@cross-browser mobile /m/* 冒烟', () => {

  for (const route of MOBILE_ROUTES) {
    test(`移动端可打开 ${route}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 12_000 })
      // 不报组件渲染异常
      const boundary = page.locator('text=组件渲染异常')
      await expect(boundary).toHaveCount(0)
      // 没有未捕获的 JS 错误
      expect(errors, `pageerrors at ${route}: ${errors.join(' | ')}`).toHaveLength(0)
    })
  }
})
