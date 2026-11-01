import { randomUUID } from 'node:crypto'
import { expect } from '../../support/app'
import { WorkerExecutionProgressFixture } from './fixture'

/** 为真实 Worker 同一租户准备额外的独立审计员和租户用户。 */
export class WorkerRoleFixture extends WorkerExecutionProgressFixture {
  readonly auditorName = `worker-auditor-${randomUUID()}`
  readonly userName = `worker-user-${randomUUID()}`
  private rolesPrepared = false

  prepareRoles() {
    // 返回超时不代表事务未提交；清理必须保留本例随机身份。
    this.rolesPrepared = true
    const result = this.ownedSql<{ roleAccountsCreated: number }>('persistent-waits-prepare', {
      auditor_name: this.auditorName,
      user_name: this.userName,
    })
    expect(result.roleAccountsCreated).toBe(2)
  }

  async cleanupRoles() {
    if (!this.rolesPrepared) return 0
    await this.waitForOwnedSqlSessions()
    const remaining = this.ownedSql<number>('persistent-waits-accounts-cleanup', {
      auditor_name: this.auditorName,
      user_name: this.userName,
    })
    expect(remaining, '本例审计员和租户用户必须清零').toBe(0)
    return remaining
  }
}
