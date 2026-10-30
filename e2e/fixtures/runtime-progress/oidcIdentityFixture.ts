import { randomUUID } from 'node:crypto'
import { ControlProgressFixture } from './fixture'
import { requiredEnvironment } from '../closure-recovery/fixture'

export interface OidcIdentityState {
  identityCount: number
  identity: {
    id: number
    username: string
    issuer: string
    subject: string
    linkedBy: string
  } | null
  auditActions: Array<{ action: string; result: string }>
  accountRoles: string | null
}

/** OIDC管理验收复用独占租户与正式认证夹具；SQL只独立读回及精确清理绑定审计。 */
export class OidcIdentityFixture extends ControlProgressFixture {
  readonly subject = `e2e-oidc-${randomUUID()}`

  constructor() {
    super(requiredEnvironment('E2E_OIDC_TENANT_ID'))
  }

  oidcState(): OidcIdentityState {
    return this.ownedSql<OidcIdentityState>('oidc-identity-state', {
      oidc_subject: this.subject,
    })
  }

  cleanupOidc(): Record<string, number> {
    const deleted = this.ownedSql<{ identityDeleted: number; auditDeleted: number }>(
      'oidc-identity-cleanup',
      { oidc_subject: this.subject },
    )
    const readback = this.oidcState()
    return {
      ...deleted,
      identityRemaining: readback.identityCount,
      auditRemaining: readback.auditActions.length,
    }
  }
}
