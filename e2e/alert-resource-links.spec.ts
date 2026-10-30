import { expect, test } from '@playwright/test'
import { STORAGE_KEYS } from './support/storage'
import { installE2eLocale } from './support/i18n'

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })

function response(data: unknown) {
  return { code: 'SUCCESS', message: 'ok', data }
}

test('告警卡片只链接到详情中明确且可精确处理的运行身份', async ({ page }) => {
  await installE2eLocale(page)
  await page.addInitScript((keys) => {
    localStorage.setItem(keys.session, '1')
    localStorage.setItem(keys.tenantId, 'ta')
    localStorage.setItem(keys.onboardingDone, '1')
  }, STORAGE_KEYS)

  const alerts = [
    {
      id: 1,
      tenantId: 'ta',
      serviceName: 'batch-orchestrator',
      alertType: 'JOB_SLA_VIOLATION',
      severity: 'WARN',
      title: 'Job SLA violated',
      detailJson: '{"jobInstanceId":"42","bizDate":"2026-10-11"}',
      dedupFingerprint: 'job-42',
      occurrenceCount: 1,
      firstSeenAt: '2026-10-11T12:00:00Z',
      lastSeenAt: '2026-10-11T12:00:00Z',
      traceId: '',
      status: 'OPEN',
      createdAt: '2026-10-11T12:00:00Z',
      updatedAt: '2026-10-11T12:00:00Z',
    },
    {
      id: 2,
      tenantId: 'ta',
      serviceName: 'batch-orchestrator',
      alertType: 'WORKFLOW_NODE_MANUAL_SKIP',
      severity: 'WARN',
      title: 'Workflow node manually skipped',
      detailJson: '{"workflowRunId":91,"nodeCode":"IMPORT"}',
      dedupFingerprint: 'workflow-91',
      occurrenceCount: 1,
      firstSeenAt: '2026-10-11T12:00:00Z',
      lastSeenAt: '2026-10-11T12:00:00Z',
      traceId: '',
      status: 'OPEN',
      createdAt: '2026-10-11T12:00:00Z',
      updatedAt: '2026-10-11T12:00:00Z',
    },
    {
      id: 3,
      tenantId: 'ta',
      serviceName: 'batch-orchestrator',
      alertType: 'UNKNOWN_RESOURCE',
      severity: 'INFO',
      title: 'Unknown resource',
      detailJson: '{"jobInstanceId":"9007199254740992"}',
      dedupFingerprint: 'unknown-resource',
      occurrenceCount: 1,
      firstSeenAt: '2026-10-11T12:00:00Z',
      lastSeenAt: '2026-10-11T12:00:00Z',
      traceId: '',
      status: 'OPEN',
      createdAt: '2026-10-11T12:00:00Z',
      updatedAt: '2026-10-11T12:00:00Z',
    },
  ]

  await page.route('**/api/console/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/console/auth/stream/ticket') {
      await route.fulfill({ status: 403, json: response({ message: 'stream disabled in test' }) })
      return
    }
    const data = path === '/api/console/auth/me'
        ? { username: 'alert-link-admin', tenantId: 'ta', authorities: ['ROLE_ADMIN'] }
        : path === '/api/console/tenants'
          ? { items: [{ tenantId: 'ta', tenantName: 'Tenant A', status: 'ACTIVE' }], total: 1 }
          : path === '/api/console/ops/summary'
            ? {
                tenantId: 'ta',
                pendingApprovals: 0,
                openAlerts: 0,
                criticalAlerts: 0,
                runningJobs: 0,
                failedJobs: 0,
                slaBreaches: 0,
                onlineWorkers: 0,
                drainingWorkers: 0,
                offlineWorkers: 0,
                outboxRetryBacklog: 0,
                outboxDeliveryFailures: 0,
              }
            : path === '/api/console/queries/alerts'
              ? { items: alerts, total: alerts.length, pageNo: 1, pageSize: 15 }
              : { items: [], total: 0, pageNo: 1, pageSize: 15 }
    await route.fulfill({ status: 200, json: response(data) })
  })

  await page.goto('/ops/summary')
  await expect(page).toHaveURL(/\/ops\/summary/)
  await page.goto('/observability/alerts')
  await expect(page.getByRole('link', { name: '查看作业运行' })).toHaveAttribute(
    'href',
    '/monitor/job-instances/42',
  )
  await expect(page.getByRole('link', { name: '查看工作流运行' })).toHaveAttribute(
    'href',
    '/monitor/workflow-runs/91',
  )
  await expect(page.locator('.al-card').nth(2).getByRole('link', { name: /查看/ })).toHaveCount(0)

  await page.getByRole('link', { name: '查看作业运行' }).click()
  await expect(page).toHaveURL(/\/monitor\/job-instances\/42$/)
})
