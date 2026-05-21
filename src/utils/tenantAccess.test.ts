import { describe, expect, it } from 'vitest'
import { canManageTenants, canSwitchTenant } from './tenantAccess'

describe('tenant access helpers', () => {
  it('allows tenant switching for cross-tenant roles', () => {
    expect(canSwitchTenant(['ROLE_ADMIN'])).toBe(true)
    expect(canSwitchTenant(['ROLE_AUDITOR'])).toBe(true)
  })

  it('denies tenant switching for tenant-scoped roles', () => {
    // TENANT_ADMIN 是租户级管理员,绑定在自己租户
    expect(canSwitchTenant(['ROLE_TENANT_ADMIN'])).toBe(false)
    expect(canSwitchTenant(['ROLE_TENANT_USER'])).toBe(false)
    expect(canSwitchTenant([])).toBe(false)
  })

  it('allows tenant management for admins only', () => {
    expect(canManageTenants(['ROLE_ADMIN'])).toBe(true)
    expect(canManageTenants(['ROLE_TENANT_ADMIN'])).toBe(false)
  })
})
