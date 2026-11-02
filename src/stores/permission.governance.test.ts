import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePermissionStore } from './permission'

const auth = vi.hoisted(() => ({
  role: 'VIEWER',
  profileLoaded: true,
  authorities: [] as string[],
  menus: [] as Array<{ children: Array<{ path: string }> }>,
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get role() {
      return auth.role
    },
    get profileLoaded() {
      return auth.profileLoaded
    },
    get menus() {
      return auth.menus
    },
    hasPermission: (value: string) => auth.authorities.includes(value),
    hasCapability: () => false,
    canAccess: (role: string) =>
      ['VIEWER', 'OPERATOR', 'ADMIN'].indexOf(auth.role) >=
      ['VIEWER', 'OPERATOR', 'ADMIN'].indexOf(role),
  }),
}))
const allPaths = ['/governance/calendars', '/governance/windows', '/governance/queues']
beforeEach(() => {
  setActivePinia(createPinia())
  auth.menus = [{ children: allPaths.map((path) => ({ path })) }]
})
describe('治理入口菜单权限', () => {
  it.each([
    ['ADMIN', ['ROLE_ADMIN'], 'ADMIN', allPaths],
    ['TENANT_ADMIN', ['ROLE_TENANT_ADMIN'], 'OPERATOR', ['/governance/calendars']],
    ['AUDITOR', ['ROLE_AUDITOR'], 'VIEWER', []],
    ['TENANT_USER', ['ROLE_TENANT_USER'], 'VIEWER', []],
  ])('%s 只能看到符合角色的入口', (_name, authorities, role, expected) => {
    auth.role = role as string
    auth.authorities = authorities as string[]
    const items = usePermissionStore().visibleGroups.flatMap((group) => group.children)
    expect(
      items.filter((item) => allPaths.includes(item.path) && !item.hidden).map((item) => item.path),
    ).toEqual(expected)
  })
  it('后端撤去菜单后不保留入口', () => {
    auth.role = 'ADMIN'
    auth.authorities = ['ROLE_ADMIN']
    auth.menus = []
    const items = usePermissionStore().visibleGroups.flatMap((group) => group.children)
    expect(items.filter((item) => allPaths.includes(item.path))).toEqual([])
  })
})
