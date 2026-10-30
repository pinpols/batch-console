import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { expect, type APIRequestContext } from '@playwright/test'
import { ManualFileUploadFixture } from './manualFileUploadFixture'
import type { WorkerProgressState } from './fixture'
import type { WorkflowReplayFixture } from './workflowReplayFixture'
import { ThrottledObjectProxy } from './throttledObjectProxy'

interface DispatchState {
  sourceObjectFileCount: number
  workerHeartbeatMs: number | null
  pipelines: Array<{
    id: number
    jobInstanceId: number
    fileId: number
    status: string
    stage: string
  }>
  steps: Array<{
    id: number
    pipelineId: number
    stage: string
    runSeq: number
    status: string
    errorCode: string | null
  }>
  deliveries: Array<{
    id: number
    pipelineId: number
    status: string
    receiptStatus: string
    receiptCode: string | null
    externalRequestId: string | null
    attempt: number
    errorCode: string | null
  }>
  deadLetters: Array<{ id: number; sourceId: string; reason: string; replayStatus: string }>
  resolutions: Array<{
    taskId: number
    status: string
    errorCode: string | null
    version: number | null
    requestId: number | null
    consumed: boolean
  }>
}

/** 真实S3对象到NAS原子发布；进程中断后的未知结果只通过真实审批恢复。 */
export class DispatchWorkerPipelineFixture extends ManualFileUploadFixture {
  private readonly suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  readonly workerCode = `dispatch-progress-${this.suffix}`
  readonly jobCode = `dispatch-progress-${this.suffix}`
  readonly nasChannelCode = `dispatch-nas-${this.suffix}`
  readonly remoteName = `delivery-${this.suffix}.csv`
  readonly workerLogDir = mkdtempSync(join(tmpdir(), 'wdi-dispatch-progress-'))
  readonly nasDirectory = mkdtempSync(join(tmpdir(), 'wdi-dispatch-nas-'))
  readonly finalPath = join(this.nasDirectory, this.remoteName)
  private worker?: ChildProcess
  private workerStarts = 0
  private jobDefinitionId = 0
  private proxy?: ThrottledObjectProxy
  private proxyEndpoint = ''
  private source?: { fileId: number; storageBucket: string; storagePath: string }

  rememberUploadedSource(source: { fileId: number; storageBucket: string; storagePath: string }) {
    expect(Number.isSafeInteger(source.fileId) && source.fileId > 0).toBe(true)
    this.source = { ...source }
  }

  rememberJobDefinition(id: number) {
    expect(Number.isSafeInteger(id) && id > 0).toBe(true)
    this.jobDefinitionId = id
  }

  dispatchState() {
    return {
      ...this.ownedSql<WorkerProgressState>('worker-progress-state', this.variables()),
      ...this.ownedSql<ReturnType<WorkflowReplayFixture['replayState']>>('workflow-replay-state'),
      ...this.ownedSql<DispatchState>('dispatch-worker-state', this.variables()),
    }
  }

  async startObjectProxy(upstream: string, storagePath: string) {
    if (!this.objectStorageNamespace) throw new Error('DISPATCH必须使用独立对象namespace')
    this.proxy = new ThrottledObjectProxy(upstream, `${this.objectStorageNamespace}/${storagePath}`)
    this.proxyEndpoint = await this.proxy.start()
  }

  get transfers() {
    return this.proxy?.transfers ?? []
  }

  destinationFiles() {
    return readdirSync(this.nasDirectory).map((name) => ({
      name,
      bytes: statSync(join(this.nasDirectory, name)).size,
    }))
  }

