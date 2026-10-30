import { describe, expect, it } from 'vitest'
import { tagResourceIdentityMatches } from './tagResourceIdentity'

describe('tag resource identity', () => {
  it('accepts the same loaded tenant and resource', () => {
    expect(
      tagResourceIdentityMatches(
        { tenantId: 'tenant-a', resourceType: 'JOB', resourceCode: 'job-a' },
        { tenantId: 'tenant-a', resourceType: 'JOB', resourceCode: 'job-a' },
      ),
    ).toBe(true)
  })

  it.each([
    ['tenant', { tenantId: 'tenant-b', resourceType: 'JOB', resourceCode: 'job-a' }],
    ['resource type', { tenantId: 'tenant-a', resourceType: 'WORKFLOW', resourceCode: 'job-a' }],
    ['resource code', { tenantId: 'tenant-a', resourceType: 'JOB', resourceCode: 'job-b' }],
  ])('rejects changed %s identity', (_label, actual) => {
    expect(
      tagResourceIdentityMatches(
        { tenantId: 'tenant-a', resourceType: 'JOB', resourceCode: 'job-a' },
        actual,
      ),
    ).toBe(false)
  })

  it('rejects operations when no resource result is loaded', () => {
    expect(
      tagResourceIdentityMatches(null, {
        tenantId: 'tenant-a',
        resourceType: 'JOB',
        resourceCode: 'job-a',
      }),
    ).toBe(false)
  })
})
