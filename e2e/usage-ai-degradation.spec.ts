import { expect, test } from './support/app'
import { enterDemoApp } from './support/app'
import { request as apiRequest } from '@playwright/test'

test.describe('Usage, AI and degradation', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('usage page shows backend aggregate totals without counting UI events as business success', async ({ page }) => {
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
    await expect(page.locator('.usage-total').filter({ hasText: '业务成功数' }).locator('strong')).toHaveText(successes.toLocaleString())
    await expect(page.locator('.usage-total').filter({ hasText: '业务失败数' }).locator('strong')).toHaveText(failures.toLocaleString())
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

  test('AI history restores ordered turns and deletes a conversation with routed responses', async ({ page }) => {
    let deleted = false
    await page.route('**/api/console/ai/conversations**', async (route) => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()
      const now = '2026-09-30T00:00:00Z'
      let data: unknown = null
      if (path.endsWith('/conversations') && method === 'GET') {
        data = deleted ? [] : [{ id: 'session-1', title: '作业诊断', contextVersion: 'v1', createdAt: now, updatedAt: now, expiresAt: now }]
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
