export interface TagResourceIdentity {
  tenantId: string
  resourceType: string
  resourceCode: string
}

export function tagResourceIdentityMatches(
  expected: TagResourceIdentity | null,
  actual: TagResourceIdentity,
): boolean {
  if (!expected) return false
  if (expected.tenantId !== actual.tenantId) return false
  if (expected.resourceType !== actual.resourceType) return false
  const expectedResourceCode = expected.resourceCode.trim()
  const actualResourceCode = actual.resourceCode.trim()
  return expectedResourceCode === actualResourceCode
}
