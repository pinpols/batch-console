import type { Role } from '@/types'

export const roleOrder: Role[] = ['VIEWER', 'OPERATOR', 'ADMIN']

export const roleLabelKeyMap: Record<Role, string> = {
  VIEWER: 'userRole.capabilityViewer',
  OPERATOR: 'userRole.capabilityOperator',
  ADMIN: 'userRole.capabilityAdmin',
}

export const authorityRoles = [
  'ROLE_ADMIN',
  'ROLE_AUDITOR',
  'ROLE_TENANT_ADMIN',
  'ROLE_TENANT_USER',
] as const

export type AuthorityRole = (typeof authorityRoles)[number]

export const authorityRoleLabelKeyMap: Record<AuthorityRole, string> = {
  ROLE_ADMIN: 'roleOptions.admin',
  ROLE_AUDITOR: 'roleOptions.auditor',
  ROLE_TENANT_ADMIN: 'roleOptions.tenantAdmin',
  ROLE_TENANT_USER: 'roleOptions.tenantUser',
}

/**
 * 将后端 authority 归一为四类正式角色。
 */
export function resolveAuthorityRole(permissions: string[] = []): AuthorityRole | undefined {
  if (permissions.includes('ROLE_ADMIN')) return 'ROLE_ADMIN'
  if (permissions.includes('ROLE_AUDITOR')) return 'ROLE_AUDITOR'
  if (permissions.includes('ROLE_TENANT_ADMIN')) return 'ROLE_TENANT_ADMIN'
  if (permissions.includes('ROLE_TENANT_USER')) return 'ROLE_TENANT_USER'
  return undefined
}
