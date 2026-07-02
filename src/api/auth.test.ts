import { describe, it, expect } from 'vitest'
import { mapProfileToUserInfo } from './auth'

describe('mapProfileToUserInfo (role mapping)', () => {
  it('ROLE_ADMIN → ADMIN', () => {
    const info = mapProfileToUserInfo({
      username: 'u',
      tenantId: 'ta',
      authorities: ['ROLE_ADMIN'],
    })
    expect(info.role).toBe('ADMIN')
    expect(info.permissions).toEqual(['ROLE_ADMIN'])
  })

  it('ROLE_TENANT_ADMIN → OPERATOR', () => {
    const info = mapProfileToUserInfo({
      username: 'u',
      tenantId: 'ta',
      authorities: ['ROLE_TENANT_ADMIN'],
    })
    expect(info.role).toBe('OPERATOR')
  })

  it('ROLE_AUDITOR → VIEWER', () => {
    const info = mapProfileToUserInfo({
      username: 'u',
      tenantId: 'ta',
      authorities: ['ROLE_AUDITOR'],
    })
    expect(info.role).toBe('VIEWER')
  })

  it('ROLE_TENANT_USER → OPERATOR;未知 / 空 authorities → VIEWER (safe fallback)', () => {
    // #175:ROLE_TENANT_USER 有自助写权限,映射到 OPERATOR(不再兜底成 VIEWER)。
    expect(
      mapProfileToUserInfo({
        username: 'u',
        tenantId: 'ta',
        authorities: ['ROLE_TENANT_USER'],
      }).role,
    ).toBe('OPERATOR')
    expect(mapProfileToUserInfo({ username: 'u', tenantId: 'ta', authorities: [] }).role).toBe(
      'VIEWER',
    )
  })

  it('ADMIN wins over TENANT_ADMIN when both present (priority order)', () => {
    const info = mapProfileToUserInfo({
      username: 'u',
      tenantId: 'ta',
      authorities: ['ROLE_TENANT_ADMIN', 'ROLE_ADMIN'],
    })
    expect(info.role).toBe('ADMIN')
  })

  it('passes through menus / mustChangePassword / passwordExpiringIn', () => {
    const info = mapProfileToUserInfo({
      username: 'u',
      tenantId: 'ta',
      authorities: ['ROLE_ADMIN'],
      menus: [{ title: 'Ops', items: [] }] as never,
      mustChangePassword: true,
      passwordExpiringIn: 3,
    })
    expect(info.menus).toEqual([{ title: 'Ops', items: [] }])
    expect(info.mustChangePassword).toBe(true)
    expect(info.passwordExpiringIn).toBe(3)
  })

  it('null/undefined authorities → empty permissions + VIEWER', () => {
    const info = mapProfileToUserInfo({
      username: 'u',
      tenantId: 'ta',
      authorities: null as never,
    })
    expect(info.role).toBe('VIEWER')
    expect(info.permissions).toEqual([])
  })

  it('mustChangePassword undefined → undefined (not coerced false)', () => {
    const info = mapProfileToUserInfo({
      username: 'u',
      tenantId: 'ta',
      authorities: [],
    })
    expect(info.mustChangePassword).toBeUndefined()
    expect(info.passwordExpiringIn).toBeUndefined()
  })

  it('userId mirrors username', () => {
    const info = mapProfileToUserInfo({
      username: 'alice',
      tenantId: 'ta',
      authorities: [],
    })
    expect(info.userId).toBe('alice')
    expect(info.username).toBe('alice')
  })
})
