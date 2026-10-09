import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from './storageKeys'

describe('STORAGE_KEYS', () => {
  it('preserves persisted keys used by previously released versions', () => {
    expect(STORAGE_KEYS).toEqual({
      tenantId: 'batch-console-tenant-id',
      operationLog: 'batch-console-oplog',
      session: 'batch-console-session',
      telemetry: 'batch-console-telemetry',
    })
  })
})
