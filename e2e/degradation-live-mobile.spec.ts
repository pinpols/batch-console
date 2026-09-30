import { expect, test } from './support/app'

test.use({ storageState: { cookies: [], origins: [] } })
test.skip(process.env.E2E_REAL_DEGRADATION !== '1', 'Requires a local backend with a degraded Trigger service')

test('mobile layout reports the backend Trigger degradation without visiting a scheduler page', async ({ page, network }) => {
  const username = process.env.E2E_DEGRADATION_USERNAME
  const password = process.env.E2E_DEGRADATION_PASSWORD
  if (!username || !password) throw new Error('E2E_DEGRADATION_USERNAME/PASSWORD are required')

  const login = await page.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': 'system' },
    data: { username, password },
  })
  expect(login.status()).toBe(200)
  const probe = await page.request.get('/api/console/scheduler/status', {
    headers: { 'X-Tenant-Id': 'ta' },
  })
  expect(probe.status()).toBe(200)
  expect(probe.headers()['x-degraded-source']?.split(',')).toContain('trigger')

  await page.addInitScript(() => {
    localStorage.setItem('batch-console-session', '1')
    localStorage.setItem('batch-console-tenant-id', 'ta')
    localStorage.setItem('batch-console:locale', 'zh-CN')
    localStorage.setItem('batch-console-onboarding-done', '1')
  })
  await page.setViewportSize({ width: 390, height: 800 })
  const statusResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/console/scheduler/status') && response.request().method() === 'GET',
  )
  await page.goto('/m/ops/summary')
  const response = await statusResponse
  expect(response.status()).toBe(200)
  expect(response.headers()['x-degraded-source']?.split(',')).toContain('trigger')
  const banner = page.locator('.degradation-banner')
  await expect(banner).toContainText('trigger')
  const bounds = await banner.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  network.assertClean('mobile real Trigger degradation')
})
