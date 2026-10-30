import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { requiredEnvironment } from '../closure-recovery/fixture'

type SqlScript = 'prepare' | 'state' | 'cleanup' | 'residue'

export interface WorkflowBulkState {
  definitions: Array<{ id: number; workflowCode: string }>
  requests: Array<{
    id: number
    workflowDefinitionId: number
    requestId: string
    status: string
    key: string
  }>
  runs: Array<{
    id: number
    workflowDefinitionId: number
    status: string
    triggerRequestId: number
    bizDate: string
  }>
  nodes: Array<{ workflowRunId: number; nodeCode: string; status: string }>
  terminalEvents: Array<{ key: string; status: string }>
  jobInstances: number
}

/** 每例独占租户；沿用 B182 控制图验收与按已保存数字身份核对残留的方式。 */
export class WorkflowBulkFixture {
  readonly tenantId: string
  readonly calendarCode = 'bulk_calendar'
  readonly codes: string[]
  readonly bizDate: string
  private definitionIds: number[] = []

  constructor(tenantId?: string) {
    this.tenantId = tenantId ?? `e2e-bulk-${randomUUID().replaceAll('-', '')}`
    this.codes = [`${this.tenantId}-A`, `${this.tenantId}-B`]
    this.bizDate = futureWeekday()
  }
  private runIds: number[] = []
  private requestIds: number[] = []

  run<T = unknown>(script: SqlScript): T {
    const variables = {
      tenant_id: this.tenantId,
      calendar_code: this.calendarCode,
      workflow_ids: this.definitionIds.join(','),
      run_ids: this.runIds.join(','),
      request_ids: this.requestIds.join(','),
    }
    const sqlPath = join(__dirname, 'sql', `${script}.sql`)
    const sql = readFileSync(sqlPath, 'utf8')
    const container = requiredEnvironment('E2E_CLOSURE_PG_CONTAINER')
    const user = requiredEnvironment('E2E_CLOSURE_PG_USER')
    const database = requiredEnvironment('E2E_CLOSURE_PG_DATABASE')
    const args = [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      user,
      '-d',
      database,
    ]
    for (const [name, value] of Object.entries(variables)) args.push('-v', `${name}=${value}`)
    const output = execFileSync('docker', args, {
      input: sql,
      encoding: 'utf8',
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
    }).trim()
    return (output ? JSON.parse(output) : undefined) as T
  }

  state(): WorkflowBulkState {
    const state = this.run<WorkflowBulkState>('state')
    this.definitionIds = state.definitions.map((row) => row.id)
    this.runIds = state.runs.map((row) => row.id)
    this.requestIds = state.requests.map((row) => row.id)
    return state
  }

  cleanup(): Record<string, number> {
    this.state()
    this.run('cleanup')
    const residue = this.run<Record<string, number>>('residue')
    const remainingRows = Object.values(residue).reduce((total, count) => total + count, 0)
    if (remainingRows !== 0)
      throw new Error(`Owned bulk fixture residue: ${JSON.stringify(residue)}`)
    return residue
  }
}

function futureWeekday(): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + 21)
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
