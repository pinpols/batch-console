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
      const payload = await response.json()
      expect(response.status(), `${payload.code}: ${payload.message}`).toBe(404)
      expect(payload.code).toBe('NOT_FOUND')
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
      const payload = await response.json()
      expect(response.status(), `${payload.code}: ${payload.message}`).toBe(404)
      expect(payload.code).toBe('NOT_FOUND')
    }
    network.assertClean('AI conversation tenant and owner isolation')
  } finally {
    remove(ownId, 'ta')
    remove(otherOwnerId, 'ta')
    remove(otherTenantId, 'tb')
  }
})

test('switching and deleting conversations ignore older real history responses', async ({
  page,
  network,
}) => {
  const username = process.env.E2E_AI_USERNAME
  const password = process.env.E2E_AI_PASSWORD
  if (!username || !password) throw new Error('E2E_AI_USERNAME/PASSWORD are required')
  const login = await page.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': 'system' },
    data: { username, password },
  })
  expect(login.status()).toBe(200)
  const xsrfToken = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'XSRF-TOKEN',
  )?.value
  expect(xsrfToken).toBeTruthy()
  const headers = { 'X-Tenant-Id': 'ta', 'X-XSRF-TOKEN': xsrfToken! }
  const createdIds: string[] = []
  const create = async (prompt: string) => {
    const response = await page.request.post('/api/console/ai/chat', {
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      data: { tenantId: 'ta', contextVersion: 'v1', prompt },
    })
    const payload = await response.json()
    expect(response.status(), `${payload.code}: ${payload.message}`).toBe(200)
    const id = payload.data?.sessionId
    expect(id).toBeTruthy()
    createdIds.push(id)
    return id as string
  }
  const olderPrompt = `查询批量调度运行概况 old-${randomUUID()}`
  const newerPrompt = `查询批量调度运行概况 new-${randomUUID()}`

  let releaseOlder: (() => void) | undefined
  let releaseDeleted: (() => void) | undefined
  try {
    const olderId = await create(olderPrompt)
    const newerId = await create(newerPrompt)
    await page.addInitScript(() => {
      localStorage.setItem('batch-console-session', '1')
      localStorage.setItem('batch-console-tenant-id', 'ta')
      localStorage.setItem('batch-console:locale', 'zh-CN')
      localStorage.setItem('batch-console-onboarding-done', '1')
    })
    await page.goto('/system/ai-chat')
    const olderConversation = page.locator(
      `.conversation-list__item[data-conversation-id="${olderId}"]`,
    )
    const newerConversation = page.locator(
      `.conversation-list__item[data-conversation-id="${newerId}"]`,
    )
    await expect(olderConversation).toBeVisible()
    await expect(newerConversation).toBeVisible()
    const sidebarBounds = await page.locator('.conversation-list').boundingBox()
    const deleteBounds = await newerConversation
      .getByRole('button', { name: '删除会话' })
      .boundingBox()
    expect(sidebarBounds).not.toBeNull()
    expect(deleteBounds).not.toBeNull()
    expect(deleteBounds!.x + deleteBounds!.width).toBeLessThanOrEqual(
      sidebarBounds!.x + sidebarBounds!.width,
    )

    let intercepted!: () => void
    const olderFetched = new Promise<void>((resolve) => {
      intercepted = resolve
    })
    const holdOlder = new Promise<void>((resolve) => {
      releaseOlder = resolve
    })
    await page.route(`**/api/console/ai/conversations/${olderId}/turns?**`, async (route) => {
      const response = await route.fetch()
      intercepted()
      await holdOlder
      await route.fulfill({ response })
    })

    await olderConversation.locator('.conversation-list__open').click()
    await olderFetched
    await newerConversation.locator('.conversation-list__open').click()
    await expect(page.locator('.bubble__body')).toContainText([newerPrompt])

    const olderResponse = page.waitForResponse((response) =>
      response.url().includes(`/api/console/ai/conversations/${olderId}/turns`),
    )
    releaseOlder()
    expect((await olderResponse).status()).toBe(200)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await expect(page.locator('.bubble__body')).toContainText([newerPrompt])
    await expect(page.getByText(olderPrompt)).toHaveCount(0)

    let deletedFetched!: () => void
    const deletedRequest = new Promise<void>((resolve) => {
      deletedFetched = resolve
    })
    const holdDeleted = new Promise<void>((resolve) => {
      releaseDeleted = resolve
    })
    await page.route(`**/api/console/ai/conversations/${newerId}/turns?**`, async (route) => {
      const response = await route.fetch()
      deletedFetched()
      await holdDeleted
      await route.fulfill({ response })
    })
    await newerConversation.locator('.conversation-list__open').click()
    await deletedRequest
    await newerConversation.getByRole('button', { name: '删除会话' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click()
    await expect(newerConversation).toHaveCount(0)

    const deletedResponse = page.waitForResponse((response) =>
      response.url().includes(`/api/console/ai/conversations/${newerId}/turns`),
    )
    releaseDeleted()
    expect((await deletedResponse).status()).toBe(200)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await expect(page.getByText(newerPrompt)).toHaveCount(0)
    network.assertClean('AI real history response ordering')
  } finally {
    releaseOlder?.()
    releaseDeleted?.()
    for (const id of createdIds) {
      const response = await page.request.delete(`/api/console/ai/conversations/${id}`, {
        headers: { ...headers, 'Idempotency-Key': randomUUID() },
      })
      expect([200, 404], `cleanup conversation ${id}`).toContain(response.status())
    }
  }
})
