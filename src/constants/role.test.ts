import { describe, expect, it } from 'vitest'
import { resolveAuthorityRole } from './role'

describe('resolveAuthorityRole', () => {
  it('按平台高权限优先级归一四类正式角色', () => {
    expect(resolveAuthorityRole(['ROLE_ADMIN', 'ROLE_TENANT_ADMIN'])).toBe('ROLE_ADMIN')
    expect(resolveAuthorityRole(['ROLE_AUDITOR', 'ROLE_TENANT_USER'])).toBe('ROLE_AUDITOR')
    expect(resolveAuthorityRole(['ROLE_TENANT_ADMIN'])).toBe('ROLE_TENANT_ADMIN')
    expect(resolveAuthorityRole(['ROLE_TENANT_USER'])).toBe('ROLE_TENANT_USER')
  })

  it('未知角色不映射为正式角色', () => {
    expect(resolveAuthorityRole(['ROLE_UNKNOWN'])).toBeUndefined()
    expect(resolveAuthorityRole([])).toBeUndefined()
  })
})
