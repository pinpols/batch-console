import { STORAGE_KEYS } from './support/storage'
import { createServer, type Server } from 'node:http'
import { expect, test } from './support/app'

test.use({ storageState: { cookies: [], origins: [] } })
test.skip(
  process.env.E2E_DEGRADATION_RECOVERY !== '1',
  'Requires an isolated Console API pointed at the local Trigger stub',
)

test('mobile banner clears after the backend reaches a recovered downstream', async ({
  page,
  network,
}) => {
  test.setTimeout(90_000)
  const username = process.env.E2E_DEGRADATION_USERNAME
  const password = process.env.E2E_DEGRADATION_PASSWORD
  if (!username || !password) throw new Error('E2E_DEGRADATION_USERNAME/PASSWORD are required')
  const port = Number(process.env.E2E_TRIGGER_STUB_PORT ?? '18181')
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Invalid local Trigger stub port')

  const login = await page.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': 'system' },
    data: { username, password },
  })
  expect(login.status()).toBe(200)
  await page.addInitScript(() => {
    localStorage.setItem(STORAGE_KEYS.session, '1')
    localStorage.setItem(STORAGE_KEYS.tenantId, 'ta')
    localStorage.setItem(STORAGE_KEYS.locale, 'zh-CN')
    localStorage.setItem(STORAGE_KEYS.onboardingDone, '1')
  })
  await page.clock.install()

  let server: Server | undefined
  try {
    const degradedResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/console/scheduler/status') &&
        response.request().method() === 'GET',
    )
    await page.goto('/m/ops/summary')
    const degraded = await degradedResponse
    expect(degraded.status()).toBe(200)
    expect(degraded.headers()['x-degraded-source']?.split(',')).toContain('trigger')
    await expect(page.locator('.degradation-banner')).toContainText('trigger')

    server = createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== '/api/triggers/management/scheduler-status') {
        response.writeHead(404).end()
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({ code: 'SUCCESS', message: 'success', data: { status: 'RUNNING' } }),
      )
    })
    const localServer = server
    await new Promise<void>((resolve, reject) => {
      localServer.once('error', reject)
      localServer.listen(port, '127.0.0.1', resolve)
    })

    const recoveredResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/console/scheduler/status') &&
        response.request().method() === 'GET',
    )
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    const recovered = await recoveredResponse
    expect(recovered.status()).toBe(200)
    expect(recovered.headers()['x-degraded-source']).toBeUndefined()
    expect((await recovered.json()).data.status).toBe('RUNNING')
    await expect(page.locator('.degradation-banner')).toContainText('trigger')
    await page.clock.fastForward(75_000)
    await expect(page.locator('.degradation-banner')).toHaveCount(0)
    network.assertClean('mobile controlled downstream recovery')
  } finally {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      )
    }
  }
})
