import { describe, expect, it } from 'vitest'
import { ALL_ROLE_OPTIONS, filterRoleOptionsFor } from './roleOptions'

describe('filterRoleOptionsFor', () => {
  it('平台 ADMIN 看到全部 5 个角色', () => {
    const opts = filterRoleOptionsFor(true)
    expect(opts).toHaveLength(5)
    expect(opts.map((o) => o.value)).toEqual([
      'ROLE_ADMIN',
      'ROLE_AUDITOR',
      'ROLE_TENANT_ADMIN',
      'ROLE_TENANT_USER',
      'ROLE_USER',
    ])
  })

  it('TENANT_ADMIN 只看 3 项,藏 ROLE_ADMIN / ROLE_AUDITOR', () => {
    const opts = filterRoleOptionsFor(false)
    expect(opts).toHaveLength(3)
    const vals = opts.map((o) => o.value)
    expect(vals).not.toContain('ROLE_ADMIN')
    expect(vals).not.toContain('ROLE_AUDITOR')
    expect(vals).toContain('ROLE_TENANT_ADMIN')
    expect(vals).toContain('ROLE_TENANT_USER')
    expect(vals).toContain('ROLE_USER')
  })

  it('ALL_ROLE_OPTIONS 长度 + adminOnly 标记跟 BE TENANT_ADMIN_GRANTABLE_ROLES 对齐', () => {
    // BE 的 ConsoleUserAccountService.TENANT_ADMIN_GRANTABLE_ROLES = {TENANT_ADMIN, TENANT_USER, USER}
    // 这里 adminOnly=false 的项必须等于这 3 项 — 守护边界
    const grantable = ALL_ROLE_OPTIONS.filter((o) => !o.adminOnly).map((o) => o.value)
    expect(grantable.sort()).toEqual(['ROLE_TENANT_ADMIN', 'ROLE_TENANT_USER', 'ROLE_USER'].sort())
  })
})
