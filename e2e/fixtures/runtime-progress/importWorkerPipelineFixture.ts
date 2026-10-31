import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { closeSync, mkdtempSync, openSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, type APIRequestContext } from '@playwright/test'
import type { WorkerProgressState } from './fixture'
import { ManualFileUploadFixture } from './manualFileUploadFixture'

/** 临时 Worker 启动脚本：参数全部由调用方显式传入，不在 `bash -c` 命令串里拼绝对路径。 */
const START_WORKER_SCRIPT = resolve(__dirname, 'start-worker.sh')

interface ImportDetails {
  workerHeartbeatMs: number | null
  businessRows: number
  distinctRows: number
  pipelines: Array<{
    id: number
    jobInstanceId: number
    fileId: number
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
}

/** 对象文件、真实 IMPORT Worker 与进程崩溃恢复；SQL仅准备业务目标并独立回读。 */
export class ImportWorkerPipelineFixture extends ManualFileUploadFixture {
  private readonly suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  readonly jobCode = `import-progress-${this.suffix}`
  readonly workerCode = `import-progress-${this.suffix}`
  readonly tableName = `progress_import_${this.suffix}`
  readonly pauseFunction = `pause_import_${this.suffix}`
  readonly workerLogDir = mkdtempSync(join(tmpdir(), 'wdi-import-progress-'))
  private worker?: ChildProcess
  private jobDefinitionId = 0
  private importPrepared = false
  private workerStarts = 0

  prepareImport() {
    expect(this.ownedSql('import-worker-prepare', this.variables())).toEqual({ templates: 1 })
    this.importPrepared = true
  }

  rememberJobDefinition(id: number) {
    expect(Number.isSafeInteger(id) && id > 0).toBe(true)
    this.jobDefinitionId = id
  }

  importState(): WorkerProgressState & ImportDetails {
    return {
      ...this.ownedSql<WorkerProgressState>('worker-progress-state', this.variables()),
      ...this.ownedSql<ImportDetails>('import-worker-state', this.variables()),
    }
  }

  async startWorker() {
    if (this.worker) throw new Error('本例 IMPORT Worker 尚未停止')
    const backend = resolve(__dirname, '../../../../file-batch-system')
    const jar = resolve(backend, 'build/runtime-jars/worker-import.jar')
    const startedAt = Date.now()
    const log = openSync(join(this.workerLogDir, `worker-${++this.workerStarts}.log`), 'w')
    const child = spawn(
      'bash',
      [
        START_WORKER_SCRIPT,
        backend,
        jar,
        'local',
        'import',
        this.workerCode,
        this.tenantId,
        this.workerCode,
        '--',
        '--batch.security.bypass-mode=false',
        '--batch.worker.import.scanner.enabled=false',
        '--batch.worker.import.heartbeat-interval-millis=1000',
        '--batch.worker.lease.renew-interval-millis=5000',
      ],
      {
        cwd: backend,
        stdio: ['ignore', log, log],
      },
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
            throw new Error(`IMPORT Worker 启动退出；日志：${this.workerLogDir}`)
          const state = this.importState()
          return state.worker?.status === 'ONLINE' && Number(state.workerHeartbeatMs) >= startedAt
        },
        { timeout: 60_000, intervals: [1000] },
      )
      .toBe(true)
  }

  async crashWorker() {
    await this.stopWorker('SIGKILL')
  }

  override async finish(request: APIRequestContext) {
    if (!this.importPrepared) return super.finish(request)
    try {
      await this.ensureWorkflowTerminal(request)
      await expect
        .poll(
          () => {
            const state = this.importState()
            const terminal = (status: string) =>
              ['SUCCESS', 'FAILED', 'PARTIAL_FAILED', 'CANCELLED', 'TERMINATED'].includes(status)
            return (
              state.instances.every((row) => terminal(row.status)) &&
              state.tasks.every((row) => terminal(row.status)) &&
              state.partitions.every((row) => terminal(row.status))
            )
          },
          { timeout: 90_000 },
        )
        .toBe(true)
    } finally {
      await this.stopWorker('SIGTERM')
    }
    const file = this.uploadState()
    this.removeUploadedObject(file.storageBucket, file.storagePath)
    const pipelineCleanup = this.ownedSql<Record<string, number>>(
      'import-worker-cleanup',
      this.variables(),
    )
    expect(Object.values(pipelineCleanup).every((count) => count === 0)).toBe(true)
    const workerCleanup = this.ownedSql<Record<string, number>>(
      'worker-progress-cleanup',
      this.variables(),
    )
    expect(Object.values(workerCleanup).every((count) => count === 0)).toBe(true)
    const uploadCleanup = this.cleanupUploadRows()
    expect(Object.values(uploadCleanup).every((count) => count === 0)).toBe(true)
    return {
      ...(await super.finish(request)),
      ...pipelineCleanup,
      ...workerCleanup,
      ...uploadCleanup,
    }
  }

  private variables() {
    return {
      worker_code: this.workerCode,
      job_code: this.jobCode,
      job_definition_id: String(this.jobDefinitionId),
      job_definition_ids: String(this.jobDefinitionId),
      workflow_code: this.workflowCode,
      template_code: this.templateCode,
      table_name: this.tableName,
      pause_function: this.pauseFunction,
    }
  }

  private async stopWorker(signal: 'SIGTERM' | 'SIGKILL') {
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
}
