import { describe, expect, it } from 'vitest'
import { navigationGroups } from './navigation'
import { authorityRoles } from './role'

const navigationItems = navigationGroups.flatMap((group) => group.children)

function item(path: string) {
  const found = navigationItems.find((candidate) => candidate.path === path)
  expect(found, `navigation item ${path}`).toBeDefined()
  return found!
}

describe('navigation role authorities', () => {
  it('所有精确白名单只引用四类正式角色', () => {
    const allowed = new Set<string>(authorityRoles)
    const configured = navigationItems.flatMap((candidate) => candidate.authorities ?? [])

    expect(configured.length).toBeGreaterThan(0)
    expect(configured.every((authority) => allowed.has(authority))).toBe(true)
  })

  it('高风险与自助入口使用明确角色边界', () => {
    expect(item('/approvals').authorities).toEqual(['ROLE_ADMIN', 'ROLE_TENANT_ADMIN'])
    expect(item('/self-service').authorities).toEqual([
      'ROLE_ADMIN',
      'ROLE_TENANT_ADMIN',
      'ROLE_TENANT_USER',
    ])
    expect(item('/system/api-keys').authorities).toEqual([
      'ROLE_ADMIN',
      'ROLE_TENANT_ADMIN',
      'ROLE_TENANT_USER',
    ])
    expect(item('/system/users').authorities).toEqual([...authorityRoles])
  })
})
