import { describe, expect, it } from 'vitest'
import { needFirstTenantPick, PLACEHOLDER_TENANT_IDS } from './firstTenantPicker'

describe('needFirstTenantPick', () => {
  it('未登录 → false(picker 不弹)', () => {
    expect(
      needFirstTenantPick({ isLoggedIn: false, isTenantUser: false, storedTenantId: null }),
    ).toBe(false)
    expect(
      needFirstTenantPick({ isLoggedIn: false, isTenantUser: true, storedTenantId: 'ta' }),
    ).toBe(false)
  })

  it('租户级用户(TENANT_ADMIN/TENANT_USER)→ false(BE 已锁租户)', () => {
    expect(
      needFirstTenantPick({ isLoggedIn: true, isTenantUser: true, storedTenantId: null }),
    ).toBe(false)
    expect(
      needFirstTenantPick({ isLoggedIn: true, isTenantUser: true, storedTenantId: 'system' }),
    ).toBe(false)
  })

  it('已登录 + 跨租户角色 + 从未选过 → true', () => {
    expect(
      needFirstTenantPick({ isLoggedIn: true, isTenantUser: false, storedTenantId: null }),
    ).toBe(true)
  })

  it.each([['default'], ['default-tenant'], ['system']])(
    '已登录 + 跨租户角色 + 占位 id %s → true',
    (id) => {
      expect(
        needFirstTenantPick({ isLoggedIn: true, isTenantUser: false, storedTenantId: id }),
      ).toBe(true)
    },
  )

  it('已登录 + 跨租户角色 + 真实业务租户 → false', () => {
    expect(
      needFirstTenantPick({ isLoggedIn: true, isTenantUser: false, storedTenantId: 'ta' }),
    ).toBe(false)
    expect(
      needFirstTenantPick({ isLoggedIn: true, isTenantUser: false, storedTenantId: 'tx' }),
    ).toBe(false)
  })

  it('PLACEHOLDER_TENANT_IDS 三项与 TenantSelect HIDDEN_TENANTS 对齐', () => {
    // TenantSelect.vue HIDDEN_TENANTS = {'default', 'default-tenant', 'system'}
    // 两处都要避免业务租户列表出现这三个 id,保持一致。
    expect(PLACEHOLDER_TENANT_IDS).toEqual(new Set(['default', 'default-tenant', 'system']))
  })
})
