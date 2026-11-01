import { createHash } from 'node:crypto'
import { request as requestFactory } from '@playwright/test'
import { expect, test } from './support/app'
import { e2eText, installE2eLocale } from './support/i18n'
import { seedBrowserStorage } from './support/storage'
import { ExportWorkflowReplayFixture } from './fixtures/runtime-progress/exportWorkflowReplayFixture'

const enabled = process.env.E2E_EXPORT_MAPPING_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns identities, Worker and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(420_000)
test.skip(!enabled, 'Requires isolated authenticated services, PostgreSQL, MinIO and EXPORT Worker')

test('映射助手的真实导出按用户字段生成文件，分页游标不泄漏', async ({ page }, testInfo) => {
  const fixture = new ExportWorkflowReplayFixture()
  const admin = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  const reader = await requestFactory.newContext({ baseURL: String(testInfo.project.use.baseURL) })
  let exportPrepared = false
  let primaryError: unknown
  try {
    fixture.prepare()
    fixture.prepareExport('')
    exportPrepared = true
    fixture.prepareOtherBatch()
    await fixture.login(admin)
    await fixture.login(reader, true)
    await fixture.login(page.request)

    const draftResponse = await fixture.mutate(admin, '/api/console/file-templates/mapping-draft', {
      tenantId: fixture.tenantId,
      direction: 'EXPORT',
      schemaName: 'biz',
      tableName: fixture.detailView,
      fields: [
        { sourceColumn: 'record_no', header: 'recordNo', type: 'STRING' },
        { sourceColumn: 'amount', header: 'amount', type: 'DECIMAL' },
      ],
    })
    expect(draftResponse.status(), await draftResponse.text()).toBe(200)
    const draft = (await draftResponse.json()).data
    expect(draft.defaultQuerySql ?? null).toBeNull()
    expect(draft.warnings.join(' ')).toContain(':batchNo')
    const scopedSql =
      `select d.id, d.record_no, d.amount from biz.${fixture.detailView} d ` +
      `join biz.${fixture.batchTable} b on b.id = d.batch_id and b.tenant_id = d.tenant_id ` +
      'where d.tenant_id = :tenantId and b.batch_no = :batchNo'
    const templates = await fixture.mutate(admin, '/api/console/file-templates', undefined, 'GET', {
      templateCode: fixture.templateCode,
    })
    expect(templates.status(), await templates.text()).toBe(200)
    const templateItems = (await templates.json()).data.items
    expect(templateItems).toHaveLength(1)
    const updated = await fixture.mutate(
      admin,
      `/api/console/file-templates/${templateItems[0].id}`,
      {
        tenantId: fixture.tenantId,
        fieldMappingsJson: draft.fieldMappingsJson,
        queryParamSchemaJson: draft.queryParamSchemaJson,
        defaultQuerySql: scopedSql,
      },
      'PUT',
    )
    expect(updated.status(), await updated.text()).toBe(200)

    const job = await fixture.mutate(admin, '/api/console/job-definitions', {
      tenantId: fixture.tenantId,
      jobCode: fixture.jobCode,
      jobName: 'Actual mapped SQL export',
      jobType: 'BUNDLE_EXPORT',
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      workerGroup: 'EXPORT',
      timeoutSeconds: 300,
      retryPolicy: 'FIXED',
      retryMaxCount: 3,
      calendarCode: fixture.calendarCode,
      paramSchema: JSON.stringify({ type: 'object', additionalProperties: true }),
      defaultParams: JSON.stringify({
        templateCode: fixture.templateCode,
        batchNo: fixture.batchNo,
        autoDispatch: false,
        bundleFiles: [{ templateCode: fixture.templateCode }],
      }),
      enabled: true,
    })
    expect(job.status(), await job.text()).toBe(200)
    fixture.rememberJobDefinition(Number((await job.json()).data.id))
    const nodes = [
      { nodeCode: 'START', nodeName: 'Start', nodeType: 'START', nodeOrder: 0, enabled: true },
      {
        nodeCode: 'EXPORT_JOB',
        nodeName: 'Export',
        nodeType: 'JOB',
        relatedJobCode: fixture.jobCode,
        nodeOrder: 1,
        enabled: true,
      },
      { nodeCode: 'END', nodeName: 'End', nodeType: 'END', nodeOrder: 2, enabled: true },
    ]
    const edge = (from: string, to: string) => ({
      fromNodeCode: from,
      toNodeCode: to,
      edgeType: 'SUCCESS',
      enabled: true,
    })
    const workflow = await fixture.mutate(admin, '/api/console/workflow-definitions', {
      tenantId: fixture.tenantId,
      workflowCode: fixture.workflowCode,
      workflowName: 'Mapped SQL export',
      workflowType: 'DAG',
      enabled: true,
      scheduleType: 'MANUAL',
      triggerMode: 'MIXED',
      calendarCode: fixture.calendarCode,
      nodes,
      edges: [edge('START', 'EXPORT_JOB'), edge('EXPORT_JOB', 'END')],
    })
    expect(workflow.status(), await workflow.text()).toBe(200)
    const workflowId = Number((await workflow.json()).data.id)
    await fixture.startWorker()
    expect(fixture.exportState().workerCapabilities).toContainEqual(
      expect.objectContaining({ pluginId: 'sql_template_export' }),
    )
    const triggered = await fixture.mutate(
      admin,
      `/api/console/workflow-definitions/${workflowId}/trigger`,
      {
        tenantId: fixture.tenantId,
        bizDate: fixture.bizDate,
        triggerType: 'MANUAL',
      },
    )
    expect(triggered.status(), await triggered.text()).toBe(200)
    await expect
      .poll(
        () => {
          const status = fixture.exportState().runs[0]?.status
          if (status && ['FAILED', 'PARTIAL_FAILED', 'CANCELLED', 'TERMINATED'].includes(status))
            throw new Error(`真实导出 Workflow 已终态失败: ${status}`)
          return status
        },
        {
          timeout: 240_000,
          intervals: [1000, 2000],
        },
      )
      .toBe('SUCCESS')
    const state = fixture.exportState()
    expect(state.businessRows).toBe(1201)
    expect(state.distinctRows).toBe(1201)
    expect(state.checkpoints).toContainEqual(
      expect.objectContaining({ stage: 'GENERATE', processedCount: 1200, completed: true }),
    )
    expect(state.files).toHaveLength(1)
    const file = state.files[0]
    const bytes = fixture.readUploadedObject(file.bucket, file.path)
    expect(bytes.length).toBe(file.size)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256)
    const lines = bytes.toString('utf8').trim().split(/\r?\n/)
    expect(lines).toHaveLength(1201)
    expect(lines[0]).toBe('recordNo,amount')
    for (const [index, line] of lines.slice(1).entries()) {
      const [key, amount, extra] = line.split(',')
      expect(key).toBe(String(index + 1).padStart(6, '0'))
      expect(Number(amount)).toBe((index + 1) * 1.25)
      expect(extra).toBeUndefined()
    }
    expect(bytes.toString('utf8')).not.toContain('OUTSIDE-TENANT')
    expect(bytes.toString('utf8')).not.toContain('OUTSIDE-BATCH')
    await installE2eLocale(page)
    await seedBrowserStorage(page, {
      session: '1',
      tenantId: fixture.tenantId,
      onboardingDone: '1',
    })
    await page.goto(`/monitor/workflow-runs/${state.runs[0].id}`)
    const panel = page
      .locator('.section-card')
      .filter({ hasText: e2eText('workflowProgress.title') })
    await expect(panel.locator('.mini-dag__graph .node.success')).toHaveCount(3)
    const exportNode = panel
      .locator('.mini-dag__graph .node[role="button"]')
      .filter({ hasText: 'Export' })
    await expect(exportNode).toHaveCount(1)
    await exportNode.focus()
    await page.keyboard.press('Enter')
    await expect(panel.locator('.execution-progress__selection')).toContainText('EXPORT_JOB')
    await testInfo.attach('export-mapping-evidence.json', {
      body: JSON.stringify({
        rows: state.businessRows,
        fileBytes: bytes.length,
        sha256: file.sha256,
        checkpoint: state.checkpoints,
      }),
      contentType: 'application/json',
    })
  } catch (error) {
    primaryError = error
    if (exportPrepared)
      await testInfo.attach('export-mapping-failure.json', {
        body: JSON.stringify(fixture.exportState()),
        contentType: 'application/json',
      })
    throw error
  } finally {
    await page.goto('about:blank')
    try {
      const cleanup = await fixture.finish(admin, reader)
      await testInfo.attach('export-mapping-cleanup.json', {
        body: JSON.stringify(cleanup),
        contentType: 'application/json',
      })
    } catch (error) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, error],
          `真实导出及清理失败；日志：${fixture.workerLogDir}`,
        )
      throw error
    } finally {
      await admin.dispose()
      await reader.dispose()
    }
  }
})
