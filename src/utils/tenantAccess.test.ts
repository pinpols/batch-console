import { describe, expect, it } from 'vitest'
import { canManageTenants, canSwitchTenant } from './tenantAccess'

describe('tenant access helpers', () => {
  it('allows tenant switching for all system roles', () => {
    expect(canSwitchTenant(['ROLE_ADMIN'])).toBe(true)
    expect(canSwitchTenant(['ROLE_CONFIG_ADMIN'])).toBe(true)
    expect(canSwitchTenant(['ROLE_AUDITOR'])).toBe(true)
  })

  it('denies tenant switching for tenant users', () => {
    expect(canSwitchTenant(['ROLE_TENANT_USER'])).toBe(false)
    expect(canSwitchTenant([])).toBe(false)
  })

  it('allows tenant management for admins only', () => {
    expect(canManageTenants(['ROLE_ADMIN'])).toBe(true)
    expect(canManageTenants(['ROLE_CONFIG_ADMIN'])).toBe(false)
  })
})
