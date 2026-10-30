import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type SqlScript = 'prepare-tenants' | 'prepare-notifications' | 'install-sync-fault' |
  'remove-sync-fault' | 'config-sync-state' | 'notification-state' | 'cleanup'

/** 专属租户夹具；SQL 独立保存，psql 参数按引用传入，不拼接 Shell 或 SQL。 */
export class ClosureRecoveryFixture {
  readonly suffix = randomUUID().replaceAll('-', '')
  readonly tenantId = `e2e-closure-${this.suffix}`
  readonly targetA = `e2e-closure-a-${this.suffix}`
  readonly targetB = `e2e-closure-b-${this.suffix}`
  readonly queueCode = `e2e_queue_${this.suffix}`
  readonly hotEvent = `${this.tenantId}:hot`
  readonly coldEvent = `${this.tenantId}:cold`
  private readonly faultName = `e2e_sync_fault_${this.suffix}`

  run<T = unknown>(script: SqlScript): T {
    const container = requiredEnvironment('E2E_CLOSURE_PG_CONTAINER')
    const user = requiredEnvironment('E2E_CLOSURE_PG_USER')
    const database = requiredEnvironment('E2E_CLOSURE_PG_DATABASE')
    const variables = {
      tenant_id: this.tenantId, target_a: this.targetA, target_b: this.targetB,
      queue_code: this.queueCode, hot_event: this.hotEvent, cold_event: this.coldEvent,
      fault_name: this.faultName,
    }
    const sqlPath = join(__dirname, 'sql', `${script}.sql`)
    const sql = readFileSync(sqlPath, 'utf8')
    const args = ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
      '-U', user, '-d', database]
    for (const [name, value] of Object.entries(variables)) args.push('-v', `${name}=${value}`)
    const output = execFileSync('docker', args, {
      input: sql, encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 * 1024,
    }).trim()
    return (output ? JSON.parse(output) : undefined) as T
  }

  cleanup(): void {
    const remaining = this.run<number>('cleanup')
    if (remaining !== 0) throw new Error(`Owned closure fixture residue count: ${remaining}`)
  }
}

export function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) throw new Error(`${name} is required for the real closure acceptance`)
  return value
}
