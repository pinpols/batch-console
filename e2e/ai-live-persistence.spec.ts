import { randomUUID } from 'node:crypto'
import { expect, test } from './support/app'

test.use({ storageState: { cookies: [], origins: [] } })
test.skip(process.env.E2E_AI_LIVE !== '1', 'Requires a backend with AI and persistence enabled')

test('AI conversation survives reload and can be deleted', async ({ page }) => {
  const username = process.env.E2E_AI_USERNAME
  const password = process.env.E2E_AI_PASSWORD
  if (!username || !password) throw new Error('E2E_AI_USERNAME and E2E_AI_PASSWORD are required')

  const login = await page.request.post('/api/console/auth/login', {
    headers: { 'X-Tenant-Id': 'system' },
    data: { username, password },
  })
  expect(login.status()).toBe(200)
  const csrfProbe = await page.request.post('/api/console/queries/usage-summary', {
    headers: { 'X-Tenant-Id': 'ta' },
  })
  expect(csrfProbe.status(), 'AI live test requires CSRF enforcement').toBe(403)

  await page.addInitScript(() => {
    localStorage.setItem('batch-console-session', '1')
    localStorage.setItem('batch-console-tenant-id', 'ta')
    localStorage.setItem('batch-console:locale', 'zh-CN')
    localStorage.setItem('batch-console-onboarding-done', '1')
  })
  await page.goto('/system/ai-chat')
  await expect(page.locator('.composer__editor textarea')).toBeVisible()

  let sessionId: string | undefined
  try {
    const prompt = `查询批量调度运行概况 e2e-${randomUUID()}`
    await page.locator('.composer__editor textarea').fill(prompt)
    const chatResponse = page.waitForResponse((response) =>
      response.url().includes('/api/console/ai/chat') && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: '发送' }).click()
    const response = await chatResponse
    const payload = await response.json()
    expect(response.status(), `${payload.code}: ${payload.message}`).toBe(200)
    expect(payload.data.promptDecision).toBe('APPROVED')
    sessionId = payload.data.sessionId
    expect(sessionId).toBeTruthy()
    expect(payload.data.answer).toBeTruthy()
    await expect(page.locator('.bubble--user .bubble__body')).toHaveText(prompt)
    const answer = page.locator('.bubble--assistant .bubble__body')
    await expect(answer).not.toBeEmpty()
    const renderedAnswer = await answer.innerText()

    await page.reload()
    const conversation = page.locator(
      `.conversation-list__item[data-conversation-id="${sessionId}"]`,
    )
    await expect(conversation).toBeVisible()
    await conversation.locator('.conversation-list__open').click()
    await expect(page.locator('.bubble--user .bubble__body')).toHaveText(prompt)
    await expect(page.locator('.bubble--assistant .bubble__body')).toHaveText(renderedAnswer)

    await conversation.getByRole('button', { name: '删除会话' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click()
    await expect(conversation).toHaveCount(0)
  } finally {
    if (sessionId) {
      const xsrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')
      const cleanup = await page.request.delete(`/api/console/ai/conversations/${sessionId}`, {
        headers: {
          'X-Tenant-Id': 'ta',
          'X-XSRF-TOKEN': xsrf?.value ?? '',
          'Idempotency-Key': randomUUID(),
        },
      })
      expect([200, 404], `cleanup conversation ${sessionId}`).toContain(cleanup.status())
    }
  }
})
