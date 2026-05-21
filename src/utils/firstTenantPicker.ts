/**
 * 「首次选租户」对话框的纯函数判定。
 *
 * 触发条件:已登录 + 非租户级用户 + (从未落过 tenantId 或落的是占位 id)。
 * 占位 id 是 BE 上有但用户不该当作业务租户用的:
 *   - `default`        — V55 配置模板库
 *   - `default-tenant` — V42 演示账号孤儿,V148 兜底清
 *   - `system`         — admin 账号宿主,非工作租户
 *
 * 抽成 util 是为了避免对 SFC + element-plus 的 vitest 配置坑(参考 §测试约定);
 * 同时让 FirstTenantPickerDialog.vue 只剩 template + 一行 watch,易读。
 */
const PLACEHOLDER_IDS = new Set(['default', 'default-tenant', 'system'])

export function needFirstTenantPick(opts: {
  isLoggedIn: boolean
  /** TENANT_ADMIN / TENANT_USER 一律视作 tenant scoped,不弹 picker */
  isTenantUser: boolean
  /** localStorage 当前值;null = 从未落过 */
  storedTenantId: string | null
}): boolean {
  if (!opts.isLoggedIn) return false
  if (opts.isTenantUser) return false
  if (!opts.storedTenantId) return true
  return PLACEHOLDER_IDS.has(opts.storedTenantId)
}

export const PLACEHOLDER_TENANT_IDS = PLACEHOLDER_IDS
