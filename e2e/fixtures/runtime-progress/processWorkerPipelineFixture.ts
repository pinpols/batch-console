import { randomUUID } from 'node:crypto'
import { expect, type APIRequestContext } from '@playwright/test'
import { WorkerExecutionProgressFixture } from './fixture'
import { requiredEnvironment } from '../closure-recovery/fixture'

interface ProcessPlatformState {
  platformDatabase: string
  workerHeartbeatMs: number | null
  pipelines: Array<{
    id: number
    jobInstanceId: number
    status: string
    stage: string
    systemCode: string
    systemVersion: number
  }>
  steps: Array<{
    id: number
    pipelineId: number
    stage: string
    runSeq: number
    status: string
    errorCode: string | null
    outputSummary: unknown
  }>
  taskGenerations: Array<{ taskId: number; generationId: string | null; batchKey: string | null }>
}

interface ProcessBusinessState {
  businessDatabase: string
  sourceRows: number
  sourceTotalRows: number
  rlsSourceRows: number
  targetRows: number
  distinctRows: number
  totalAmount: number
  records: Array<{ recordNo: string; amount: number }>
  outsideTargetRows: number
  stagedRows: number
  generations: Array<{ id: string; taskId: number; status: string }>
  activeCommitQueries: number
  activeCommitUsers: string[]
}

/** PROCESS使用独立业务库，真实WAP发布中断后由租约回收恢复；平台状态只读。 */
export class ProcessWorkerPipelineFixture extends WorkerExecutionProgressFixture {
  protected override get workerRuntimeKind(): 'process' {
    return 'process'
  }

  protected override workerArguments(): string[] {
    return [
      '--batch.worker.process.heartbeat-interval-millis=1000',
      '--batch.worker.lease.renew-interval-millis=5000',
    ]
  }

  private readonly nonce = randomUUID().replaceAll('-', '').slice(0, 16)
  readonly sourceTable = `progress_process_source_${this.nonce}`
  readonly targetTable = `progress_process_target_${this.nonce}`
  readonly pauseFunction = `progress_process_pause_${this.nonce}`
  readonly batchKey = `process-progress-${this.nonce}`
  readonly outsideTenantId = `outside-process-${this.nonce}`
  private readonly businessDatabase = requiredEnvironment('E2E_PROCESS_BUSINESS_DATABASE')
  private processPrepared = false

  prepareProcess() {
    expect(this.businessDatabase).not.toBe(requiredEnvironment('E2E_CLOSURE_PG_DATABASE'))
    expect(this.businessDatabase).toMatch(/^wdi_p01_process_biz_[a-zA-Z0-9_]+$/)
    expect(
      this.ownedSql('process-worker-prepare', this.variables(), this.businessDatabase),
    ).toEqual({ preparedTables: 2 })
    this.processPrepared = true
  }

  processState() {
    return {
      ...this.workerProgressState(),
      ...this.ownedSql<ProcessPlatformState>('process-worker-state', this.variables()),
      ...this.ownedSql<ProcessBusinessState>(
        'process-business-state',
        this.variables(),
        this.businessDatabase,
      ),
    }
  }

  override async startWorker() {
    const startedAt = Date.now()
    await super.startWorker()
    await expect
      .poll(() => Number(this.processState().workerHeartbeatMs), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(startedAt)
  }

  async crashWorker() {
    await this.stopWorker('SIGKILL')
  }

  override async finish(request: APIRequestContext) {
    if (!this.processPrepared) return super.finish(request)
    const terminal = (status: string) =>
      ['SUCCESS', 'FAILED', 'PARTIAL_FAILED', 'CANCELLED', 'TERMINATED'].includes(status)
    try {
      await expect
        .poll(
          () => {
            const state = this.workerProgressState()
            return (
              state.runs.every((row) => terminal(row.status)) &&
              state.instances.every((row) => terminal(row.status)) &&
              state.tasks.every((row) => terminal(row.status)) &&
              state.partitions.every((row) => terminal(row.status))
            )
          },
          { timeout: 180_000, intervals: [1000, 2000] },
        )
        .toBe(true)
    } finally {
      await this.stopWorker()
    }
    await expect.poll(() => this.processState().activeCommitQueries, { timeout: 90_000 }).toBe(0)
    const business = this.ownedSql<Record<string, number>>(
      'process-worker-cleanup',
      this.variables(),
      this.businessDatabase,
    )
    expect(Object.values(business).every((value) => value === 0)).toBe(true)
    expect(this.ownedSql('workflow-replay-residue', {}, this.businessDatabase)).toEqual({})
    const platform = this.ownedSql<Record<string, number>>(
      'process-platform-cleanup',
      this.variables(),
    )
    expect(Object.values(platform).every((value) => value === 0)).toBe(true)
    const parent = await super.finish(request)
    const final = this.ownedSql<Record<string, number>>('workflow-replay-final-cleanup')
    expect(Object.values(final).every((value) => value === 0)).toBe(true)
    expect(this.ownedSql('workflow-replay-residue')).toEqual({})
    return {
      ...parent,
      ...business,
      ...platform,
      ...final,
      tenantTableRows: 0,
      businessTenantTableRows: 0,
    }
  }

  private variables() {
    return {
      job_code: this.jobCode,
      worker_code: this.workerCode,
      source_table: this.sourceTable,
      target_table: this.targetTable,
      pause_function: this.pauseFunction,
      batch_key: this.batchKey,
      outside_tenant_id: this.outsideTenantId,
    }
  }
}
