import { execFileSync } from 'node:child_process'
import { expect, test } from './support/app'

test.use({ storageState: { cookies: [], origins: [] } })
test.skip(
  process.env.E2E_USAGE_DB_RECONCILIATION !== '1',
  'Requires a local PostgreSQL usage aggregate',
)

type UsageRow = {
  statDate: string
  tenantId: string
  source: string
  metricCode: string
  pageCode: string
  appVersion: string
  eventCount: number
  successCount: number
  failureCount: number
}

function queryDatabase(tenantId: string, from: string, to: string): UsageRow[] {
  const host = process.env.E2E_USAGE_DB_HOST ?? '127.0.0.1'
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Usage reconciliation only connects to a loopback PostgreSQL host')
  }
  if (
    !/^[a-z0-9-]{1,64}$/.test(tenantId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    throw new Error('Invalid usage reconciliation query parameters')
  }
  const username = process.env.BATCH_PLATFORM_DB_USERNAME
  const password = process.env.BATCH_PLATFORM_DB_PASSWORD
  if (!username || !password) throw new Error('BATCH_PLATFORM_DB_USERNAME/PASSWORD are required')

  const sql = `
    BEGIN READ ONLY;
    SET LOCAL app.tenant_id = '${tenantId}';
    SELECT COALESCE(json_agg(row_to_json(q)), '[]'::json)
    FROM (
      SELECT stat_date AS "statDate", tenant_id AS "tenantId", source,
             metric_code AS "metricCode", page_code AS "pageCode",
             app_version AS "appVersion", event_count AS "eventCount",
             success_count AS "successCount", failure_count AS "failureCount"
      FROM batch.console_usage_daily
      WHERE tenant_id = '${tenantId}' AND stat_date BETWEEN '${from}' AND '${to}'
      ORDER BY stat_date, source, metric_code, page_code, app_version
    ) q;
    COMMIT;
  `
  const output = execFileSync(
    process.env.PSQL_BIN ?? 'psql',
    ['-X', '-v', 'ON_ERROR_STOP=1', '-Atqc', sql],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PGHOST: host,
        PGPORT: process.env.E2E_USAGE_DB_PORT ?? '15432',
        PGDATABASE: process.env.E2E_USAGE_DB_NAME ?? 'batch_platform',
        PGUSER: username,
        PGPASSWORD: password,
      },
    },
  ).trim()
  return JSON.parse(output) as UsageRow[]
}

function comparable(rows: UsageRow[]): string[] {
  return rows
    .map((row) =>
      [
        row.statDate,
        row.tenantId,
        row.source,
        row.metricCode,
        row.pageCode,
        row.appVersion,
        row.eventCount,
        row.successCount,
        row.failureCount,
      ]
        .map(String)
        .join('|'),
    )
    .sort()
}

test('usage page matches the tenant daily aggregate in PostgreSQL', async ({ page, network }) => {
  const username = process.env.E2E_USAGE_USERNAME
  const password = process.env.E2E_USAGE_PASSWORD
  if (!username || !password) throw new Error('E2E_USAGE_USERNAME/PASSWORD are required')
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

  const usageResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/console/queries/usage-summary') &&
      response.request().method() === 'GET',
  )
  await page.goto('/observability/usage')
  const response = await usageResponse
  expect(response.status()).toBe(200)
  const url = new URL(response.url())
  const tenantId = url.searchParams.get('tenantId') ?? ''
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  expect(tenantId).toBe('ta')
  const payload = await response.json()
  expect(payload.code).toBe('SUCCESS')
  const apiRows = payload.data as UsageRow[]
  const databaseRows = queryDatabase(tenantId, from, to)
  expect(databaseRows.length).toBeGreaterThan(0)
  expect(comparable(apiRows)).toEqual(comparable(databaseRows))

  const events = databaseRows.reduce((total, row) => total + Number(row.eventCount), 0)
  const success = databaseRows.reduce(
    (total, row) => total + (row.source === 'FRONTEND' ? 0 : Number(row.successCount)),
    0,
  )
  const failure = databaseRows.reduce(
    (total, row) => total + (row.source === 'FRONTEND' ? 0 : Number(row.failureCount)),
    0,
  )
  await expect(
    page.locator('.usage-total').filter({ hasText: '事件数' }).first().locator('strong'),
  ).toHaveText(events.toLocaleString())
  await expect(
    page.locator('.usage-total').filter({ hasText: '成功事件数' }).locator('strong'),
  ).toHaveText(success.toLocaleString())
  await expect(
    page.locator('.usage-total').filter({ hasText: '失败事件数' }).locator('strong'),
  ).toHaveText(failure.toLocaleString())
  network.assertClean('usage daily aggregate reconciliation')
})
