import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './support/app'
import { ControlProgressFixture, PersistentWaitFixture } from './fixtures/runtime-progress/fixture'
import { requiredEnvironment } from './fixtures/closure-recovery/fixture'

const enabled = process.env.E2E_FIXTURE_RECOVERY_REAL === '1'
if (enabled && process.env.E2E_SKIP_GLOBAL_SETUP !== '1')
  throw new Error('Set E2E_SKIP_GLOBAL_SETUP=1; this suite owns its identities and cleanup')
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block', trace: 'off' })
test.setTimeout(180_000)
test.skip(!enabled, 'Requires the isolated real PostgreSQL and enforced Console authentication')

/** 真正提交后保留 SQL 会话，再让 Docker 调用超时，模拟结果丢失。 */
class CommitTimeoutFixture extends ControlProgressFixture {
  private credentialHashForCheck = ''

  constructor(private readonly timeoutStage: 'tenant' | 'credentials') {
    super()
  }

  override run<T = unknown>(script: 'prepare' | 'state' | 'cleanup' | 'residue'): T {
    if (script !== 'prepare' || this.timeoutStage !== 'tenant') return super.run<T>(script)
    return timeoutAfterCommit<T>(this.sqlApplicationName, 'workflow-bulk/sql/prepare.sql', {
      tenant_id: this.tenantId,
      calendar_code: this.calendarCode,
    })
  }

  protected override prepareCredentials(passwordHash: string): number[] {
    if (this.timeoutStage !== 'credentials') return super.prepareCredentials(passwordHash)
    this.credentialHashForCheck = passwordHash
    return timeoutAfterCommit<number[]>(
      this.sqlApplicationName,
      'runtime-progress/sql/credentials-prepare.sql',
      {
        tenant_id: this.tenantId,
        admin_name: this.adminName,
        reader_name: this.readerName,
        password_hash: passwordHash,
      },
    )
  }

  committedCredentials() {
    return this.ownedSql<{ ids: number[]; mismatches: number }>('credentials-recover', {
      password_hash: this.credentialHashForCheck,
    })
  }

  activeOwnedSessions() {
    return this.ownedSql<number>('active-owned-sessions')
  }
}

function timeoutAfterCommit<T>(
  applicationName: string,
  relativePath: string,
  variables: Record<string, string>,
): T {
  const sql = readFileSync(resolve('e2e/fixtures', relativePath), 'utf8')
  const args = [
    'exec',
    '-i',
    '-e',
    `PGAPPNAME=${applicationName}`,
    requiredEnvironment('E2E_CLOSURE_PG_CONTAINER'),
    'psql',
    '-X',
    '-qAt',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    requiredEnvironment('E2E_CLOSURE_PG_USER'),
    '-d',
    requiredEnvironment('E2E_CLOSURE_PG_DATABASE'),
  ]
  for (const [name, value] of Object.entries(variables)) args.push('-v', `${name}=${value}`)
  const output = execFileSync('docker', args, {
    input: `${sql}\nSELECT pg_sleep(20);\n`,
    encoding: 'utf8',
    timeout: 10_000,
  })
  return JSON.parse(output) as T
}

class WaitRoleTimeoutFixture extends PersistentWaitFixture {
  protected override insertWaitRoles() {
    return timeoutAfterCommit<{ roleAccountsCreated: number }>(
      this.sqlApplicationName,
      'runtime-progress/sql/persistent-waits-prepare.sql',
      {
        tenant_id: this.tenantId,
        admin_name: this.adminName,
        auditor_name: this.auditorName,
        user_name: this.userName,
      },
    )
  }

  committedRoles() {
    return this.ownedSql<number>('persistent-waits-accounts-state', {
      auditor_name: this.auditorName,
      user_name: this.userName,
    })
  }

  activeOwnedSessions() {
    return this.ownedSql<number>('active-owned-sessions')
  }
}

for (const stage of ['tenant', 'credentials'] as const) {
  test(`独占夹具 ${stage} 提交后超时仍能精确清理`, async ({ page }, testInfo) => {
    const fixture = new CommitTimeoutFixture(stage)
    let cleaned = false
    try {
      expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
      let failure: unknown
      try {
        fixture.prepare()
      } catch (error) {
        failure = error
      }
      expect(failure).toMatchObject({ code: 'ETIMEDOUT' })
      const before = fixture.run<Record<string, number>>('residue')
      expect(before.tenants, '注入时租户事务必须已提交').toBe(1)
      expect(fixture.activeOwnedSessions(), '提交后的 SQL 会话仍在等待').toBeGreaterThan(0)
      if (stage === 'credentials') {
        const accounts = fixture.committedCredentials()
        expect(accounts.ids).toHaveLength(2)
        expect(accounts.mismatches).toBe(0)
      }
      const cleanup = await fixture.finish(page.request)
      cleaned = true
      expect(fixture.activeOwnedSessions()).toBe(0)
      expect(Object.values(cleanup).every((value) => value === 0)).toBe(true)
      await testInfo.attach(`fixture-${stage}-recovery.json`, {
        body: JSON.stringify({ stage, commitObserved: true, timedOut: true, cleanup }),
        contentType: 'application/json',
      })
    } finally {
      if (!cleaned) await fixture.finish(page.request)
    }
  })
}

test('独占夹具附属角色提交后超时仍能精确清理', async ({ page }, testInfo) => {
  const fixture = new WaitRoleTimeoutFixture()
  let cleaned = false
  try {
    expect((await page.request.get('/api/console/auth/me')).status()).toBe(401)
    fixture.prepare()
    let failure: unknown
    try {
      fixture.prepareWaitRoles()
    } catch (error) {
      failure = error
    }
    expect(failure).toMatchObject({ code: 'ETIMEDOUT' })
    expect(fixture.committedRoles(), '注入时附属角色事务必须已提交').toBe(2)
    expect(fixture.activeOwnedSessions(), '提交后的 SQL 会话仍在等待').toBeGreaterThan(0)
    const cleanup = await fixture.finish(page.request)
    cleaned = true
    expect(fixture.activeOwnedSessions()).toBe(0)
    expect(Object.values(cleanup).every((value) => value === 0)).toBe(true)
    await testInfo.attach('fixture-roles-recovery.json', {
      body: JSON.stringify({ stage: 'roles', commitObserved: true, timedOut: true, cleanup }),
      contentType: 'application/json',
    })
  } finally {
    if (!cleaned) await fixture.finish(page.request)
  }
})
