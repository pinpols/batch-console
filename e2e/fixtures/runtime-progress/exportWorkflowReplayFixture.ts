import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { expect, type APIRequestContext } from '@playwright/test'
import { ManualFileUploadFixture } from './manualFileUploadFixture'
import type { WorkerProgressState } from './fixture'
import type { WorkflowReplayFixture } from './workflowReplayFixture'

type BaseReplayState = ReturnType<WorkflowReplayFixture['replayState']>
interface ExportDetails {
  workerHeartbeatMs: number | null
  workerCapabilities: Array<{
    pluginId: string
    externalEffectCategories: string[]
    idempotencyCapability: string
  }>
  businessRows: number
  distinctRows: number
  activeSourceQueries: number
  pipelines: Array<{
    id: number
    jobInstanceId: number
    fileId: number | null
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
  }>
  checkpoints: Array<{
    pipelineId: number
    stage: string
    processedCount: number
    completed: boolean
  }>
  files: Array<{
    id: number
    status: string
    bucket: string
    path: string
    size: number
    sha256: string
    jobInstanceId: string | null
  }>
  operations: Array<{
    id: number
    status: string
    sourceRunId: number
    targetRunId: number | null
    requestedBy: string
    approvedBy: string | null
    resultPolicy: string
    configPolicy: string
    total: number
    succeeded: number
    inFlight: number
  }>
}

/** 原始导出与整轮审批重放均使用真实Worker；按保存进程句柄注入目标GENERATE中断。 */
export class ExportWorkflowReplayFixture extends ManualFileUploadFixture {
  private readonly suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  readonly jobCode = `export-replay-${this.suffix}`
  readonly workerCode = `export-replay-${this.suffix}`
  readonly batchNo = `export-replay-${this.suffix}`
  readonly batchTable = `replay_exp_batch_${this.suffix}`
  readonly detailTable = `replay_exp_detail_${this.suffix}`
  readonly detailView = `replay_exp_view_${this.suffix}`
  readonly workerLogDir = mkdtempSync(join(tmpdir(), 'wdi-export-replay-'))
  readonly javaTmpDir = join(this.workerLogDir, 'java-tmp')
  private worker?: ChildProcess
  private workerStarts = 0
  private jobDefinitionId = 0
  private exportPrepared = false

  prepareExport() {
    expect(this.ownedSql('export-replay-prepare', this.variables())).toEqual({ templates: 1 })
    this.exportPrepared = true
  }

  rememberJobDefinition(id: number) {
    expect(Number.isSafeInteger(id) && id > 0).toBe(true)
    this.jobDefinitionId = id
  }

  exportState(): Omit<WorkerProgressState, 'runs' | 'nodes'> &
    Omit<BaseReplayState, 'operations'> &
    ExportDetails {
    return {
      ...this.ownedSql<WorkerProgressState>('worker-progress-state', this.variables()),
      ...this.ownedSql<BaseReplayState>('workflow-replay-state'),
      ...this.ownedSql<ExportDetails>('export-replay-state', this.variables()),
    }
  }

