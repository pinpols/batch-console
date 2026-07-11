import { get } from '@/api/client'
import type { components } from '@/types/api.generated'

// 后端 #801-804 Map 收敛后已生成真类型;此前手写的 CapacityProfile* interface 与
// generated schema 字段逐一对齐,统一切到生成类型(重新生成:npm run gen:api)。
export type CapacityProfileGroupBy = NonNullable<
  components['schemas']['CapacityProfileResponse']['groupBy']
>
export type CapacityProfileTotals = components['schemas']['CapacityProfileTotals']
export type CapacityProfileCoverage = components['schemas']['CapacityProfileCoverage']
export type CapacityProfileRow = components['schemas']['CapacityProfileRow']
export type CapacityProfileReport = components['schemas']['CapacityProfileResponse']

export interface CapacityProfileQuery {
  tenantId: string
  from?: string
  to?: string
  groupBy?: CapacityProfileGroupBy
  limit?: number
}

export function getCapacityProfile(query: CapacityProfileQuery) {
  return get<CapacityProfileReport>('/api/console/capacity-profile', {
    tenantId: query.tenantId,
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.groupBy ? { groupBy: query.groupBy } : {}),
    ...(query.limit != null ? { limit: query.limit } : {}),
  })
}
