/** 系统角色（ADMIN / CONFIG_ADMIN / AUDITOR）均可切换租户 */
export function canSwitchTenant(permissions: string[] = []) {
  return (
    permissions.includes('ROLE_ADMIN') ||
    permissions.includes('ROLE_CONFIG_ADMIN') ||
    permissions.includes('ROLE_AUDITOR')
  )
}

export function canManageTenants(permissions: string[] = []) {
  return permissions.includes('ROLE_ADMIN')
}
