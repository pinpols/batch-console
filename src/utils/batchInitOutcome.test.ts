import { describe, expect, it } from 'vitest'
import { assessBatchInitOutcome } from './batchInitOutcome'

const result = (
  successTenants: number,
  failureTenants: number,
  items: Array<{ tenantId: string; success: boolean }>,
) => ({
  batchOperationId: 'operation-1',
  totalTenants: successTenants + failureTenants,
  successTenants,
  failureTenants,
  dryRun: false,
  results: items,
})

describe('assessBatchInitOutcome', () => {
  it('accepts a complete all-success response', () => {
    expect(
      assessBatchInitOutcome(result(2, 0, [
        { tenantId: 'tenant-a', success: true },
        { tenantId: 'tenant-b', success: true },
      ])).fullySuccessful,
    ).toBe(true)
  })

  it('keeps failed tenants visible on partial success', () => {
    const outcome = assessBatchInitOutcome(result(1, 1, [
      { tenantId: 'tenant-a', success: true },
      { tenantId: 'tenant-b', success: false },
    ]))
    expect(outcome.fullySuccessful).toBe(false)
    expect(outcome.successfulTenantIds).toEqual(['tenant-a'])
    expect(outcome.failedTenantIds).toEqual(['tenant-b'])
  })

  it('fails closed for all-failed or internally inconsistent responses', () => {
    expect(
      assessBatchInitOutcome(result(0, 1, [{ tenantId: 'tenant-a', success: false }]))
        .fullySuccessful,
    ).toBe(false)
    expect(
      assessBatchInitOutcome({
        ...result(1, 0, [{ tenantId: 'tenant-a', success: true }]),
        failureTenants: 1,
      }).fullySuccessful,
    ).toBe(false)
  })

  it('fails closed when an item reports nested failures despite tenant success', () => {
    const outcome = assessBatchInitOutcome({
      ...result(1, 0, [{ tenantId: 'tenant-a', success: true }]),
      results: [
        {
          tenantId: 'tenant-a',
          success: true,
          jobDefinitions: {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 1,
            migrated: 0,
          },
        },
      ],
    })
    expect(outcome.hasFailedItems).toBe(true)
    expect(outcome.fullySuccessful).toBe(false)
  })
})
