import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { expect, type APIRequestContext } from '@playwright/test'
import { WorkerExecutionProgressFixture } from './fixture'

interface ReplayState {
  failedTaskCodes: string[]
  failedTasks: Array<{ code: string; message: string }>
  runs: Array<{
    id: number
    status: string
    startedAtMs: number | null
    finishedAtMs: number | null
  }>
  nodes: Array<{
    id: number
    runId: number
    code: string
    type: string
    status: string
    jobInstanceId: number | null
  }>
  approvals: Array<{
    number: string
    status: string
    requester: string
    approver: string | null
    targetType: string
    targetId: string
  }>
  operations: Array<{
    id: number
    status: string
    sourceRunId: number
    sourceNodeId: number
    sourceJobId: number
    targetRunId: number | null
    targetRequestId: string | null
    requestedBy: string
    approvedBy: string | null
    total: number
    succeeded: number
    inFlight: number
  }>
  commands: Array<{ status: string; type: string; sourceJobId: number }>
}

/** 未知结果拒绝与已知失败重放；仅补齐业务输入，不改写运行状态。 */
export class WorkflowReplayFixture extends WorkerExecutionProgressFixture {
  readonly tableName = `progress_replay_${randomUUID().replaceAll('-', '').slice(0, 16)}`
  private replayPrepared = false
  private inputServer?: Server
  private inputResponseReleased = false
  private readonly pendingInputResponses = new Set<() => void>()
  readonly httpResults: number[] = []

  get pendingInputRequests() {
    return this.pendingInputResponses.size
  }

  releaseSuccessfulInput() {
    this.inputResponseReleased = true
    for (const finish of this.pendingInputResponses) finish()
  }

  async startInputServer() {
    const path = `/replay-input/${randomUUID()}`
    const server = createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== path) {
        response.writeHead(404).end()
        return
      }
      try {
        const state = this.ownedSql<{ businessRows: number }>('workflow-replay-input-state', {
          table_name: this.tableName,
        })
        const status = state.businessRows === 1 ? 200 : 503
        let deadline: ReturnType<typeof setTimeout> | undefined
        const finish = () => {
          clearTimeout(deadline)
          this.pendingInputResponses.delete(finish)
          this.httpResults.push(status)
          response.writeHead(status, { 'Content-Type': 'text/plain' }).end('fixture')
        }
        if (status === 200 && !this.inputResponseReleased) {
          this.pendingInputResponses.add(finish)
          deadline = setTimeout(() => {
            this.pendingInputResponses.delete(finish)
            response.writeHead(504).end('fixture response was not released')
          }, 25_000)
          response.once('close', () => {
            clearTimeout(deadline)
            this.pendingInputResponses.delete(finish)
          })
        } else finish()
      } catch {
        response.writeHead(500).end()
      }
    })
    this.inputServer = server
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('本例业务输入服务未绑定TCP端口')
    return `http://127.0.0.1:${address.port}${path}`
  }

  prepareReplayInput() {
    expect(this.ownedSql('workflow-replay-prepare', { table_name: this.tableName })).toEqual({
      businessTables: 1,
    })
    this.replayPrepared = true
  }

  repairBusinessInput() {
    expect(this.ownedSql('workflow-replay-repair', { table_name: this.tableName })).toEqual({
      businessRows: 1,
    })
  }

  replayState() {
    return this.ownedSql<ReplayState>('workflow-replay-state')
  }

  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    this.releaseSuccessfulInput()
    let replayCleanup: Record<string, number> = {}
    let replayError: unknown
    try {
      if (this.replayPrepared) {
        await expect
          .poll(
            () => {
              const state = this.replayState()
              return (
                state.operations.every((row) => row.status !== 'RUNNING') &&
                state.runs.every((row) => ['SUCCESS', 'FAILED', 'TERMINATED'].includes(row.status))
              )
            },
            { timeout: 90_000 },
          )
          .toBe(true)
        replayCleanup = this.ownedSql<Record<string, number>>('workflow-replay-cleanup', {
          table_name: this.tableName,
        })
        expect(Object.values(replayCleanup).every((count) => count === 0)).toBe(true)
      }
    } catch (error) {
      replayError = error
    }
    try {
      const parentCleanup = await super.finish(request, reader)
      if (replayError) throw replayError
      const finalCleanup = this.ownedSql<Record<string, number>>('workflow-replay-final-cleanup')
      expect(Object.values(finalCleanup).every((count) => count === 0)).toBe(true)
      const residue = this.ownedSql<Record<string, number>>('workflow-replay-residue')
      expect(residue, '本例租户在所有业务表与归档表中不应遗留副作用').toEqual({})
      return { ...parentCleanup, ...replayCleanup, ...finalCleanup, tenantTableRows: 0 }
    } catch (error) {
      if (replayError && error !== replayError)
        throw new AggregateError([replayError, error], 'Workflow重放验收清理未完成')
      throw error
    } finally {
      this.inputServer?.closeAllConnections()
      if (this.inputServer)
        await new Promise<void>((resolve) => this.inputServer!.close(() => resolve()))
    }
  }
}
