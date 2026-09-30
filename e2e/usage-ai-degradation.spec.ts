import { expect, test } from './support/app'
import { enterDemoApp } from './support/app'
import { request as apiRequest } from '@playwright/test'

test.describe('Usage, AI and degradation', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('usage page shows backend aggregate totals without counting UI events as successful operations', async ({ page }) => {
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/console/queries/usage-summary') && response.request().method() === 'GET',
    )
    await page.goto('/observability/usage')
    const response = await responsePromise
    expect(response.status()).toBe(200)
    const payload = await response.json()
    expect(Array.isArray(payload.data)).toBe(true)
    const businessRows = payload.data.filter((row: { source: string }) => row.source !== 'FRONTEND')
    const successes = businessRows.reduce((sum: number, row: { successCount: number }) => sum + row.successCount, 0)
    const failures = businessRows.reduce((sum: number, row: { failureCount: number }) => sum + row.failureCount, 0)
    await expect(page.locator('.usage-total').filter({ hasText: '成功事件数' }).locator('strong')).toHaveText(successes.toLocaleString())
    await expect(page.locator('.usage-total').filter({ hasText: '失败事件数' }).locator('strong')).toHaveText(failures.toLocaleString())
    await expect(page.locator('.usage-note')).toContainText('不含作业或文件最终结果')
  })

  test('usage version filter updates totals and rows without changing metric codes', async ({ page }) => {
    await page.route('**/api/console/queries/usage-summary?**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'SUCCESS',
        message: 'success',
        data: [
          { statDate: '2026-09-30', tenantId: 'ta', source: 'OPERATION_AUDIT', metricCode: 'operation.job-trigger', pageCode: '', appVersion: 'v1', eventCount: 2, successCount: 2, failureCount: 0 },
          { statDate: '2026-09-30', tenantId: 'ta', source: 'OPERATION_AUDIT', metricCode: 'operation.job-trigger', pageCode: '', appVersion: 'v2', eventCount: 4, successCount: 3, failureCount: 1 },
        ],
      }),
    }))
    await page.goto('/observability/usage')
    await expect(page.locator('.usage-table .el-table__row')).toHaveCount(2)
    await expect(page.locator('.usage-total').first().locator('strong')).toHaveText('6')

    await page.locator('.usage-table-head .el-select').click()
    await page.getByRole('option', { name: 'v2' }).click()
    await expect(page.locator('.usage-table .el-table__row')).toHaveCount(1)
    await expect(page.locator('.usage-table .el-table__row')).toContainText('operation.job-trigger')
    await expect(page.locator('.usage-table .el-table__row')).toContainText('v2')
    await expect(page.locator('.usage-total').first().locator('strong')).toHaveText('4')
    await expect(page.locator('.usage-total').filter({ hasText: '成功事件数' }).locator('strong')).toHaveText('3')
    await expect(page.locator('.usage-total').filter({ hasText: '失败事件数' }).locator('strong')).toHaveText('1')
  })

  test('usage page ignores a previous tenant response after switching tenants', async ({ page }) => {
    let releasePrevious!: () => void
    let previousRequested!: () => void
    const previousGate = new Promise<void>((resolve) => { releasePrevious = resolve })
    const previousRequest = new Promise<void>((resolve) => { previousRequested = resolve })
    await page.route('**/api/console/tenants?**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: {
        total: 2, pageNo: 1, pageSize: 50,
        items: [
          { tenantId: 'ta', tenantName: 'Tenant A', status: 'ACTIVE' },
          { tenantId: 'tb', tenantName: 'Tenant B', status: 'ACTIVE' },
        ],
      } }),
    }))
    await page.route('**/api/console/queries/usage-summary?**', async (route) => {
      const tenantId = new URL(route.request().url()).searchParams.get('tenantId')
      if (tenantId === 'ta') {
        previousRequested()
        await previousGate
      }
      const metricCode = tenantId === 'tb' ? 'operation.tb-only' : 'operation.ta-only'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: [{
          statDate: '2026-09-30', tenantId, source: 'OPERATION_AUDIT', metricCode,
          pageCode: '', appVersion: '', eventCount: 1, successCount: 1, failureCount: 0,
        }] }),
      })
    })

    try {
      await page.goto('/observability/usage')
      await previousRequest
      await page.getByRole('combobox', { name: '切换租户' }).fill('tb')
      await page.getByRole('option', { name: /tb/ }).click()
      await expect(page.locator('.usage-table .el-table__row')).toContainText('operation.tb-only')
      const previousResponse = page.waitForResponse((response) =>
        response.url().includes('/api/console/queries/usage-summary') &&
        new URL(response.url()).searchParams.get('tenantId') === 'ta',
      )
      releasePrevious()
      await previousResponse
      await page.evaluate(() => new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ))
      await expect(page.locator('.usage-table .el-table__row')).not.toContainText('operation.ta-only')
      await expect(page.locator('.usage-total').first().locator('strong')).toHaveText('1')
    } finally {
      releasePrevious()
    }
  })

  test('audit page links directly to the usage report', async ({ page }) => {
    await page.goto('/observability/audits')
    await page.getByRole('button', { name: '使用率' }).click()
    await expect(page).toHaveURL(/\/observability\/usage$/)
    await expect(page.locator('.usage-total')).toHaveCount(3)
  })

  test('global AI launcher sends a versioned page context and preserves the draft on server refusal', async ({ page, network }) => {
    network.ignore('/api/console/ai/')
    const launcher = page.getByRole('button', { name: '打开 AI 助手' })
    await expect(launcher).toBeVisible()
    await launcher.click()
    await page.getByText('当前页面', { exact: true }).click()
    const drawer = page.locator('.ai-assistant-drawer')
    const prompt = drawer.getByRole('textbox', { name: '问题' })
    await prompt.fill('查询当前批量调度运行概况')
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/console/ai/chat') && response.request().method() === 'POST',
    )
    await drawer.getByRole('button', { name: '发送' }).click()
    const response = await responsePromise
    const body = response.request().postDataJSON()
    expect(body.contextVersion).toBe('v1')
    expect(body.pageContext).toEqual({ pageType: 'ops-summary' })
    expect(body.pageContext.objectId).toBeUndefined()
    if (response.ok()) {
      const payload = await response.json()
      expect(payload.data.sessionId).toBeTruthy()
      await expect(drawer.getByText(payload.data.answer)).toBeVisible()
    } else {
      expect([403, 429, 503]).toContain(response.status())
      const expectedMessage = response.status() === 403 ? '请求被拒绝' : response.status() === 429 ? '请求受限' : 'AI 服务暂不可用'
      await expect(drawer.getByRole('alert')).toContainText(expectedMessage)
      await expect(prompt).toHaveValue('查询当前批量调度运行概况')
    }
  })

  test('mobile AI drawer keeps the composer visible and returns focus on close', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/m/ops/summary')
    const launcher = page.getByRole('button', { name: '打开 AI 助手' })
    await expect(launcher).toBeVisible()
    await launcher.click()
    const drawer = page.locator('.ai-assistant-drawer')
    const prompt = drawer.getByRole('textbox', { name: '问题' })
    await expect(prompt).toBeFocused()
    await expect(drawer.getByRole('button', { name: '发送' })).toBeVisible()
    const bounds = await drawer.evaluate((element) => {
      const drawerBounds = element.getBoundingClientRect()
      const inputBounds = element.querySelector('textarea')!.getBoundingClientRect()
      return {
        drawerFits: drawerBounds.left >= 0 && drawerBounds.right <= window.innerWidth,
        inputFits: inputBounds.left >= 0 && inputBounds.right <= window.innerWidth && inputBounds.bottom <= window.innerHeight,
      }
    })
    expect(bounds).toEqual({ drawerFits: true, inputFits: true })
    await drawer.locator('.el-drawer__close-btn').click()
    await expect(drawer).toBeHidden()
    await expect(launcher).toBeFocused()
  })

  test('AI Markdown renders safely and copies a code block', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.route('**/api/console/ai/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'success',
          data: {
            sessionId: 'markdown-session',
            requestId: 'markdown-request',
            traceId: 'markdown-trace',
            promptCategory: 'OPERATIONS',
            promptDecision: 'APPROVED',
            modelName: 'test',
            answer: '**诊断完成**\n\n```sh\necho ok\n```\n\n<img src=x onerror=alert(1)>',
            refusalReason: null,
          },
        }),
      }),
    )
    await page.getByRole('button', { name: '打开 AI 助手' }).click()
    const drawer = page.locator('.ai-assistant-drawer')
    await drawer.getByRole('textbox', { name: '问题' }).fill('如何检查作业')
    await drawer.getByRole('button', { name: '发送' }).click()
    await expect(drawer.locator('.ai-message-content__markdown strong')).toHaveText('诊断完成')
    await expect(drawer.locator('.ai-markdown__code code')).toHaveText('echo ok')
    await expect(drawer.locator('.ai-message-content__markdown img')).toHaveCount(0)
    await drawer.getByRole('button', { name: '复制代码' }).click()
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('echo ok\n')
  })

  test('AI rate limiting keeps the draft ready for retry', async ({ page, network }) => {
    network.ignore('/api/console/ai/chat')
    await page.route('**/api/console/ai/chat', (route) => route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'RATE_LIMITED', message: 'error.ai.rate_limited' }),
    }))
    await page.getByRole('button', { name: '打开 AI 助手' }).click()
    const drawer = page.locator('.ai-assistant-drawer')
    const prompt = drawer.getByRole('textbox', { name: '问题' })
    await prompt.fill('分析当前作业失败')
    await drawer.getByRole('button', { name: '发送' }).click()
    await expect(drawer.getByRole('alert')).toContainText('请求受限')
    await expect(prompt).toHaveValue('分析当前作业失败')
  })

  test('AI preserves the draft when a previously created session expires', async ({ page, network }) => {
    network.ignore('/api/console/ai/chat')
    let requests = 0
    await page.route('**/api/console/ai/chat', async (route) => {
      requests += 1
      if (requests === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: { sessionId: 'expired-session', requestId: 'request-1', traceId: 'trace-1', promptCategory: 'OPERATIONS', promptDecision: 'APPROVED', modelName: 'test', answer: '第一答', refusalReason: null } }),
        })
      } else {
        expect(route.request().postDataJSON().sessionId).toBe('expired-session')
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'NOT_FOUND', message: 'error.common.not_found_detail', data: null }),
        })
      }
    })

    await page.getByRole('button', { name: '打开 AI 助手' }).click()
    const drawer = page.locator('.ai-assistant-drawer')
    const prompt = drawer.getByRole('textbox', { name: '问题' })
    await prompt.fill('第一问')
    await drawer.getByRole('button', { name: '发送' }).click()
    await expect(drawer.getByText('第一答')).toBeVisible()
    await prompt.fill('第二问')
    await drawer.getByRole('button', { name: '发送' }).click()
    await expect(drawer.getByRole('alert')).toContainText('会话不存在或已过期')
    await expect(prompt).toHaveValue('第二问')
    expect(requests).toBe(2)
  })

  test('AI history restores ordered turns and deletes a conversation with routed responses', async ({ page }) => {
    let deleted = false
    await page.route('**/api/console/ai/conversations**', async (route) => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()
      const now = '2026-09-30T00:00:00Z'
      let data: unknown = null
      if (path.endsWith('/conversations/page') && method === 'GET') {
        data = { total: 0, pageNo: 0, pageSize: 20, items: deleted ? [] : [{ id: 'session-1', title: '作业诊断', contextVersion: 'v1', createdAt: now, updatedAt: now, expiresAt: now }], nextCursor: null, hasMore: false }
      } else if (path.endsWith('/session-1/turns') && method === 'GET') {
        data = [
          { turnNo: 4, contextVersion: 'v1', prompt: '第四问', response: null, status: 'REJECTED', promptDecision: 'REJECTED_BUDGET', modelName: null, promptTokens: null, completionTokens: null, estimatedCostUsd: null, createdAt: now, completedAt: now },
          { turnNo: 3, contextVersion: 'v1', prompt: '第三问', response: null, status: 'IN_PROGRESS', promptDecision: null, modelName: null, promptTokens: null, completionTokens: null, estimatedCostUsd: null, createdAt: now, completedAt: null },
          { turnNo: 2, contextVersion: 'v1', prompt: '第二问', response: '第二答', status: 'COMPLETE', promptDecision: 'APPROVED', modelName: 'test', promptTokens: 1, completionTokens: 1, estimatedCostUsd: 0, createdAt: now, completedAt: now },
          { turnNo: 1, contextVersion: 'v1', prompt: '第一问', response: '第一答', status: 'COMPLETE', promptDecision: 'APPROVED', modelName: 'test', promptTokens: 1, completionTokens: 1, estimatedCostUsd: 0, createdAt: now, completedAt: now },
        ]
      } else if (path.endsWith('/session-1') && method === 'DELETE') {
        deleted = true
      } else {
        await route.continue()
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data }) })
    })
    await page.route('**/api/console/ai/cost-summary**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: { month: '2026-09', requestCount: 2, promptTokens: 2, completionTokens: 2, estimatedCostUsd: 0.01, reservedCostUsd: 0, monthlyBudgetUsd: 0 } }),
    }))
    await page.goto('/system/ai-chat')
    await page.getByRole('button', { name: '作业诊断' }).click()
    await expect(page.locator('.bubble__body')).toHaveText(['第一问', '第一答', '第二问', '第二答', '第三问', '回答仍在生成中。', '第四问', '本次请求未获批准。'])
    await expect(page.locator('.gate-notice__tag')).toHaveText('预算限制')
    await page.getByRole('button', { name: '删除会话' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click()
    await expect(page.getByRole('button', { name: '作业诊断' })).toHaveCount(0)
  })

  test('AI conversation history loads older owner-scoped pages', async ({ page }) => {
    const now = '2026-09-30T00:00:00Z'
    const queriedCursors: string[] = []
    let olderPageFailures = 0
    await page.route('**/api/console/ai/conversations/page**', async (route) => {
      const cursor = new URL(route.request().url()).searchParams.get('cursor') ?? ''
      queriedCursors.push(cursor)
      if (cursor && olderPageFailures++ < 3) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'SYSTEM_ERROR', message: 'unavailable' }) })
        return
      }
      const items = cursor
        ? [{ id: 'session-older', title: '较早会话', contextVersion: 'v1', createdAt: now, updatedAt: now, expiresAt: now }]
        : [{ id: 'session-newer', title: '最近会话', contextVersion: 'v1', createdAt: now, updatedAt: now, expiresAt: now }]
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: { total: 0, pageNo: 0, pageSize: 20, items, nextCursor: cursor ? null : 'cursor-1', hasMore: !cursor } }) })
    })
    await page.route('**/api/console/ai/cost-summary**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: null }) }))

    await page.goto('/system/ai-chat')
    await expect(page.getByRole('button', { name: '最近会话' })).toBeVisible()
    await page.getByRole('button', { name: '加载更早的会话' }).click()
    await expect(page.locator('.conversation-list').getByRole('alert')).toBeVisible()
    await expect(page.getByRole('button', { name: '最近会话' })).toBeVisible()
    await page.getByRole('button', { name: '加载更早的会话' }).click()
    await expect(page.getByRole('button', { name: '较早会话' })).toBeVisible()
    await expect(page.locator('.conversation-list').getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '加载更早的会话' })).toHaveCount(0)
    expect(queriedCursors).toEqual(['', 'cursor-1', 'cursor-1', 'cursor-1', 'cursor-1'])
  })

  test('AI conversation history can retry after the initial page is unavailable', async ({ page }) => {
    let failedRequests = 0
    await page.route('**/api/console/ai/conversations/page**', async (route) => {
      if (failedRequests++ < 3) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'SYSTEM_ERROR', message: 'unavailable' }) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: { total: 0, pageNo: 0, pageSize: 20, items: [{ id: 'session-recovered', title: '恢复会话', contextVersion: 'v1', createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z', expiresAt: '2026-10-30T00:00:00Z' }], nextCursor: null, hasMore: false } }) })
    })
    await page.route('**/api/console/ai/cost-summary**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: null }) }))

    await page.goto('/system/ai-chat')
    await expect(page.locator('.conversation-list')).toContainText('会话历史暂不可用')
    await page.locator('.conversation-list').getByRole('button', { name: '重试' }).click()
    await expect(page.getByRole('button', { name: '恢复会话' })).toBeVisible()
    expect(failedRequests).toBe(4)
  })

  test('AI composer waits for the selected conversation to finish loading', async ({ page }) => {
    let releaseTurns!: () => void
    let turnsRequested!: () => void
    const turnGate = new Promise<void>((resolve) => { releaseTurns = resolve })
    const turnRequest = new Promise<void>((resolve) => { turnsRequested = resolve })
    const now = '2026-09-30T00:00:00Z'
    await page.route('**/api/console/ai/conversations/page**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: { total: 1, pageNo: 0, pageSize: 20, items: [{ id: 'session-1', title: '作业诊断', contextVersion: 'v1', createdAt: now, updatedAt: now, expiresAt: now }], nextCursor: null, hasMore: false } }),
    }))
    await page.route('**/api/console/ai/cost-summary**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: null }) }))
    await page.route('**/api/console/ai/conversations/session-1/turns**', async (route) => {
      turnsRequested()
      await turnGate
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: [{ turnNo: 1, contextVersion: 'v1', prompt: '第一问', response: '第一答', status: 'COMPLETE', promptDecision: 'APPROVED', modelName: null, promptTokens: 1, completionTokens: 1, estimatedCostUsd: 0, createdAt: now, completedAt: now }] }) })
    })

    try {
      await page.goto('/system/ai-chat')
      const prompt = page.locator('.composer textarea')
      await prompt.fill('新的问题')
      await page.getByRole('button', { name: '作业诊断' }).click()
      await turnRequest
      await expect(prompt).toBeDisabled()
      await expect(page.locator('.composer').getByRole('button', { name: '发送' })).toBeDisabled()
      releaseTurns()
      await expect(page.locator('.bubble__body')).toHaveText(['第一问', '第一答'])
      await expect(prompt).toBeEnabled()
    } finally {
      releaseTurns()
    }
  })

  test('AI ignores late history after deleting a conversation that is loading', async ({ page }) => {
    let releaseTurns!: () => void
    let turnsRequested!: () => void
    const turnGate = new Promise<void>((resolve) => { releaseTurns = resolve })
    const turnRequest = new Promise<void>((resolve) => { turnsRequested = resolve })
    const now = '2026-09-30T00:00:00Z'
    let deleted = false
    await page.route('**/api/console/ai/conversations/page**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: { total: deleted ? 0 : 1, pageNo: 0, pageSize: 20, items: deleted ? [] : [{ id: 'session-1', title: '作业诊断', contextVersion: 'v1', createdAt: now, updatedAt: now, expiresAt: now }], nextCursor: null, hasMore: false } }),
    }))
    await page.route('**/api/console/ai/cost-summary**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: null }) }))
    await page.route('**/api/console/ai/conversations/session-1**', async (route) => {
      if (route.request().method() !== 'DELETE') return route.continue()
      deleted = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: null }) })
    })
    await page.route('**/api/console/ai/conversations/session-1/turns**', async (route) => {
      turnsRequested()
      await turnGate
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: [{ turnNo: 1, contextVersion: 'v1', prompt: '已删除的问题', response: '已删除的回答', status: 'COMPLETE', promptDecision: 'APPROVED', modelName: null, promptTokens: 1, completionTokens: 1, estimatedCostUsd: 0, createdAt: now, completedAt: now }] }) })
    })

    try {
      await page.goto('/system/ai-chat')
      await page.getByRole('button', { name: '作业诊断' }).click()
      await turnRequest
      await page.getByRole('button', { name: '删除会话' }).click()
      await page.getByRole('dialog').getByRole('button', { name: '确定' }).click()
      await expect(page.getByRole('button', { name: '作业诊断' })).toHaveCount(0)
      const lateTurns = page.waitForResponse((response) =>
        response.url().includes('/api/console/ai/conversations/session-1/turns'),
      )
      releaseTurns()
      await lateTurns
      await page.evaluate(() => new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ))
      await expect(page.locator('.bubble')).toHaveCount(0)
      await expect(page.locator('.chat-list')).not.toContainText('已删除的问题')
    } finally {
      releaseTurns()
    }
  })

  test('AI removes an expired conversation after a server NOT_FOUND', async ({ page }) => {
    const now = '2026-09-30T00:00:00Z'
    await page.route('**/api/console/ai/conversations/page**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: { total: 1, pageNo: 0, pageSize: 20, items: [{ id: 'expired-session', title: '过期会话', contextVersion: 'v1', createdAt: now, updatedAt: now, expiresAt: now }], nextCursor: null, hasMore: false } }),
    }))
    await page.route('**/api/console/ai/cost-summary**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', message: 'success', data: null }) }))
    await page.route('**/api/console/ai/conversations/expired-session/turns**', (route) => route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'NOT_FOUND', message: 'error.common.not_found_detail', data: null }),
    }))

    await page.goto('/system/ai-chat')
    await page.getByRole('button', { name: '过期会话' }).click()
    await expect(page.locator('.history-error')).toContainText('会话不存在或已过期')
    await expect(page.getByRole('button', { name: '过期会话' })).toHaveCount(0)
    await expect(page.locator('.bubble')).toHaveCount(0)
  })

  test('usage API error offers retry without showing a false zero report', async ({ page, network }) => {
    network.ignore('/api/console/queries/usage-summary')
    let unavailable = true
    await page.route('**/api/console/queries/usage-summary**', async (route) => {
      if (unavailable) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'unavailable' }),
        })
      } else {
        await route.continue()
      }
    })
    await page.goto('/observability/usage')
    await expect(page.locator('.el-alert[role="alert"]')).toContainText('加载失败')
    await expect(page.locator('.usage-total')).toHaveCount(0)
    unavailable = false
    await page.getByRole('button', { name: '重试' }).click()
    await expect(page.locator('.usage-total')).toHaveCount(3)
  })

  test('explicit degraded response header shows a bilingual source banner', async ({ page }) => {
    await page.route('**/api/console/queries/usage-summary**', async (route) => {
      const response = await route.fetch()
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'x-degraded-source': 'orchestrator' },
      })
    })
    await page.goto('/observability/usage')
    await expect(page.locator('.degradation-banner')).toContainText('orchestrator')
    await page.getByRole('button', { name: '切换英文' }).click()
    await expect(page.locator('.degradation-banner')).toContainText('Some downstream services degraded')
  })

  test('degradation banner clears after the source stops reporting degradation', async ({ page }) => {
    await page.clock.install()
    await page.route('**/api/console/queries/usage-summary**', async (route) => {
      const response = await route.fetch()
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'x-degraded-source': 'orchestrator' },
      })
    })
    await page.goto('/observability/usage')
    await expect(page.locator('.degradation-banner')).toContainText('orchestrator')
    await page.unroute('**/api/console/queries/usage-summary**')
    const recoveredResponse = page.waitForResponse((response) =>
      response.url().includes('/api/console/queries/usage-summary') && response.request().method() === 'GET',
    )
    await page.getByRole('button', { name: '搜索' }).click()
    expect((await recoveredResponse).headers()['x-degraded-source']).toBeUndefined()
    await expect(page.locator('.degradation-banner')).toContainText('orchestrator')
    await page.clock.fastForward(75_000)
    await expect(page.locator('.degradation-banner')).toHaveCount(0)
  })

  test('long maintenance announcement remains readable at narrow and desktop widths', async ({ page }) => {
    const message = '维护公告'.repeat(40)
    await page.route('**/api/console/system/maintenance', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'SUCCESS',
        message: 'success',
        data: {
          enabled: true,
          readOnly: true,
          message,
          etaAt: null,
          affectedServices: ['batch-orchestrator', 'batch-trigger'],
          version: 1,
          updatedAt: '2026-09-30T00:00:00Z',
        },
      }),
    }))
    await page.goto('/observability/usage')
    const banner = page.locator('.maintenance-banner')
    await expect(banner).toContainText(message)
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      const dimensions = await banner.evaluate((element) => {
        const text = element.querySelector('.maintenance-banner__text') as HTMLElement
        const bounds = element.getBoundingClientRect()
        return {
          textFits: text.scrollWidth <= text.clientWidth && text.scrollHeight <= text.clientHeight,
          withinViewport: bounds.left >= 0 && bounds.right <= window.innerWidth,
        }
      })
      expect(dimensions).toEqual({ textFits: true, withinViewport: true })
    }
  })

  test('trigger list follows the real backend degradation header when a downstream is unavailable', async ({ page }) => {
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/console/ops/triggers') && response.request().method() === 'GET',
    )
    await page.goto('/system/triggers')
    const response = await responsePromise
    expect(response.status()).toBe(200)
    if (response.headers()['x-degraded-source']?.split(',').includes('trigger')) {
      await expect(page.locator('.degradation-banner')).toContainText('trigger')
      await expect(page.locator('.pro-table')).toContainText('触发服务暂不可用')
    } else {
      await expect(page.locator('.pro-table')).not.toContainText('触发服务暂不可用')
    }
  })

  test('tenant administrator cannot read another tenant usage', async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL
    if (!baseURL) throw new Error('Playwright baseURL is required for tenant isolation testing')
    const api = await apiRequest.newContext({
      baseURL,
      storageState: 'e2e/.auth/role-tenantAdmin.json',
      extraHTTPHeaders: { 'X-Tenant-Id': 'ta' },
    })
    try {
      const own = await api.get('/api/console/queries/usage-summary', {
        params: { tenantId: 'ta', from: '2026-09-29', to: '2026-09-30' },
      })
      expect(own.status()).toBe(200)
      const other = await api.get('/api/console/queries/usage-summary', {
        params: { tenantId: 'tb', from: '2026-09-29', to: '2026-09-30' },
      })
      expect(other.status()).toBe(403)
      expect((await other.json()).code).toBe('FORBIDDEN')
    } finally {
      await api.dispose()
    }
  })
})
