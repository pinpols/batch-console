/**
 * 前台触发三租户 IMPORT → 后端终态与业务表产物校验。
 *
 * 这条用例刻意走 Console UI 发起触发，不直接 POST 触发接口；DB 查询只用于验收
 * “业务正确”：instance/task 终态、biz.customer_account / biz.transaction /
 * biz.risk_score 的本轮唯一 token 行数。
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { type Page } from '@playwright/test'
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'
import { clearConsoleRateLimitKeys } from './support/rate-limit'

const PG_CONTAINER = process.env.PG_CONTAINER || 'batch-postgres-primary'
const POSTGRES_USER = process.env.POSTGRES_USER || 'batch_user'
const PLATFORM_DB = process.env.PLATFORM_DB || 'batch_platform'
const BUSINESS_DB = process.env.BUSINESS_DB || 'batch_business'
const BACKEND_ROOT =
  process.env.BFS_BACKEND_ROOT || path.resolve(__dirname, '../../file-batch-system')
const SIM_BOOTSTRAP_SQL = path.join(BACKEND_ROOT, 'docs/test-data/sim-e2e-bootstrap.sql')
const TENANT_STORAGE_KEY = 'batch-console-tenant-id'
const TERMINAL_STATUSES = new Set(['SUCCESS', 'FAILED', 'COMPENSATED', 'CANCELLED', 'TERMINATED', 'REJECTED'])
const REQUIRED_IMPORT_STAGES = ['RECEIVE', 'PREPROCESS', 'PARSE', 'VALIDATE', 'LOAD']

type ImportScenario = {
  tenantId: string
  jobCode: string
  templateCode: string
  header: string
  row: (token: string, bizDate: string, i: number) => string
  businessCountSql: (token: string, bizDate: string) => string
}

type TriggeredInstance = {
  instanceNo: string
  idempotencyKey: string
}

type RunningScenario = {
  scenario: ImportScenario
  token: string
  bizDate: string
  triggered?: TriggeredInstance | null
}

const SCENARIOS: ImportScenario[] = [
  {
    tenantId: 'ta',
    jobCode: 'TA_IMPORT_CUSTOMER',
    templateCode: 'TA_IMPORT_CUSTOMER_TPL',
    header: 'customer_no,customer_name,customer_type,certificate_no,mobile_no,email,status',
    row: (token, _bizDate, i) =>
      `C${token}${i},UI Customer ${i},PERSONAL,ID${token}${i},138${i.toString().padStart(8, '0')},ui${i}@e2e.local,ACTIVE`,
    businessCountSql: (token) =>
      `select count(*) from biz.customer_account where tenant_id='ta' and customer_no like 'C${token}%';`,
  },
  {
    tenantId: 'tb',
    jobCode: 'TB_IMPORT_TRANSACTION',
    templateCode: 'TB_IMPORT_TRANSACTION_TPL',
    header: 'txn_no,account_no,txn_type,amount,currency_code,txn_date,remark',
    row: (token, bizDate, i) =>
      `T${token}${i},ACC${i.toString().padStart(10, '0')},DEPOSIT,${100 + i}.50,CNY,${bizDate},ui-business-${token}-${i}`,
    businessCountSql: (token, bizDate) =>
      `select count(*) from biz.transaction where tenant_id='tb' and txn_date='${bizDate}' and remark like 'ui-business-${token}-%';`,
  },
  {
    tenantId: 'tc',
    jobCode: 'TC_IMPORT_RISK_SCORE',
    templateCode: 'TC_IMPORT_RISK_SCORE_TPL',
    header: 'entity_id,entity_type,score_value,score_band,score_date',
    row: (token, bizDate, i) => `E${token}${i},ACCOUNT,${600 + i},${i % 2 ? 'LOW' : 'MEDIUM'},${bizDate}`,
    businessCountSql: (token, bizDate) =>
      `select count(*) from biz.risk_score where tenant_id='tc' and score_date='${bizDate}' and entity_id like 'E${token}%';`,
  },
]

function psql(db: string, sql: string): string {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      PG_CONTAINER,
      'psql',
      '-U',
      POSTGRES_USER,
      '-d',
      db,
      '-v',
      'ON_ERROR_STOP=1',
      '-tA',
      '-P',
      'pager=off',
    ],
    { input: sql, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'psql failed').trim())
  }
  return result.stdout.trim()
}

function dockerPgAvailable(): boolean {
  const result = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', PG_CONTAINER], {
    encoding: 'utf8',
  })
  return result.status === 0 && result.stdout.trim() === 'true'
}

function applyBackendSimBootstrap() {
  if (!existsSync(SIM_BOOTSTRAP_SQL)) {
    throw new Error(`backend sim bootstrap SQL not found: ${SIM_BOOTSTRAP_SQL}`)
  }
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      PG_CONTAINER,
      'psql',
      '-U',
      POSTGRES_USER,
      '-d',
      PLATFORM_DB,
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      `mockserver_base_url=${process.env.MOCKSERVER_BASE_URL || 'http://localhost:11080'}`,
    ],
    { input: readFileSync(SIM_BOOTSTRAP_SQL, 'utf8'), encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'sim bootstrap failed').trim())
  }
}

function assertImportRuntimeSeed() {
  for (const scenario of SCENARIOS) {
    const stages = psql(
      PLATFORM_DB,
      `select string_agg(ps.stage_code, ',' order by ps.step_order)
         from batch.pipeline_definition pd
         join batch.pipeline_step_definition ps on ps.pipeline_definition_id = pd.id
        where pd.tenant_id=${sqlLiteral(scenario.tenantId)}
          and pd.job_code=${sqlLiteral(scenario.jobCode)}
          and pd.pipeline_type='IMPORT'
          and ps.enabled=true;`,
    )
    expect(
      stages,
      `${scenario.tenantId}/${scenario.jobCode} import stages`,
    ).toBe(REQUIRED_IMPORT_STAGES.join(','))

    const loadSpec = psql(
      PLATFORM_DB,
      `select coalesce(query_param_schema->'jdbcMappedImport'->>'table', '')
         from batch.file_template_config
        where tenant_id=${sqlLiteral(scenario.tenantId)}
          and template_code=${sqlLiteral(scenario.templateCode)}
        limit 1;`,
    )
    expect(loadSpec, `${scenario.tenantId}/${scenario.templateCode} jdbcMappedImport`).toBeTruthy()
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function useTenant(page: Page, tenantId: string) {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value)
    },
    [TENANT_STORAGE_KEY, tenantId],
  )
}

async function triggerImportFromUi(
  page: Page,
  scenario: ImportScenario,
  token: string,
  bizDate: string,
): Promise<TriggeredInstance | null> {
  await useTenant(page, scenario.tenantId)
  await enterDemoApp(page)
  await page.goto('/jobs/definitions')
  await expectPageTitle(page, '作业定义')
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)

  const codeInput = page
    .locator('.el-form-item')
    .filter({ hasText: /Job Code|作业编码|编码/ })
    .locator('input')
    .first()
  if (await isVisible(codeInput, 3_000)) {
    await codeInput.fill(scenario.jobCode)
    await page.getByRole('button', { name: /搜索|查询/ }).first().click()
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
  }

  const exactJobCodeCell = page.locator('td').filter({
    hasText: new RegExp(`^\\s*${escapeRegExp(scenario.jobCode)}\\s*$`),
  })
  const row = page.locator('tbody tr.el-table__row').filter({ has: exactJobCodeCell }).first()
  if (!(await isVisible(row, 5_000))) {
    test.skip(true, `${scenario.tenantId}/${scenario.jobCode} 未 seed 到作业定义`)
    return null
  }

  let triggerBtn = row.getByRole('button', { name: /手动触发|触发|trigger/i }).first()
  if (!(await isVisible(triggerBtn, 1_500))) {
    const more = row.getByRole('button', { name: /^更多/ }).first()
    if (await isVisible(more, 1_500)) {
      await more.click()
      triggerBtn = page
        .locator('.el-dropdown-menu__item, [role="menuitem"]')
        .filter({ hasText: /手动触发|触发|trigger/i })
        .first()
    }
  }
  if (!(await isVisible(triggerBtn, 2_000))) {
    test.skip(true, `${scenario.tenantId}/${scenario.jobCode} 无前台触发入口`)
    return null
  }

  const rows = [1, 2, 3].map((i) => scenario.row(token, bizDate, i)).join('\n')
  const payload = {
    templateCode: scenario.templateCode,
    content: `${scenario.header}\n${rows}\n`,
    batchNo: `ui-business-${token}`,
  }

  await triggerBtn.click()
  const box = page.locator('.el-message-box, .el-dialog:visible').first()
  await expect(box).toBeVisible({ timeout: 5_000 })
  await box.locator('textarea').first().fill(JSON.stringify(payload, null, 2))

  const triggerResponse = page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' && res.url().includes('/api/console/jobs/trigger'),
    { timeout: 45_000 },
  )
  await box.getByRole('button', { name: /^触发$|确定|提交/ }).first().click()
  const resp = await triggerResponse
  expect(resp.status(), `${scenario.tenantId}/${scenario.jobCode} trigger status`).toBeLessThan(400)
  const body = await resp.json().catch(() => null)
  const resultKey = body?.data
  expect(resultKey, `${scenario.tenantId}/${scenario.jobCode} trigger result`).toBeTruthy()
  return {
    instanceNo: String(resultKey),
    idempotencyKey:
      resp.request().headers()['idempotency-key'] || resp.request().headers()['Idempotency-Key'] || '',
  }
}

async function waitForSuccessfulInstance(triggered: TriggeredInstance) {
  await expect
    .poll(
      () => {
        const status = psql(
          PLATFORM_DB,
          `select instance_status from batch.job_instance
            where instance_no=${sqlLiteral(triggered.instanceNo)}
               or dedup_key=${sqlLiteral(triggered.idempotencyKey)}
            order by id desc
            limit 1;`,
        )
        return TERMINAL_STATUSES.has(status) ? status : ''
      },
      { timeout: 180_000, intervals: [2_000, 3_000, 5_000] },
    )
    .toBe('SUCCESS')
}

function expectNoFailedTasks(triggered: TriggeredInstance) {
  const failedTasks = psql(
    PLATFORM_DB,
    `select count(*) from batch.job_task t
       join batch.job_instance i on i.id = t.job_instance_id
      where (i.instance_no=${sqlLiteral(triggered.instanceNo)}
             or i.dedup_key=${sqlLiteral(triggered.idempotencyKey)})
        and t.task_status in ('FAILED','COMPENSATED','REJECTED');`,
  )
  expect(Number(failedTasks), `failed tasks for ${triggered.instanceNo}`).toBe(0)
}

function cleanupRunningScenario(run: RunningScenario) {
  cleanupBusinessRows(run.scenario, run.token, run.bizDate)
  const batchNo = `ui-business-${run.token}`
  const instanceNo = run.triggered?.instanceNo ?? ''
  const idempotencyKey = run.triggered?.idempotencyKey ?? ''
  psql(
    PLATFORM_DB,
    `
CREATE TEMP TABLE e2e_import_instance_ids(id BIGINT PRIMARY KEY);
CREATE TEMP TABLE e2e_import_task_ids(id BIGINT PRIMARY KEY);
CREATE TEMP TABLE e2e_import_file_ids(id BIGINT PRIMARY KEY);
CREATE TEMP TABLE e2e_import_outbox_ids(id BIGINT PRIMARY KEY);
CREATE TEMP TABLE e2e_import_trigger_ids(id BIGINT PRIMARY KEY);

INSERT INTO e2e_import_instance_ids(id)
SELECT id FROM batch.job_instance
WHERE batch_no=${sqlLiteral(batchNo)}
   OR (${sqlLiteral(instanceNo)} <> '' AND instance_no=${sqlLiteral(instanceNo)})
   OR (${sqlLiteral(idempotencyKey)} <> '' AND dedup_key=${sqlLiteral(idempotencyKey)});

INSERT INTO e2e_import_trigger_ids(id)
SELECT trigger_request_id FROM batch.job_instance
WHERE id IN (SELECT id FROM e2e_import_instance_ids) AND trigger_request_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO e2e_import_trigger_ids(id)
SELECT id FROM batch.trigger_request
WHERE related_job_instance_id IN (SELECT id FROM e2e_import_instance_ids)
ON CONFLICT DO NOTHING;

INSERT INTO e2e_import_task_ids(id)
SELECT id FROM batch.job_task WHERE job_instance_id IN (SELECT id FROM e2e_import_instance_ids);

INSERT INTO e2e_import_file_ids(id)
SELECT related_file_id FROM batch.job_instance
WHERE id IN (SELECT id FROM e2e_import_instance_ids) AND related_file_id IS NOT NULL;

INSERT INTO e2e_import_file_ids(id)
SELECT file_id FROM batch.pipeline_instance
WHERE related_job_instance_id IN (SELECT id FROM e2e_import_instance_ids) AND file_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO e2e_import_outbox_ids(id)
SELECT id FROM batch.outbox_event
WHERE aggregate_id IN (
  SELECT id FROM e2e_import_instance_ids
  UNION ALL
  SELECT id FROM e2e_import_task_ids
  UNION ALL
  SELECT id FROM e2e_import_trigger_ids
);

DELETE FROM batch.event_delivery_log WHERE outbox_event_id IN (SELECT id FROM e2e_import_outbox_ids);
DELETE FROM batch.outbox_event WHERE id IN (SELECT id FROM e2e_import_outbox_ids);
DELETE FROM batch.job_step_instance WHERE job_instance_id IN (SELECT id FROM e2e_import_instance_ids)
   OR job_task_id IN (SELECT id FROM e2e_import_task_ids);
DELETE FROM batch.job_task WHERE id IN (SELECT id FROM e2e_import_task_ids);
DELETE FROM batch.job_partition WHERE job_instance_id IN (SELECT id FROM e2e_import_instance_ids);
DELETE FROM batch.pipeline_step_run WHERE pipeline_instance_id IN (
  SELECT id FROM batch.pipeline_instance WHERE related_job_instance_id IN (SELECT id FROM e2e_import_instance_ids)
     OR file_id IN (SELECT id FROM e2e_import_file_ids)
);
DELETE FROM batch.file_dispatch_record WHERE pipeline_instance_id IN (
  SELECT id FROM batch.pipeline_instance WHERE related_job_instance_id IN (SELECT id FROM e2e_import_instance_ids)
     OR file_id IN (SELECT id FROM e2e_import_file_ids)
);
DELETE FROM batch.pipeline_instance WHERE related_job_instance_id IN (SELECT id FROM e2e_import_instance_ids)
   OR file_id IN (SELECT id FROM e2e_import_file_ids);
DELETE FROM batch.file_audit_log WHERE file_id IN (SELECT id FROM e2e_import_file_ids);
DELETE FROM batch.file_dispatch_record WHERE file_id IN (SELECT id FROM e2e_import_file_ids);
UPDATE batch.job_instance SET parent_instance_id = NULL
WHERE parent_instance_id IN (SELECT id FROM e2e_import_instance_ids);
DELETE FROM batch.job_instance WHERE id IN (SELECT id FROM e2e_import_instance_ids);
DELETE FROM batch.trigger_request WHERE id IN (SELECT id FROM e2e_import_trigger_ids);
DELETE FROM batch.file_record WHERE id IN (SELECT id FROM e2e_import_file_ids);
`,
  )
}

function cleanupBusinessRows(scenario: ImportScenario, token: string, bizDate: string) {
  if (scenario.tenantId === 'ta') {
    psql(
      BUSINESS_DB,
      `delete from biz.customer_account where tenant_id='ta' and customer_no like 'C${token}%';`,
    )
    return
  }
  if (scenario.tenantId === 'tb') {
    psql(
      BUSINESS_DB,
      `delete from biz.transaction where tenant_id='tb' and txn_date='${bizDate}' and remark like 'ui-business-${token}-%';`,
    )
    return
  }
  if (scenario.tenantId === 'tc') {
    psql(
      BUSINESS_DB,
      `delete from biz.risk_score where tenant_id='tc' and score_date='${bizDate}' and entity_id like 'E${token}%';`,
    )
  }
}

test.describe.serial('前台三租户 IMPORT 业务正确性验收', () => {
  test.setTimeout(240_000)

  test.beforeAll(() => {
    test.skip(!dockerPgAvailable(), `Docker PG 容器 ${PG_CONTAINER} 未运行，跳过 DB 产物验收`)
    applyBackendSimBootstrap()
    assertImportRuntimeSeed()
  })

  for (const scenario of SCENARIOS) {
    test(`${scenario.tenantId}/${scenario.jobCode} 前台触发后导入业务表成功`, async ({ page }) => {
      clearConsoleRateLimitKeys()
      const token = `e2e-import-${Date.now().toString(36).slice(-8)}`
      const bizDate = new Date().toISOString().slice(0, 10)
      const run: RunningScenario = { scenario, token, bizDate }
      try {
        run.triggered = await triggerImportFromUi(page, scenario, token, bizDate)
        if (!run.triggered) return

        await waitForSuccessfulInstance(run.triggered)
        expectNoFailedTasks(run.triggered)

        const count = Number(psql(BUSINESS_DB, scenario.businessCountSql(token, bizDate)))
        expect(count, `${scenario.tenantId}/${scenario.jobCode} business rows`).toBe(3)
      } finally {
        cleanupRunningScenario(run)
      }
    })
  }
})
