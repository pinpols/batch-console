/**
 * Flow 13: Workflow 多步运行:Pipeline → 节点 1→2→3 → DAG 完成
 *
 * 端点:
 *   GET /api/console/queries/workflow-definitions
 *   GET /api/console/queries/workflow-topology
 *   GET /api/console/queries/workflow-runs
 *   GET /api/console/queries/workflow-runs/{id}
 *   GET /api/console/queries/workflow-node-runs (按 runId)
 *
 * 真生效需 orchestrator,本测验:topology 可读 + 节点状态可查的可见性闭环。
 */
import { test, expect } from '@playwright/test'
import { adminCtx, call, FlowLog } from './_watchdog'

test.describe.serial('Flow 13: workflow multi-step DAG visibility', () => {
  let ctx: Awaited<ReturnType<typeof adminCtx>>
  const log = new FlowLog()
  let failed = false
  let workflowDefId: number | null = null
  let workflowRunId: number | null = null

  test.beforeAll(async () => { ctx = await adminCtx() })
  test.afterAll(async () => { log.flushIfFailed(failed, 'flow-13-workflow'); await ctx.dispose() })

  test('1. 查 workflow definitions', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/workflow-definitions?tenantId=ta&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
    const items = (r.body as { data?: { items?: Array<{ id: number }> } }).data?.items ?? []
    workflowDefId = items[0]?.id ?? null
  })

  test('2. 查 workflow nodes(节点列表)', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/workflow-nodes?tenantId=ta&pageSize=20', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('3. 查 workflow edges(连线)', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/workflow-edges?tenantId=ta&pageSize=20', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
  })

  test('4. 查 workflow topology(DAG 拓扑)', async () => {
    if (workflowDefId == null) test.skip(true, '无 workflow def')
    const r = await call(ctx, 'GET', `/api/console/queries/workflow-topology?tenantId=ta&workflowDefinitionId=${workflowDefId}`, { tenantId: 'ta', log })
    expect(r.status, `topology ${r.status}`).toBeLessThan(500)
  })

  test('5. 查 workflow runs', async () => {
    const r = await call(ctx, 'GET', '/api/console/queries/workflow-runs?tenantId=ta&pageSize=10', { tenantId: 'ta', log })
    failed = failed || r.status !== 200
    expect(r.status).toBe(200)
    const items = (r.body as { data?: { items?: Array<{ id: number }> } }).data?.items ?? []
    workflowRunId = items[0]?.id ?? null
  })

  test('6. 查 workflow run 详情(若有)', async () => {
    if (workflowRunId == null) test.skip(true, '无 workflow run')
    const r = await call(ctx, 'GET', `/api/console/queries/workflow-runs/${workflowRunId}?tenantId=ta`, { tenantId: 'ta', log })
    expect(r.status, `run detail ${r.status}`).toBe(200)
  })

  test('7. 查 workflow node-runs(节点级状态)', async () => {
    if (workflowRunId == null) test.skip(true, '无 workflow run')
    const r = await call(ctx, 'GET', `/api/console/queries/workflow-node-runs?tenantId=ta&workflowRunId=${workflowRunId}&pageSize=20`, { tenantId: 'ta', log })
    expect(r.status, `node-runs ${r.status}`).toBeLessThan(500)
  })
})
