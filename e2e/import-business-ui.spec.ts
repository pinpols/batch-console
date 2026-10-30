/**
 * 前台触发三租户 IMPORT → 后端终态与业务表产物校验。
 *
 * 这条用例刻意走 Console UI 发起触发，不直接 POST 触发接口；DB 查询只用于验收
 * “业务正确”：instance/task 终态、biz.customer_account / biz.transaction /
 * biz.risk_score 的本轮唯一 token 行数。
 */
import { STORAGE_KEYS } from './support/storage'
import { spawnSync } from 'node:child_process'
import { type Page } from '@playwright/test'
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'
import { clearConsoleRateLimitKeys } from './support/rate-limit'

const PG_CONTAINER = process.env.PG_CONTAINER || 'batch-postgres-primary'
const POSTGRES_USER = process.env.POSTGRES_USER || 'batch_user'
const PLATFORM_DB = process.env.PLATFORM_DB || 'batch_platform'
const BUSINESS_DB = process.env.BUSINESS_DB || 'batch_business'
const TENANT_STORAGE_KEY = STORAGE_KEYS.tenantId
const TERMINAL_STATUSES = new Set([
  'SUCCESS',
  'FAILED',
  'COMPENSATED',
  'CANCELLED',
  'TERMINATED',
  'REJECTED',
])

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
    templateCode: 'ta_import_customer_tpl',
    header: 'customer_no,customer_name,customer_type,certificate_no,mobile_no,email,status',
    row: (token, _bizDate, i) =>
      `C${token}${i},UI Customer ${i},PERSONAL,ID${token}${i},138${i.toString().padStart(8, '0')},ui${i}@e2e.local,ACTIVE`,
    businessCountSql: (token) =>
      `select count(*) from biz.customer_account where tenant_id='ta' and customer_no like 'C${token}%';`,
  },
  {
    tenantId: 'tb',
    jobCode: 'TB_IMPORT_TRANSACTION',
    templateCode: 'tb_import_transaction_tpl',
    header: 'txn_no,account_no,txn_type,amount,currency_code,txn_date,remark',
    row: (token, bizDate, i) =>
      `T${token}${i},ACC${i.toString().padStart(10, '0')},DEPOSIT,${100 + i}.50,CNY,${bizDate},ui-business-${token}-${i}`,
    businessCountSql: (token, bizDate) =>
      `select count(*) from biz.transaction where tenant_id='tb' and txn_date='${bizDate}' and remark like 'ui-business-${token}-%';`,
  },
  {
    tenantId: 'tc',
    jobCode: 'TC_IMPORT_RISK_SCORE',
    templateCode: 'tc_import_risk_score_tpl',
    header: 'entity_id,entity_type,score_value,score_band,score_date',
    row: (token, bizDate, i) =>
      `E${token}${i},ACCOUNT,${600 + i},${i % 2 ? 'LOW' : 'MEDIUM'},${bizDate}`,
    businessCountSql: (token, bizDate) =>
      `select count(*) from biz.risk_score where tenant_id='tc' and score_date='${bizDate}' and entity_id like 'E${token}%';`,
  },
]

const COPIED_TA_IMPORT_SCENARIO: ImportScenario = {
  ...SCENARIOS[0],
  tenantId: 'tx',
  businessCountSql: (token) =>
    `select count(*) from biz.customer_account where tenant_id='tx' and customer_no like 'C${token}%';`,
}

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

function assertImportRuntimeSeed(scenario: ImportScenario) {
  const importDefinitionSql = `select concat(jd.job_type, ':', lower(jd.enabled::text), ':', jd.default_params->>'templateCode')
         from batch.job_definition jd
        where jd.tenant_id=${sqlLiteral(scenario.tenantId)}
          and jd.job_code=${sqlLiteral(scenario.jobCode)}
        order by jd.version desc limit 1;`
  const stages = psql(PLATFORM_DB, importDefinitionSql)
  expect(stages, `${scenario.tenantId}/${scenario.jobCode} enabled IMPORT definition`).toBe(
    `IMPORT:true:${scenario.templateCode}`,
  )

  const importTemplateTableSql = `select coalesce(query_param_schema->'jdbcMappedImport'->>'table', '')
         from batch.file_template_config
        where tenant_id=${sqlLiteral(scenario.tenantId)}
          and template_code=${sqlLiteral(scenario.templateCode)}
        order by version desc
        limit 1;`
  const loadSpec = psql(PLATFORM_DB, importTemplateTableSql)
  expect(loadSpec, `${scenario.tenantId}/${scenario.templateCode} jdbcMappedImport`).toBeTruthy()
}

