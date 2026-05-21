/**
 * 跨租户角色(ADMIN / AUDITOR)可切换租户;TENANT_ADMIN / TENANT_USER 都绑定在自己租户,不可切换。
 * 2026-05 角色重设计:TENANT_ADMIN 是租户级管理员,不再像旧 CONFIG_ADMIN 一样跨租户。
 */
export function canSwitchTenant(permissions: string[] = []) {
  return permissions.includes('ROLE_ADMIN') || permissions.includes('ROLE_AUDITOR')
}

export function canManageTenants(permissions: string[] = []) {
  return permissions.includes('ROLE_ADMIN')
}
