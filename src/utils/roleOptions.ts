/**
 * 控制台账号管理「角色多选」的可选项集合 + 按当前操作者过滤。
 *
 * 与 BE `ConsoleUserAccountService.enforceGrantableAuthorities` 对齐:
 *   - 平台 ADMIN  → 看全部 5 项,可授任意
 *   - TENANT_ADMIN → 只看 3 项(TENANT_ADMIN / TENANT_USER / USER),授 ADMIN/AUDITOR 直接 403
 *
 * FE 这层只是 UX 收敛(避免给用户看不可用选项),真正守卫在 BE。
 */
export type RoleOption = {
  value: string
  label: string
  /** 仅平台 ADMIN 能授予;TENANT_ADMIN 看不到也提不上去 */
  adminOnly: boolean
}

export const ALL_ROLE_OPTIONS: ReadonlyArray<RoleOption> = [
  { value: 'ROLE_ADMIN', label: 'ROLE_ADMIN (平台管理员)', adminOnly: true },
  { value: 'ROLE_AUDITOR', label: 'ROLE_AUDITOR (审计员)', adminOnly: true },
  { value: 'ROLE_TENANT_ADMIN', label: 'ROLE_TENANT_ADMIN (租户管理员)', adminOnly: false },
  { value: 'ROLE_TENANT_USER', label: 'ROLE_TENANT_USER (租户用户)', adminOnly: false },
  { value: 'ROLE_USER', label: 'ROLE_USER (兼容旧 JWT)', adminOnly: false },
]

export function filterRoleOptionsFor(isPlatformAdmin: boolean): RoleOption[] {
  return ALL_ROLE_OPTIONS.filter((opt) => isPlatformAdmin || !opt.adminOnly)
}
