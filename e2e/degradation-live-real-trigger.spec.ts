import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './support/app'

test.use({ storageState: { cookies: [], origins: [] } })
test.skip(
  process.env.E2E_REAL_TRIGGER_RECOVERY !== '1',
  'Requires an isolated Console API, a local Trigger JAR, and loopback PostgreSQL',
)

const sleep = (ms: number) => new Promise<void>((resolveSleep) => setTimeout(resolveSleep, ms))

async function stopTrigger(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'exit').catch(() => undefined)
  child.kill('SIGTERM')
  await Promise.race([exited, sleep(10_000)])
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await Promise.race([exited, sleep(5_000)])
  }
  if (child.exitCode === null && child.signalCode === null) {
    throw new Error('Isolated Trigger did not exit; refusing to drop its database')
  }
}

test('mobile degradation clears when a real isolated Trigger starts', async ({ page, network }) => {
  test.setTimeout(150_000)
  const username = process.env.E2E_DEGRADATION_USERNAME
  const password = process.env.E2E_DEGRADATION_PASSWORD
  const jar = resolve(process.env.E2E_REAL_TRIGGER_JAR ?? '')
  const host = process.env.E2E_TRIGGER_DB_HOST ?? '127.0.0.1'
  const dbPort = Number(process.env.E2E_TRIGGER_DB_PORT ?? '15432')
  const triggerPort = Number(process.env.E2E_REAL_TRIGGER_PORT ?? '18181')
  const adminUser = process.env.E2E_TRIGGER_DB_ADMIN_USERNAME
  const adminPassword = process.env.E2E_TRIGGER_DB_ADMIN_PASSWORD
  const appUser = process.env.BATCH_PLATFORM_DB_USERNAME
  const appPassword = process.env.BATCH_PLATFORM_DB_PASSWORD
  if (!username || !password || !adminUser || !adminPassword || !appUser || !appPassword) {
    throw new Error('Console login and local PostgreSQL admin/application credentials are required')
  }
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Real Trigger recovery only creates a database on loopback PostgreSQL')
  }
  if (!Number.isInteger(dbPort) || dbPort < 1024 || dbPort > 65535) {
    throw new Error('Invalid local PostgreSQL port')
  }
  if (!Number.isInteger(triggerPort) || triggerPort < 1024 || triggerPort > 65535) {
    throw new Error('Invalid local Trigger port')
  }
  if (!process.env.E2E_REAL_TRIGGER_JAR || !existsSync(jar)) {
    throw new Error('E2E_REAL_TRIGGER_JAR must point to a built local Trigger executable JAR')
  }
  const triggerUrl = `http://127.0.0.1:${triggerPort}`
  const portInUse = await fetch(`${triggerUrl}/actuator/health`, {
    signal: AbortSignal.timeout(1_000),
  }).then(
    () => true,
    () => false,
  )
  if (portInUse) throw new Error(`Trigger port ${triggerPort} must be unused before this test`)

  const login = await page.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': 'system' },
    data: { username, password },
  })
  expect(login.status()).toBe(200)
  await page.addInitScript(() => {
    localStorage.setItem('batch-console-session', '1')
    localStorage.setItem('batch-console-tenant-id', 'ta')
    localStorage.setItem('batch-console:locale', 'zh-CN')
    localStorage.setItem('batch-console-onboarding-done', '1')
  })
  await page.clock.install()

  const dbName = `e2e_trigger_${randomUUID().replaceAll('-', '').slice(0, 20)}`
  const pgEnv = {
    ...process.env,
    PGHOST: host,
    PGPORT: String(dbPort),
    PGDATABASE: 'postgres',
    PGUSER: adminUser,
    PGPASSWORD: adminPassword,
  }
  let databaseCreated = false
  let trigger: ChildProcess | undefined
  let triggerLog = ''
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

    execFileSync('createdb', ['-O', appUser, dbName], { env: pgEnv })
    databaseCreated = true
    trigger = spawn(
      'java',
      [
        '--enable-native-access=ALL-UNNAMED',
        '-XX:TieredStopAtLevel=1',
        '-XX:+UseSerialGC',
        '-Xshare:off',
        '-jar',
        jar,
        '--spring.profiles.active=local',
        `--server.port=${triggerPort}`,
        `--spring.datasource.url=jdbc:postgresql://${host}:${dbPort}/${dbName}`,
        '--batch.orchestrator.base-url=http://127.0.0.1:19998',
      ],
      {
        env: {
          ...process.env,
          BATCH_PLATFORM_DB_USERNAME: appUser,
          BATCH_PLATFORM_DB_PASSWORD: appPassword,
          BATCH_REDIS_HOST: '127.0.0.1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let spawnError: Error | undefined
    trigger.on('error', (error) => {
      spawnError = error
    })
    for (const stream of [trigger.stdout, trigger.stderr]) {
      stream?.on('data', (chunk: Buffer) => {
        triggerLog = `${triggerLog}${chunk.toString()}`.slice(-8_000)
      })
    }

    const deadline = Date.now() + 90_000
    let started = false
    while (Date.now() < deadline) {
      if (spawnError || trigger.exitCode !== null || trigger.signalCode !== null) {
        throw new Error(
          `Isolated Trigger exited before becoming ready: ${spawnError?.message ?? triggerLog}`,
        )
      }
      const status = await fetch(`${triggerUrl}/api/triggers/management/scheduler-status`, {
        signal: AbortSignal.timeout(1_500),
      })
        .then(async (response) => (response.ok ? (await response.json()).data?.status : null))
        .catch(() => null)
      if (status === 'STARTED') {
        started = true
        break
      }
      await sleep(500)
    }
    if (!started) throw new Error(`Isolated Trigger did not reach STARTED: ${triggerLog}`)

    const recoveredResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/console/scheduler/status') &&
        response.request().method() === 'GET',
    )
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    const recovered = await recoveredResponse
    expect(recovered.status()).toBe(200)
    expect(recovered.headers()['x-degraded-source']).toBeUndefined()
    expect((await recovered.json()).data.status).toBe('STARTED')
    await page.clock.fastForward(75_000)
    await expect(page.locator('.degradation-banner')).toHaveCount(0)
    network.assertClean('mobile real Trigger recovery')
  } finally {
    if (trigger) await stopTrigger(trigger)
    if (databaseCreated) execFileSync('dropdb', ['--if-exists', dbName], { env: pgEnv })
  }
})