async function copyImportJobFromUi(page: Page, scenario: ImportScenario) {
  await enterDemoApp(page)
  await page.goto('/system/tenants')
  await expectPageTitle(page, '租户实例')
  await page.getByRole('button', { name: '复制配置' }).click()
  const drawer = page.locator('.el-drawer:visible')
  await expect(drawer.getByText('跨租户复制配置')).toBeVisible()

  const source = drawer.locator('.el-form-item').filter({ hasText: '源租户' }).locator('.el-select')
  await source.click()
  const sourceOption = page
    .locator('.el-select-dropdown:visible [role="option"]')
    .filter({ hasText: /^ta\s*—/ })
  await expect(sourceOption).toBeVisible()
  await sourceOption.click()
  await expect(drawer.locator('.el-form-item').filter({ hasText: '源租户' })).toContainText('ta —')
  await page.keyboard.press('Escape')

  const targets = drawer.locator('.el-form-item').filter({ hasText: '目标租户' }).locator('.el-select')
  await targets.click()
  await targets.locator('input').fill('tx')
  await expect(
    page
      .locator('.el-select-dropdown:visible [role="option"]')
      .filter({ hasText: /^tx\s*—\s*E2E fixture tx$/ }),
  ).toBeVisible()
  await targets.locator('input').press('ArrowDown')
  await targets.locator('input').press('Enter')
  await expect(drawer.locator('.el-form-item').filter({ hasText: '目标租户' })).toContainText(
    'tx — E2E fixture tx',
  )

  const jobCodes = drawer.getByPlaceholder(/输入 jobCode/)
  await jobCodes.fill(scenario.jobCode)
  await jobCodes.press('Enter')
  await drawer.locator('.el-radio').filter({ hasText: '覆盖更新已有' }).click()

  const previewResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/console/config/tenant-copy/preview'),
    { timeout: 30_000 },
  )
  await drawer.getByRole('button', { name: '复制预览' }).click()
  expect((await previewResponse).status(), 'tenant copy preview status').toBe(200)
  await expect(drawer.getByText('差异预览')).toBeVisible({ timeout: 15_000 })
  await expect(drawer.getByText(scenario.jobCode).first()).toBeVisible({ timeout: 10_000 })

  const applyResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/console/config/tenant-copy'),
    { timeout: 45_000 },
  )
  await drawer.getByRole('button', { name: '正式执行复制' }).click()
  const response = await applyResponse
  expect(response.status(), 'tenant copy apply status').toBeLessThan(400)
  await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 15_000 })
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
  const definitionsResponse = page.waitForResponse(
    (response) => {
      const url = new URL(response.url())
      return (
        response.request().method() === 'GET' &&
        url.pathname === '/api/console/queries/job-definitions' &&
        url.searchParams.get('tenantId') === scenario.tenantId &&
        url.searchParams.get('jobCode') === scenario.jobCode &&
        response.status() === 200
      )
    },
    { timeout: 20_000 },
  )
  await page.goto(`/jobs/definitions?jobCode=${encodeURIComponent(scenario.jobCode)}`)
  await expectPageTitle(page, '作业定义')
  await definitionsResponse

  const exactJobCodeCell = page.locator('td').filter({
    hasText: new RegExp(`^\\s*${escapeRegExp(scenario.jobCode)}\\s*$`),
  })
  const row = page.locator('tbody tr.el-table__row').filter({ has: exactJobCodeCell }).first()
  await expect(row, `${scenario.tenantId}/${scenario.jobCode} 应出现在作业定义列表`).toBeVisible({
    timeout: 10_000,
  })

  let triggerBtn = row.getByRole('button', { name: /手动触发|触发/ }).first()
  if (!(await isVisible(triggerBtn, 1_500))) {
    const more = row.getByRole('button', { name: /^更多/ }).first()
    if (await isVisible(more, 1_500)) {
      await more.click()
      triggerBtn = page
        .locator('.el-dropdown-menu__item, [role="menuitem"]')
        .filter({ hasText: /手动触发|触发/ })
        .first()
    }
  }
  await expect(
    triggerBtn,
    `${scenario.tenantId}/${scenario.jobCode} 应提供前台触发入口`,
  ).toBeVisible({ timeout: 5_000 })

  const rows = [1, 2, 3].map((i) => scenario.row(token, bizDate, i)).join('\n')
  const payload = {
    templateCode: scenario.templateCode,
    content: `${scenario.header}\n${rows}\n`,
    batchNo: `ui-business-${token}`,
  }

  await triggerBtn.click()
  const box = page.locator('.el-message-box, .el-dialog:visible').first()
  await expect(box).toBeVisible({ timeout: 5_000 })
  await box
    .locator('textarea')
    .first()
    .fill(JSON.stringify(payload, null, 2))

  const triggerResponse = page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' &&
      /\/api\/console\/workflow-definitions\/\d+\/trigger(?:\?|$)/.test(res.url()),
    { timeout: 45_000 },
  )
  await box
    .getByRole('button', { name: /^触发$|确定|提交/ })
    .first()
    .click()
  const resp = await triggerResponse
  expect(resp.status(), `${scenario.tenantId}/${scenario.jobCode} trigger status`).toBeLessThan(400)
  const body = await resp.json().catch(() => null)
  const resultKey = body?.data
  expect(resultKey, `${scenario.tenantId}/${scenario.jobCode} trigger result`).toBeTruthy()
  return {
    instanceNo: String(resultKey),
    idempotencyKey:
      resp.request().headers()['idempotency-key'] ||
      resp.request().headers()['Idempotency-Key'] ||
      '',
  }
}

