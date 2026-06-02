/**
 * 首登 / 系统初始化辅助。提供「系统是否已有租户」的探测,供路由守卫决定是否引导到
 * 首次部署租户创建向导(InitialTenantSetup)。
 *
 * 探测命中后在内存缓存:用户在向导里创建第一个租户后会主动调 invalidate,
 * 之后导航就走正常流程不再探测。
 */
import { listTenants } from '@/api/tenants'

let cached: { hasTenants: boolean } | null = null

export async function systemHasTenants(): Promise<boolean> {
  if (cached) return cached.hasTenants
  const page = await listTenants({ pageNo: 1, pageSize: 1 })
  cached = { hasTenants: (page.total ?? 0) > 0 }
  return cached.hasTenants
}

export function invalidateSystemHasTenantsCache() {
  cached = null
}

export function _resetForTest() {
  cached = null
}