  async startWorker() {
    if (this.worker) throw new Error('本例EXPORT Worker尚未停止')
    const backend = resolve(__dirname, '../../../../file-batch-system')
    const jar = resolve(backend, 'build/runtime-jars/worker-export.jar')
    const startedAt = Date.now()
    mkdirSync(this.javaTmpDir, { recursive: true, mode: 0o700 })
    const log = openSync(join(this.workerLogDir, `worker-${++this.workerStarts}.log`), 'w')
    const script = [
      'set -euo pipefail',
      'cd "$1"',
      'source scripts/lib/env-common.sh',
      'batch_configure_local_jvm_control_plane_env',
      'batch_configure_local_jvm_runtime_env',
      'exec java --enable-native-access=ALL-UNNAMED -XX:TieredStopAtLevel=1 -XX:+UseSerialGC -Xshare:off "-Djava.io.tmpdir=$5" -jar "$2" --spring.profiles.active=local --server.port=0 --batch.security.bypass-mode=false "--batch.worker.export.worker-code=$3" "--batch.worker.export.tenant-id=$4" "--batch.worker.export.consumer-group-id=$3" --batch.worker.kafka.subscribe-mode=TENANT_SCOPED "--batch.worker.kafka.tenant-allowlist=$4" --batch.worker.export.heartbeat-interval-millis=1000 --batch.worker.lease.renew-interval-millis=5000',
    ].join('\n')
    const child = spawn(
      'bash',
      [
        '-c',
        script,
        'export-replay',
        backend,
        jar,
        this.workerCode,
        this.tenantId,
        this.javaTmpDir,
      ],
      { cwd: backend, stdio: ['ignore', log, log] },
    )
    closeSync(log)
    this.worker = child
    let startupError: Error | undefined
    child.once('error', (error) => {
      startupError = error
    })
    await expect
      .poll(
        () => {
          if (startupError) throw startupError
          if (child.exitCode !== null || child.signalCode !== null)
            throw new Error(`EXPORT Worker启动退出；日志：${this.workerLogDir}`)
          const state = this.exportState()
          return state.worker?.status === 'ONLINE' && Number(state.workerHeartbeatMs) >= startedAt
        },
        { timeout: 60_000, intervals: [1000] },
      )
      .toBe(true)
  }

  async stopWorker(signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM') {
    const child = this.worker
    if (!child) return
    const exited = () => child.exitCode !== null || child.signalCode !== null
    if (!exited()) {
      child.kill(signal)
      try {
        await expect.poll(exited, { timeout: 10_000 }).toBe(true)
      } catch {
        child.kill('SIGKILL')
        await expect.poll(exited, { timeout: 10_000 }).toBe(true)
      }
    }
    this.worker = undefined
  }

  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    if (!this.exportPrepared) return super.finish(request, reader)
    const active = () => {
      const state = this.exportState()
      const terminal = (status: string) =>
        ['SUCCESS', 'FAILED', 'PARTIAL_FAILED', 'CANCELLED', 'TERMINATED'].includes(status)
      return (
        !state.runs.every((row) => terminal(row.status)) ||
        !state.tasks.every((row) => terminal(row.status))
      )
    }
    try {
      if (!this.worker && active()) await this.startWorker()
      await expect.poll(() => !active(), { timeout: 180_000, intervals: [1000, 2000] }).toBe(true)
    } finally {
      await this.stopWorker()
    }
    const state = this.exportState()
    for (const file of state.files) this.removeUploadedObject(file.bucket, file.path)
    await expect
      .poll(() => this.exportState().activeSourceQueries, { timeout: 90_000, intervals: [1000] })
      .toBe(0)
    const exportCleanup = this.ownedSql<Record<string, number>>(
      'export-replay-cleanup',
      this.variables(),
    )
    expect(Object.values(exportCleanup).every((count) => count === 0)).toBe(true)
    const jobCleanup = this.ownedSql<Record<string, number>>(
      'worker-progress-cleanup',
      this.variables(),
    )
    expect(Object.values(jobCleanup).every((count) => count === 0)).toBe(true)
    const parent = await super.finish(request, reader)
    const finalCleanup = this.ownedSql<Record<string, number>>('workflow-replay-final-cleanup')
    expect(Object.values(finalCleanup).every((count) => count === 0)).toBe(true)
    expect(this.ownedSql('workflow-replay-residue')).toEqual({})
    rmSync(this.javaTmpDir, { recursive: true, force: true })
    expect(existsSync(this.javaTmpDir)).toBe(false)
    return {
      ...parent,
      ...exportCleanup,
      ...jobCleanup,
      ...finalCleanup,
      tenantTableRows: 0,
      javaTemporaryDirectories: 0,
    }
  }

  private variables() {
    return {
      worker_code: this.workerCode,
      job_code: this.jobCode,
      workflow_code: this.workflowCode,
      job_definition_id: String(this.jobDefinitionId),
      job_definition_ids: String(this.jobDefinitionId),
      template_code: this.templateCode,
      batch_no: this.batchNo,
      batch_table: this.batchTable,
      detail_table: this.detailTable,
      detail_view: this.detailView,
    }
  }
}