async function waitForSuccessfulInstance(triggered: TriggeredInstance) {
  let terminalStatus = ''
  await expect
    .poll(
      () => {
        const instanceStatusSql = `select instance_status from batch.job_instance
            where instance_no=${sqlLiteral(triggered.instanceNo)}
               or dedup_key=${sqlLiteral(triggered.idempotencyKey)}
            order by id desc
            limit 1;`
        const status = psql(PLATFORM_DB, instanceStatusSql)
        if (TERMINAL_STATUSES.has(status)) terminalStatus = status
        return terminalStatus !== ''
      },
      { timeout: 180_000, intervals: [2_000, 3_000, 5_000] },
    )
    .toBe(true)

  if (terminalStatus !== 'SUCCESS') {
    const failedTaskDetailSql = `select concat_ws(' | ', task_status, error_code, error_message)
         from batch.job_task t
         join batch.job_instance i on i.id = t.job_instance_id
        where (i.instance_no=${sqlLiteral(triggered.instanceNo)}
               or i.dedup_key=${sqlLiteral(triggered.idempotencyKey)})
          and t.task_status in ('FAILED','COMPENSATED','REJECTED')
        order by t.id desc
        limit 1;`
    const taskFailure = psql(PLATFORM_DB, failedTaskDetailSql)
    throw new Error(
      `import instance ${triggered.instanceNo} ended as ${terminalStatus}: ${taskFailure || 'no failed task detail'}`,
    )
  }
}

async function waitForSystemPipelineSnapshot(triggered: TriggeredInstance, scenario: ImportScenario) {
  const systemPipelineSnapshotSql = `select (e.value->>'systemPipelineCode') || ':' || (e.value->>'systemPipelineVersion')
       from batch.job_instance ji
       join batch.workflow_node_run wnr on wnr.job_instance_id=ji.id
       join batch.workflow_run wr on wr.id=wnr.workflow_run_id
       cross join lateral jsonb_each(coalesce(wr.execution_snapshot->'jobDefinitions', '{}'::jsonb)) e
      where (ji.instance_no=${sqlLiteral(triggered.instanceNo)} or ji.dedup_key=${sqlLiteral(triggered.idempotencyKey)})
        and e.value->>'jobCode'=${sqlLiteral(scenario.jobCode)}
      limit 1;`
  await expect.poll(() => psql(PLATFORM_DB, systemPipelineSnapshotSql), {
    timeout: 30_000,
    intervals: [500, 1_000, 2_000],
  }).toBe('IMPORT:1')
}

