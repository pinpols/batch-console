/**
 * 租户 ID 校验,跟后端 ReservedPrefixGuard 完全对齐。从 TenantIdInput.vue 抽出 pure 函数,便于单测 +
 * 给其他场景(批量初始化 / 导入 yaml)复用。
 *
 * 规则:
 *  - 必须以字母/数字开头,1-64 字符,只能 [A-Za-z0-9._-]
 *  - 禁用保留前缀:e2e- / qa- / dev- / local- / test- / _internal-
 *  - 禁用保留 id(忽略大小写):system / default / admin
 */

export const RESERVED_TENANT_PREFIXES = [
  'e2e-',
  'qa-',
  'dev-',
  'local-',
  'test-',
  '_internal-',
] as const

export const RESERVED_TENANT_IDS = ['system', 'default', 'admin'] as const

export const TENANT_ID_FORMAT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export type TenantIdViolation = 'EMPTY' | 'FORMAT' | 'RESERVED_ID' | 'RESERVED_PREFIX'

export interface TenantIdValidationResult {
  ok: boolean
  violation?: TenantIdViolation
  /** RESERVED_PREFIX 时携带具体匹配前缀,便于 UI 提示 */
  matchedPrefix?: string
}

export function validateTenantId(value: string | null | undefined): TenantIdValidationResult {
  if (!value) return { ok: false, violation: 'EMPTY' }
  if (!TENANT_ID_FORMAT.test(value)) return { ok: false, violation: 'FORMAT' }
  const lower = value.toLowerCase()
  if ((RESERVED_TENANT_IDS as readonly string[]).includes(lower)) {
    return { ok: false, violation: 'RESERVED_ID' }
  }
  for (const p of RESERVED_TENANT_PREFIXES) {
    if (lower.startsWith(p)) {
      return { ok: false, violation: 'RESERVED_PREFIX', matchedPrefix: p }
    }
  }
  return { ok: true }
}
