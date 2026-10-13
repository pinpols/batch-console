import path from 'node:path'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const enabled = process.env.E2E_MAINTENANCE_EXCLUSIVE === '1'
const statePath = (role: 'admin' | 'tenantUser') =>
  path.resolve(__dirname, `.auth/role-${role}.json`)

type MaintenancePayload = {
  enabled: boolean
  readOnly: boolean
  message: string
  etaAt: string | null
  startsAt: string | null
  affectedServices: string[]
}

async function updateMaintenance(page: Page, payload: MaintenancePayload) {
  const result = await page.evaluate(async (body) => {
    const xsrf = document.cookie
      .split('; ')
      .find((item) => item.startsWith('XSRF-TOKEN='))
      ?.slice('XSRF-TOKEN='.length)
    const response = await fetch('/api/console/admin/system/maintenance', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'system',
        'Idempotency-Key': crypto.randomUUID(),
        ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
      },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.text() }
  }, payload)
  expect(result.status, result.body).toBe(200)
}

test.describe.serial('maintenance write freeze and recovery', () => {
  test.skip(!enabled, '仅在独占维护验收中运行，避免全量并行套件共享维护状态')

  let adminContext: BrowserContext
  let userContext: BrowserContext

  test.beforeAll(async ({ browser }) => {
    adminContext = await browser.newContext({ storageState: statePath('admin') })
    userContext = await browser.newContext({ storageState: statePath('tenantUser') })
  })

  test.afterAll(async () => {
    await adminContext?.close()
    await userContext?.close()
  })

  test('503 进入维护页，关闭维护后安全返回原页面', async () => {
    const adminPage = await adminContext.newPage()
    const userPage = await userContext.newPage()
    await adminPage.goto('/ops/summary')
    await userPage.goto('/jobs/definitions')

    try {
      await updateMaintenance(adminPage, {
        enabled: true,
        readOnly: false,
        message: 'E2E maintenance verification',
        etaAt: null,
        startsAt: null,
        affectedServices: ['console'],
      })

      await userPage
        .evaluate(async () => {
          const { post } = await import('/src/api/client.ts')
          await post('/api/console/jobs/trigger', {
            tenantId: 'ta',
            jobCode: 'e2e-maintenance-probe',
            bizDate: '2026-09-30',
            triggerType: 'MANUAL',
            payload: '{}',
          }).catch(() => undefined)
        })
        .catch((error: unknown) => {
          if (!String(error).includes('Execution context was destroyed')) throw error
        })

      await expect(userPage).toHaveURL(/\/maintenance\?redirect=/)
      await expect(userPage.getByRole('heading', { level: 1 })).toContainText('系统维护中')
    } finally {
      await updateMaintenance(adminPage, {
        enabled: false,
        readOnly: false,
        message: '',
        etaAt: null,
        startsAt: null,
        affectedServices: [],
      })
    }

    await userPage.getByRole('button', { name: '立即重试' }).click()
    await expect(userPage).toHaveURL(/\/jobs\/definitions$/)
  })

  test('计划维护先公告且可写，到达开始时间后拦截并恢复', async () => {
    test.setTimeout(120_000)
    const adminPage = await adminContext.newPage()
    const userPage = await userContext.newPage()
    await adminPage.goto('/ops/summary')
    await userPage.goto('/jobs/definitions')

    const initial = await adminPage.evaluate(async () => {
      const response = await fetch('/api/console/admin/system/maintenance', {
        credentials: 'include',
        headers: { 'X-Tenant-Id': 'system' },
      })
      return response.ok ? response.json() : null
    })
    expect(initial?.data?.enabled, '真实 E2E 只允许从维护关闭状态开始').toBe(false)

    const startsAt = new Date(Date.now() + 50_000).toISOString()
    const triggerProbe = () =>
      userPage.evaluate(async () => {
        const { post } = await import('/src/api/client.ts')
        try {
          await post('/api/console/jobs/trigger', {
            tenantId: 'ta',
            jobCode: `e2e-maintenance-scheduled-${Date.now()}`,
            bizDate: '2026-09-30',
            triggerType: 'MANUAL',
            payload: '{}',
          })
          return 200
        } catch (error) {
          return (error as { response?: { status?: number } }).response?.status ?? 0
        }
      })

    try {
      await updateMaintenance(adminPage, {
        enabled: true,
        readOnly: false,
        message: 'E2E scheduled maintenance verification',
        etaAt: null,
        startsAt,
        affectedServices: ['console'],
      })

      const scheduled = await adminPage.evaluate(async () => {
        const response = await fetch('/api/console/system/maintenance', {
          credentials: 'include',
          headers: { 'X-Tenant-Id': 'system' },
        })
        return response.json()
      })
      expect(scheduled.data).toMatchObject({ enabled: true, active: false })
      await expect(userPage.getByRole('alert')).toContainText(
        'E2E scheduled maintenance verification',
      )
      expect(await triggerProbe(), '计划开始前业务写请求不应被维护过滤器拦截').not.toBe(503)

      await expect
        .poll(
          async () => {
            const response = await adminPage.evaluate(async () => {
              const result = await fetch('/api/console/system/maintenance', {
                credentials: 'include',
                headers: { 'X-Tenant-Id': 'system' },
              })
              return result.json()
            })
            return response.data.active
          },
          { timeout: 70_000, intervals: [1_000, 2_000] },
        )
        .toBe(true)

      await triggerProbe().catch((error: unknown) => {
        if (!String(error).includes('Execution context was destroyed')) throw error
      })
      await expect(userPage).toHaveURL(/\/maintenance\?redirect=/)
      await expect(userPage.getByRole('heading', { level: 1 })).toContainText('系统维护中')
    } finally {
      await updateMaintenance(adminPage, {
        enabled: false,
        readOnly: false,
        message: '',
        etaAt: null,
        startsAt: null,
        affectedServices: [],
      })
    }

    await userPage.getByRole('button', { name: '立即重试' }).click()
    await expect(userPage).toHaveURL(/\/jobs\/definitions$/)
  })
})
