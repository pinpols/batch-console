/**
 * Mobile-ops e2e mock helpers.
 *
 * Mocks the read & write endpoints used by /m/* views so spec can run
 * without a live backend. Real-BE mode: env E2E_REAL_BE=1 skips installs.
 */
import type { Page, Route } from '@playwright/test'

export const useRealBE = process.env.E2E_REAL_BE === '1'

type Json = Record<string, unknown> | unknown[] | null

function ok(route: Route, body: Json) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'SUCCESS', message: 'ok', data: body }),
  })
}

function page(items: unknown[]) {
  return { items, total: items.length, page: 1, pageSize: 20 }
}

export const FIXTURES = {
  approvals: [
    {
      approvalNo: 'APR-2026-0001',
      approvalType: 'TENANT_CONFIG',
      actionType: 'CREATE',
      approvalStatus: 'PENDING',
      targetType: 'TENANT',
      targetId: 'tx',
      requesterId: 'alice',
      createdAt: '2026-05-17T08:00:00Z',
    },
    {
      approvalNo: 'APR-2026-0002',
      approvalType: 'CATCH_UP',
      actionType: 'TRIGGER',
      approvalStatus: 'PENDING',
      targetType: 'JOB',
      targetId: '12345',
      requesterId: 'bob',
      createdAt: '2026-05-17T07:30:00Z',
    },
  ],
  instances: [
    {
      id: 1001,
      instanceNo: 'JI-1001',
      jobCode: 'JOB_DEMO',
      instanceStatus: 'FAILED',
      bizDate: '2026-05-17',
      triggerType: 'MANUAL',
      priority: 50,
      startedAt: '2026-05-17T06:00:00Z',
      finishedAt: '2026-05-17T06:01:00Z',
    },
    {
      id: 1002,
      instanceNo: 'JI-1002',
      jobCode: 'JOB_DEMO2',
      instanceStatus: 'RUNNING',
      bizDate: '2026-05-17',
      triggerType: 'CRON',
      priority: 60,
      startedAt: '2026-05-17T07:00:00Z',
      finishedAt: null,
    },
  ],
  outbox: [
    {
      id: 9001,
      eventType: 'JOB_FINISHED',
      eventKey: 'JI-1001',
      retryStatus: 'FAILED',
      retryCount: 3,
      retryPolicy: 'EXPONENTIAL',
    },
    {
      id: 9002,
      eventType: 'FILE_DELIVERED',
      eventKey: 'FT-1',
      retryStatus: 'GIVE_UP',
      retryCount: 5,
      retryPolicy: 'LINEAR',
    },
  ],
  files: [
    {
      id: 7001,
      fileName: 'orders-2026-05-17.csv',
      fileStatus: 'DELIVERED',
      bizType: 'IMPORT',
      bizDate: '2026-05-17',
      traceId: 'trc-aaaaaaaa-bbbb',
      extra: { fileSize: 102400, receivedAt: '2026-05-17T05:00:00Z' },
    },
    {
      id: 7002,
      fileName: 'pricing-2026-05-17.xlsx',
      fileStatus: 'FAILED',
      bizType: 'EXPORT',
      bizDate: '2026-05-17',
      traceId: 'trc-cccccccc-dddd',
      extra: { fileSize: 51200, receivedAt: '2026-05-17T05:30:00Z' },
    },
  ],
  metaEnums: {
    approvalType: [{ value: 'TENANT_CONFIG', label: '租户配置' }],
    approvalStatus: [
      { value: 'PENDING', label: '待审批' },
      { value: 'APPROVED', label: '已通过' },
      { value: 'REJECTED', label: '已拒绝' },
    ],
    instanceStatus: [
      { value: 'RUNNING', label: '运行中' },
      { value: 'FAILED', label: '失败' },
    ],
    outboxRetryStatus: [
      { value: 'FAILED', label: '失败' },
      { value: 'GIVE_UP', label: '放弃' },
    ],
    fileStatus: [
      { value: 'DELIVERED', label: '已投递' },
      { value: 'FAILED', label: '失败' },
    ],
    triggerType: [{ value: 'MANUAL', label: '手动' }],
  },
}

export type MockSpec = {
  approvals?: typeof FIXTURES.approvals
  instances?: typeof FIXTURES.instances
  outbox?: typeof FIXTURES.outbox
  files?: typeof FIXTURES.files
}

/**
 * Install GET-route mocks for the most common mobile-ops endpoints.
 * Call BEFORE page.goto. Pass spec={} to use default fixtures.
 */
export async function installMobileMocks(page: Page, spec: MockSpec = {}) {
  if (useRealBE) return

  const approvals = spec.approvals ?? FIXTURES.approvals
  const instances = spec.instances ?? FIXTURES.instances
  const outbox = spec.outbox ?? FIXTURES.outbox
  const files = spec.files ?? FIXTURES.files

  await page.route('**/api/console/meta/enums*', (r) => ok(r, FIXTURES.metaEnums))

  await page.route('**/api/console/queries/approvals*', (r) => ok(r, page_(approvals)))
  await page.route('**/api/console/queries/instances*', (r) => ok(r, page_(instances)))
  await page.route('**/api/console/queries/outbox-retries*', (r) => ok(r, page_(outbox)))
  await page.route('**/api/console/queries/files*', (r) => ok(r, page_(files)))
  await page.route('**/api/console/files*', (r) => {
    if (r.request().method() !== 'GET') return r.continue()
    return ok(r, page_(files))
  })

  // 写操作:回 200 不带 body
  await page.route(/\/api\/console\/approvals\/[^/]+\/(approve|reject)$/, (r) =>
    ok(r, 'APR-OK'),
  )
  await page.route('**/api/console/approvals/batch-approve*', (r) => ok(r, [] as unknown[]))
  await page.route('**/api/console/approvals/batch-reject*', (r) => ok(r, [] as unknown[]))
  await page.route('**/api/console/ops/outbox/republish*', (r) => ok(r, null))
  await page.route('**/api/console/instances/*/retry*', (r) => ok(r, null))
  await page.route('**/api/console/instances/*/terminate*', (r) => ok(r, null))
}

function page_<T>(items: T[]) {
  return page(items as unknown[])
}
