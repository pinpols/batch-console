import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { expect, test } from './support/app'
import { aiStreamEventData } from './support/aiStream'

test.use({ storageState: { cookies: [], origins: [] } })
test.skip(
  process.env.E2E_AI_PROVIDER_TIMEOUT !== '1',
  'Requires a local secure Console API configured with an unresponsive model endpoint',
)

function cleanupConversation(marker: string): void {
  const host = process.env.E2E_AI_DB_HOST ?? '127.0.0.1'
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('AI provider timeout test only cleans up on loopback PostgreSQL')
  }
  const username = process.env.BATCH_PLATFORM_DB_USERNAME
  const password = process.env.BATCH_PLATFORM_DB_PASSWORD
  if (!username || !password) throw new Error('Local PostgreSQL credentials are required')
  if (!/^e2e-[0-9a-f-]{36}$/.test(marker)) throw new Error('Unsafe AI fixture marker')
  const sql = `BEGIN; SELECT set_config('app.tenant_id', 'ta', true); DELETE FROM batch.console_ai_conversation AS conversation WHERE conversation.tenant_id = 'ta' AND EXISTS (SELECT 1 FROM batch.console_ai_turn AS turn WHERE turn.tenant_id = 'ta' AND turn.conversation_id = conversation.id AND turn.prompt_text LIKE '%${marker}%'); COMMIT;`
  execFileSync(process.env.PSQL_BIN ?? 'psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-Atqc', sql], {
    env: {
      ...process.env,
      PGHOST: host,
      PGPORT: process.env.E2E_AI_DB_PORT ?? '15432',
      PGDATABASE: process.env.E2E_AI_DB_NAME ?? 'batch_platform',
      PGUSER: username,
      PGPASSWORD: password,
    },
  })
}

test('backend model timeout is shown as a failed turn without discarding the prompt', async ({
  page,
  network,
}) => {
  test.setTimeout(60_000)
  const username = process.env.E2E_AI_USERNAME
  const password = process.env.E2E_AI_PASSWORD
  const modelPort = Number(process.env.E2E_AI_MODEL_STUB_PORT ?? '18182')
  if (!username || !password) throw new Error('E2E_AI_USERNAME/PASSWORD are required')
  if (!Number.isInteger(modelPort) || modelPort < 1024 || modelPort > 65535) {
    throw new Error('Invalid local model port')
  }
  const marker = `e2e-${randomUUID()}`
  const prompt = `查询批量调度作业运行状态 ${marker}`
  let modelRequests = 0
  const model = createServer(() => {
    modelRequests += 1
  })
  await new Promise<void>((resolve, reject) => {
    model.once('error', reject)
    model.listen(modelPort, '127.0.0.1', () => {
      model.off('error', reject)
      resolve()
    })
  })
  try {
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
    await page.goto('/system/ai-chat')
    await page.locator('.composer__editor textarea').fill(prompt)
    const chatResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/console/ai/chat/stream') &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: '发送' }).click()
    const response = await chatResponse
    const result = await aiStreamEventData<{ promptDecision: string; sessionId: string }>(
      response,
      'completed',
    )
    expect(modelRequests).toBeGreaterThan(0)
    expect(response.status()).toBe(200)
    expect(result.promptDecision).toBe('FAILED')
    expect(result.sessionId).toBeTruthy()
    await expect(page.locator('.gate-notice__tag')).toContainText('处理失败')
    await expect(page.locator('.composer__editor textarea')).toHaveValue(prompt)
    const answer = page.locator('.bubble--assistant .bubble__body')
    await expect(answer).not.toBeEmpty()
    const renderedAnswer = await answer.innerText()

    await page.reload()
    const conversation = page.locator(
      `.conversation-list__item[data-conversation-id="${result.sessionId}"]`,
    )
    await expect(conversation).toBeVisible()
    await conversation.locator('.conversation-list__open').click()
    await expect(page.locator('.gate-notice__tag')).toContainText('处理失败')
    await expect(page.locator('.bubble--user .bubble__body')).toHaveText(prompt)
    await expect(page.locator('.bubble--assistant .bubble__body')).toHaveText(renderedAnswer)
    network.assertClean('local model timeout')
  } finally {
    model.closeAllConnections()
    await new Promise<void>((resolve) => model.close(() => resolve()))
    cleanupConversation(marker)
  }
})
