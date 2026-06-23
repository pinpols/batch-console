/**
 * 控制台账号管理「角色多选」的可选项集合 + 按当前操作者过滤。
 *
 * 与 BE `ConsoleUserAccountService.enforceGrantableAuthorities` 对齐:
 *   - 平台 ADMIN  → 看全部 5 项,可授任意
 *   - TENANT_ADMIN → 只看 3 项(TENANT_ADMIN / TENANT_USER / USER),授 ADMIN/AUDITOR 直接 403
 *
 * FE 这层只是 UX 收敛(避免给用户看不可用选项),真正守卫在 BE。
 *
 * label 的中文描述走 i18n:普通模块不能用 useI18n(),由 filterRoleOptionsFor 在被调用时
 * 用 i18n.global.t 解析(调用方包在 computed 里,locale 切换会重算)。
 */
import { i18n } from '@/locales'

export type RoleOption = {
  value: string
  label: string
  /** 仅平台 ADMIN 能授予;TENANT_ADMIN 看不到也提不上去 */
  adminOnly: boolean
}

/** 角色定义:value + i18n 描述 key + adminOnly。label 在 filterRoleOptionsFor 解析。 */
type RoleOptionDef = {
  value: string
  labelKey: string
  adminOnly: boolean
}

const ROLE_OPTION_DEFS: ReadonlyArray<RoleOptionDef> = [
  { value: 'ROLE_ADMIN', labelKey: 'roleOptions.admin', adminOnly: true },
  { value: 'ROLE_AUDITOR', labelKey: 'roleOptions.auditor', adminOnly: true },
  { value: 'ROLE_TENANT_ADMIN', labelKey: 'roleOptions.tenantAdmin', adminOnly: false },
  { value: 'ROLE_TENANT_USER', labelKey: 'roleOptions.tenantUser', adminOnly: false },
  { value: 'ROLE_USER', labelKey: 'roleOptions.user', adminOnly: false },
]

function toRoleOption(def: RoleOptionDef): RoleOption {
  return {
    value: def.value,
    label: `${def.value} (${i18n.global.t(def.labelKey)})`,
    adminOnly: def.adminOnly,
  }
}

/**
 * 全部角色选项(label 当前 locale 已解析)。
 * 注意:这是 getter,每次访问按当前 locale 重新解析,locale 切换后取到的是新文案。
 */
export const ALL_ROLE_OPTIONS: ReadonlyArray<RoleOption> = ROLE_OPTION_DEFS.map(toRoleOption)

export function filterRoleOptionsFor(isPlatformAdmin: boolean): RoleOption[] {
  return ROLE_OPTION_DEFS.filter((opt) => isPlatformAdmin || !opt.adminOnly).map(toRoleOption)
}