function expectNoFailedTasks(triggered: TriggeredInstance) {
  const failedTaskCountSql = `select count(*) from batch.job_task t
       join batch.job_instance i on i.id = t.job_instance_id
      where (i.instance_no=${sqlLiteral(triggered.instanceNo)}
             or i.dedup_key=${sqlLiteral(triggered.idempotencyKey)})
        and t.task_status in ('FAILED','COMPENSATED','REJECTED');`
  const failedTasks = psql(PLATFORM_DB, failedTaskCountSql)
  expect(Number(failedTasks), `failed tasks for ${triggered.instanceNo}`).toBe(0)
}

function cleanupRunningScenario(run: RunningScenario) {
  cleanupBusinessRows(run.scenario, run.token, run.bizDate)
  const batchNo = `ui-business-${run.token}`
  const instanceNo = run.triggered?.instanceNo ?? ''
  const idempotencyKey = run.triggered?.idempotencyKey ?? ''
  const cleanupImportFixtureSql = `
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
`
  psql(PLATFORM_DB, cleanupImportFixtureSql)
}

function cleanupBusinessRows(scenario: ImportScenario, token: string, bizDate: string) {
  if (scenario.tenantId === 'ta' || scenario.tenantId === 'tx') {
    const deleteCustomerFixtureSql = `delete from biz.customer_account where tenant_id=${sqlLiteral(scenario.tenantId)} and customer_no like 'C${token}%';`
    psql(BUSINESS_DB, deleteCustomerFixtureSql)
    return
  }
  if (scenario.tenantId === 'tb') {
    const deleteTransactionFixtureSql = `delete from biz.transaction where tenant_id='tb' and txn_date='${bizDate}' and remark like 'ui-business-${token}-%';`
    psql(BUSINESS_DB, deleteTransactionFixtureSql)
    return
  }
  if (scenario.tenantId === 'tc') {
    const deleteRiskScoreFixtureSql = `delete from biz.risk_score where tenant_id='tc' and score_date='${bizDate}' and entity_id like 'E${token}%';`
    psql(BUSINESS_DB, deleteRiskScoreFixtureSql)
  }
}

test.describe.serial('前台三租户 IMPORT 业务正确性验收', () => {
  test.setTimeout(240_000)

  test.beforeAll(() => {
    test.skip(!dockerPgAvailable(), `Docker PG 容器 ${PG_CONTAINER} 未运行，跳过 DB 产物验收`)
  })

  for (const scenario of SCENARIOS) {
    test(`${scenario.tenantId}/${scenario.jobCode} 前台触发后导入业务表成功`, async ({ page }) => {
      clearConsoleRateLimitKeys()
      const token = `e2e-import-${Date.now().toString(36).slice(-8)}`
      const bizDate = new Date().toISOString().slice(0, 10)
      const run: RunningScenario = { scenario, token, bizDate }
      try {
        assertImportRuntimeSeed(scenario)
        run.triggered = await triggerImportFromUi(page, scenario, token, bizDate)
        if (!run.triggered) return

        await waitForSystemPipelineSnapshot(run.triggered, scenario)
        await waitForSuccessfulInstance(run.triggered)
        expectNoFailedTasks(run.triggered)

        const count = Number(psql(BUSINESS_DB, scenario.businessCountSql(token, bizDate)))
        expect(count, `${scenario.tenantId}/${scenario.jobCode} business rows`).toBe(3)
      } finally {
        cleanupRunningScenario(run)
      }
    })
  }

  test('tx/TA_IMPORT_CUSTOMER 复制配置后通过冻结的系统 Pipeline 执行', async ({ page }) => {
    clearConsoleRateLimitKeys()
    const scenario = COPIED_TA_IMPORT_SCENARIO
    const token = `e2e-copy-${Date.now().toString(36).slice(-8)}`
    const bizDate = new Date().toISOString().slice(0, 10)
    const run: RunningScenario = { scenario, token, bizDate }
    try {
      await copyImportJobFromUi(page, scenario)
      assertImportRuntimeSeed(scenario)
      run.triggered = await triggerImportFromUi(page, scenario, token, bizDate)
      if (!run.triggered) return
      await waitForSystemPipelineSnapshot(run.triggered, scenario)
      await waitForSuccessfulInstance(run.triggered)
      expectNoFailedTasks(run.triggered)
      const count = Number(psql(BUSINESS_DB, scenario.businessCountSql(token, bizDate)))
      expect(count, `${scenario.tenantId}/${scenario.jobCode} business rows`).toBe(3)
    } finally {
      cleanupRunningScenario(run)
    }
  })
})
