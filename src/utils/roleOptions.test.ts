import { describe, expect, it } from 'vitest'
import { ALL_ROLE_OPTIONS, filterRoleOptionsFor } from './roleOptions'

describe('filterRoleOptionsFor', () => {
  it('平台 ADMIN 看到全部 4 个正式角色', () => {
    const opts = filterRoleOptionsFor(true)
    expect(opts).toHaveLength(4)
    expect(opts.map((o) => o.value)).toEqual([
      'ROLE_ADMIN',
      'ROLE_AUDITOR',
      'ROLE_TENANT_ADMIN',
      'ROLE_TENANT_USER',
    ])
  })

  it('TENANT_ADMIN 只看 2 项,藏平台角色和兼容角色', () => {
    const opts = filterRoleOptionsFor(false)
    expect(opts).toHaveLength(2)
    const vals = opts.map((o) => o.value)
    expect(vals).not.toContain('ROLE_ADMIN')
    expect(vals).not.toContain('ROLE_AUDITOR')
    expect(vals).toContain('ROLE_TENANT_ADMIN')
    expect(vals).toContain('ROLE_TENANT_USER')
  })

  it('ALL_ROLE_OPTIONS 只包含正式角色', () => {
    const grantable = ALL_ROLE_OPTIONS.filter((o) => !o.adminOnly).map((o) => o.value)
    expect(grantable.sort()).toEqual(['ROLE_TENANT_ADMIN', 'ROLE_TENANT_USER'].sort())
    expect(ALL_ROLE_OPTIONS.map((o) => o.value).sort()).toEqual(
      ['ROLE_ADMIN', 'ROLE_AUDITOR', 'ROLE_TENANT_ADMIN', 'ROLE_TENANT_USER'].sort(),
    )
  })
})