  async startWorker() {
    if (this.worker) throw new Error('本例DISPATCH Worker尚未停止')
    if (!this.proxyEndpoint) throw new Error('真实对象限速代理尚未启动')
    const backend = resolve(__dirname, '../../../../file-batch-system')
    const jar = resolve(backend, 'build/runtime-jars/worker-dispatch.jar')
    const startedAt = Date.now()
    const log = openSync(join(this.workerLogDir, `worker-${++this.workerStarts}.log`), 'w')
    const script = [
      'set -euo pipefail',
      'cd "$1"',
      'source scripts/lib/env-common.sh',
      'batch_configure_local_jvm_control_plane_env',
      'batch_configure_local_jvm_runtime_env',
      // 不启用local/test：两种profile会把NAS适配器替换为stub，不能作为真实字节传输证据。
      'exec java --enable-native-access=ALL-UNNAMED -XX:TieredStopAtLevel=1 -XX:+UseSerialGC -Xshare:off -jar "$2" --spring.profiles.active=e2e --spring.main.lazy-initialization=false --server.port=0 --batch.security.bypass-mode=false "--batch.worker.dispatch.worker-code=$3" "--batch.worker.dispatch.tenant-id=$4" "--batch.worker.dispatch.consumer-group-id=$3" --batch.worker.kafka.subscribe-mode=TENANT_SCOPED "--batch.worker.kafka.tenant-allowlist=$4" --batch.worker.dispatch.heartbeat-interval-millis=1000 --batch.worker.lease.renew-interval-millis=5000 "--batch.storage.s3.endpoint=$5" "--batch.worker.dispatch.runtime.nas-sandbox-root=$6"',
    ].join('\n')
    const child = spawn(
      'bash',
      [
        '-c',
        script,
        'dispatch-progress',
        backend,
        jar,
        this.workerCode,
        this.tenantId,
        this.proxyEndpoint,
        this.nasDirectory,
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
            throw new Error(`DISPATCH Worker启动退出；日志：${this.workerLogDir}`)
          const state = this.dispatchState()
          return state.worker?.status === 'ONLINE' && Number(state.workerHeartbeatMs) >= startedAt
        },
        { timeout: 60_000, intervals: [1000] },
      )
      .toBe(true)
  }

  async crashWorker() {
    await this.stopWorker('SIGKILL')
  }

  private async stopWorker(signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM') {
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
    try {
      const terminal = (status: string) =>
        ['SUCCESS', 'FAILED', 'PARTIAL_FAILED', 'CANCELLED', 'TERMINATED'].includes(status)
      await expect
        .poll(
          () => {
            const state = this.dispatchState()
            return (
              state.runs.every((row) => terminal(row.status)) &&
              state.tasks.every((row) => terminal(row.status))
            )
          },
          { timeout: 180_000, intervals: [1000, 2000] },
        )
        .toBe(true)
    } finally {
      await this.stopWorker()
      await this.proxy?.stop()
    }
    // 分发会把channelCode更新为目标通道；清理必须使用上传时保存的不可变数字身份与对象身份。
    if (this.source) {
      this.removeUploadedObject(this.source.storageBucket, this.source.storagePath)
      this.verifySourceObjectRemoved()
    }
    const dispatch = this.ownedSql<Record<string, number>>(
      'dispatch-worker-cleanup',
      this.variables(),
    )
    expect(Object.values(dispatch).every((n) => n === 0)).toBe(true)
    const jobs = this.ownedSql<Record<string, number>>('worker-progress-cleanup', this.variables())
    expect(Object.values(jobs).every((n) => n === 0)).toBe(true)
    const uploadedRows = this.cleanupUploadRows()
    expect(Object.values(uploadedRows).every((n) => n === 0)).toBe(true)
    const parent = await super.finish(request, reader)
    const final = this.ownedSql<Record<string, number>>('workflow-replay-final-cleanup')
    expect(Object.values(final).every((n) => n === 0)).toBe(true)
    expect(this.ownedSql('workflow-replay-residue')).toEqual({})
    rmSync(this.nasDirectory, { recursive: true, force: true })
    expect(existsSync(this.nasDirectory)).toBe(false)
    return {
      ...parent,
      ...dispatch,
      ...jobs,
      ...uploadedRows,
      ...final,
      tenantTableRows: 0,
      nasDirectories: 0,
      dispatchObjects: 0,
    }
  }

  private variables() {
    return {
      worker_code: this.workerCode,
      job_code: this.jobCode,
      workflow_code: this.workflowCode,
      job_definition_id: String(this.jobDefinitionId),
      job_definition_ids: String(this.jobDefinitionId),
      nas_channel_code: this.nasChannelCode,
      source_file_id: String(this.source?.fileId ?? 0),
    }
  }

  private verifySourceObjectRemoved() {
    if (!this.source) return
    const backend = resolve(__dirname, '../../../../file-batch-system')
    try {
      execFileSync(
        'bash',
        [
          join(backend, 'scripts/lib/minio-mc.sh'),
          'stat',
          '--json',
          `local/${this.source.storageBucket}/${this.objectStorageNamespace}/${this.source.storagePath}`,
        ],
        { cwd: backend, encoding: 'utf8', timeout: 45_000, stdio: 'pipe' },
      )
    } catch (error) {
      const failed = error as { stdout?: Buffer | string; stderr?: Buffer | string }
      const details = `${failed.stdout?.toString() ?? ''}\n${failed.stderr?.toString() ?? ''}`
      if (/NoSuchKey|Object does not exist|specified key does not exist/.test(details)) return
      throw error
    }
    throw new Error('本例DISPATCH源对象清理后仍存在')
  }
}
