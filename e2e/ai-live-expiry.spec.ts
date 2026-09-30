import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { expect, test } from './support/app'

test.use({ storageState: { cookies: [], origins: [] } })
test.skip(process.env.E2E_AI_EXPIRY !== '1', 'Requires local AI persistence and PostgreSQL')

function runSql(sql: string): string {
  const host = process.env.E2E_AI_DB_HOST ?? '127.0.0.1'
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('AI expiry test only writes to a loopback PostgreSQL host')
  }
  const username = process.env.BATCH_PLATFORM_DB_USERNAME
  const password = process.env.BATCH_PLATFORM_DB_PASSWORD
  if (!username || !password) throw new Error('BATCH_PLATFORM_DB_USERNAME/PASSWORD are required')
  return execFileSync(process.env.PSQL_BIN ?? 'psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-Atqc', sql], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: host,
      PGPORT: process.env.E2E_AI_DB_PORT ?? '15432',
      PGDATABASE: process.env.E2E_AI_DB_NAME ?? 'batch_platform',
      PGUSER: username,
      PGPASSWORD: password,
    },
  }).trim()
}

test('expired AI conversation rejects history and send without losing the draft', async ({ page, network }) => {
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

  const id = `e2e-ai-expiry-${randomUUID()}`
  const title = 'E2E expired conversation'
  runSql(`BEGIN; SELECT set_config('app.tenant_id', 'ta', true); INSERT INTO batch.console_ai_conversation (id, tenant_id, owner_user_id, title, context_version, expires_at) VALUES ('${id}', 'ta', '${owner}', '${title}', 'v1', CURRENT_TIMESTAMP + INTERVAL '1 hour'); COMMIT;`)
  try {
    network.ignoreIf((entry) =>
      entry.status === 404 &&
      (entry.url.includes(`/api/console/ai/conversations/${id}/turns`) ||
        entry.url.endsWith('/api/console/ai/chat')),
    )
    await page.addInitScript(() => {
      localStorage.setItem('batch-console-session', '1')
      localStorage.setItem('batch-console-tenant-id', 'ta')
      localStorage.setItem('batch-console:locale', 'zh-CN')
      localStorage.setItem('batch-console-onboarding-done', '1')
    })
    await page.goto('/system/ai-chat')
    const conversation = page.locator(`.conversation-list__item[data-conversation-id="${id}"]`)
    await expect(conversation).toBeVisible()
    expect((await page.context().cookies()).some((cookie) => cookie.name === 'XSRF-TOKEN')).toBe(true)
    const missingCsrf = await page.request.post('/api/console/ai/chat', {
      headers: { 'X-Tenant-Id': 'ta' },
      data: { tenantId: 'ta', contextVersion: 'v1', prompt: '查询批量调度运行状态' },
    })
    expect(missingCsrf.status()).toBe(403)

    runSql(`BEGIN; SELECT set_config('app.tenant_id', 'ta', true); UPDATE batch.console_ai_conversation SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE tenant_id = 'ta' AND id = '${id}'; COMMIT;`)
    const missing = page.waitForResponse((response) =>
      response.url().includes(`/api/console/ai/conversations/${id}/turns`),
    )
    await conversation.locator('.conversation-list__open').click()
    const response = await missing
    expect(response.status()).toBe(404)
    expect((await response.json()).code).toBe('NOT_FOUND')
    await expect(conversation).toHaveCount(0)
    await expect(page.locator('.history-error')).toContainText('会话不存在或已过期')

    runSql(`BEGIN; SELECT set_config('app.tenant_id', 'ta', true); UPDATE batch.console_ai_conversation SET expires_at = CURRENT_TIMESTAMP + INTERVAL '1 hour' WHERE tenant_id = 'ta' AND id = '${id}'; COMMIT;`)
    await page.reload()
    await expect(conversation).toBeVisible()
    await conversation.locator('.conversation-list__open').click()
    await expect(page.locator('.conversation-list__open.el-button--primary')).toBeVisible()

    runSql(`BEGIN; SELECT set_config('app.tenant_id', 'ta', true); UPDATE batch.console_ai_conversation SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE tenant_id = 'ta' AND id = '${id}'; COMMIT;`)
    const draft = '查询批量调度作业运行状态'
    await page.locator('.composer__editor textarea').fill(draft)
    const rejected = page.waitForResponse((result) =>
      result.url().endsWith('/api/console/ai/chat') && result.request().method() === 'POST',
    )
    await page.getByRole('button', { name: '发送' }).click()
    const sendResponse = await rejected
    expect(sendResponse.status()).toBe(404)
    expect((await sendResponse.json()).code).toBe('NOT_FOUND')
    await expect(page.locator('.composer__editor textarea')).toHaveValue(draft)
    await expect(page.locator('.composer .history-error')).toContainText('会话不存在或已过期')
    network.assertClean('expired AI conversation')
  } finally {
    runSql(`BEGIN; SELECT set_config('app.tenant_id', 'ta', true); DELETE FROM batch.console_ai_conversation WHERE tenant_id = 'ta' AND id = '${id}'; COMMIT;`)
  }
})
