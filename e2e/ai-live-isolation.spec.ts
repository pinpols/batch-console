import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { expect, test } from './support/app'

test.use({ storageState: { cookies: [], origins: [] } })
test.skip(process.env.E2E_AI_ISOLATION !== '1', 'Requires local AI persistence and PostgreSQL')

function runTenantSql(tenantId: 'ta' | 'tb', sql: string): void {
  const host = process.env.E2E_AI_DB_HOST ?? '127.0.0.1'
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('AI isolation test only writes to a loopback PostgreSQL host')
  }
  const username = process.env.BATCH_PLATFORM_DB_USERNAME
  const password = process.env.BATCH_PLATFORM_DB_PASSWORD
  if (!username || !password) throw new Error('BATCH_PLATFORM_DB_USERNAME/PASSWORD are required')
  execFileSync(
    process.env.PSQL_BIN ?? 'psql',
    [
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-Atqc',
      `BEGIN; SET LOCAL app.tenant_id = '${tenantId}'; ${sql}; COMMIT;`,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PGHOST: host,
        PGPORT: process.env.E2E_AI_DB_PORT ?? '15432',
        PGDATABASE: process.env.E2E_AI_DB_NAME ?? 'batch_platform',
        PGUSER: username,
        PGPASSWORD: password,
      },
    },
  )
}

test('AI history excludes another owner and another tenant', async ({ page, network }) => {
  const username = process.env.E2E_AI_USERNAME
  const password = process.env.E2E_AI_PASSWORD
  if (!username || !password) throw new Error('E2E_AI_USERNAME/PASSWORD are required')
  const login = await page.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': 'system' },
    data: { username, password },
  })
  expect(login.status()).toBe(200)
  const profileResponse = await page.request.get('/api/console/auth/me', {
    headers: { 'X-Tenant-Id': 'ta' },
  })
  expect(profileResponse.status()).toBe(200)
  const profile = await profileResponse.json()
  const owner = profile.data?.username
  if (typeof owner !== 'string' || !/^[\w.@-]{1,64}$/.test(owner)) {
    throw new Error('Authenticated owner is unavailable or unsafe for the SQL fixture')
  }

  const ownId = `e2e-ai-own-${randomUUID()}`
  const otherOwnerId = `e2e-ai-owner-${randomUUID()}`
  const otherTenantId = `e2e-ai-tenant-${randomUUID()}`
  const insert = (id: string, tenantId: 'ta' | 'tb', userId: string) =>
    runTenantSql(
      tenantId,
      `INSERT INTO batch.console_ai_conversation (id, tenant_id, owner_user_id, title, context_version, expires_at) VALUES ('${id}', '${tenantId}', '${userId}', '${id}', 'v1', CURRENT_TIMESTAMP + INTERVAL '1 hour')`,
    )
  const remove = (id: string, tenantId: 'ta' | 'tb') =>
    runTenantSql(
      tenantId,
      `DELETE FROM batch.console_ai_conversation WHERE tenant_id = '${tenantId}' AND id = '${id}'`,
    )

  try {
    insert(ownId, 'ta', owner)
    insert(otherOwnerId, 'ta', `other-${randomUUID()}`)
    insert(otherTenantId, 'tb', owner)
    network.ignoreIf(
      (entry) => entry.status === 404 && entry.url.includes('/api/console/ai/conversations/'),
    )
    await page.addInitScript(() => {
      localStorage.setItem('batch-console-session', '1')
      localStorage.setItem('batch-console-tenant-id', 'ta')
      localStorage.setItem('batch-console:locale', 'zh-CN')
      localStorage.setItem('batch-console-onboarding-done', '1')
    })
    await page.goto('/system/ai-chat')
    await expect(
      page.locator(`.conversation-list__item[data-conversation-id="${ownId}"]`),
    ).toBeVisible()
    await expect(
      page.locator(`.conversation-list__item[data-conversation-id="${otherOwnerId}"]`),
    ).toHaveCount(0)
    await expect(
      page.locator(`.conversation-list__item[data-conversation-id="${otherTenantId}"]`),
    ).toHaveCount(0)

    for (const id of [otherOwnerId, otherTenantId]) {
      const response = await page.request.get(`/api/console/ai/conversations/${id}/turns`, {
        headers: { 'X-Tenant-Id': 'ta' },
      })
      expect(response.status()).toBe(404)
      expect((await response.json()).code).toBe('NOT_FOUND')
    }

    const xsrfToken = (await page.context().cookies()).find(
      (cookie) => cookie.name === 'XSRF-TOKEN',
    )?.value
    expect(xsrfToken).toBeTruthy()
    for (const id of [otherOwnerId, otherTenantId]) {
      const response = await page.request.post('/api/console/ai/chat', {
        headers: {
          'X-Tenant-Id': 'ta',
          'X-XSRF-TOKEN': xsrfToken!,
          'Idempotency-Key': randomUUID(),
        },
        data: {
          tenantId: 'ta',
          sessionId: id,
          contextVersion: 'v1',
          prompt: '查询批量调度作业运行状态',
        },
      })
      expect(response.status()).toBe(404)
      expect((await response.json()).code).toBe('NOT_FOUND')
    }
    network.assertClean('AI conversation tenant and owner isolation')
  } finally {
    remove(ownId, 'ta')
    remove(otherOwnerId, 'ta')
    remove(otherTenantId, 'tb')
  }
})
