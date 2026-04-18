import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getMetaCalendars, getMetaEnums, getMetaWorkerGroups } from '@/api/meta'
import { useTenantStore } from '@/stores/tenant'

/** 全局枚举字典（与租户无关）；多页共享缓存 */
export function useConsoleMetaEnumsQuery() {
  return useQuery({
    queryKey: ['console-meta', 'enums'],
    queryFn: getMetaEnums,
    staleTime: 10 * 60_000,
  })
}

export function useMetaWorkerGroupsQuery() {
  const tenant = useTenantStore()
  return useQuery({
    queryKey: computed(() => ['console-meta', 'worker-groups', tenant.tenantId]),
    queryFn: () => getMetaWorkerGroups(tenant.tenantId),
    enabled: computed(() => !!tenant.tenantId?.trim()),
    staleTime: 5 * 60_000,
  })
}

export function useMetaCalendarsQuery() {
  const tenant = useTenantStore()
  return useQuery({
    queryKey: computed(() => ['console-meta', 'calendars', tenant.tenantId]),
    queryFn: () => getMetaCalendars(tenant.tenantId),
    enabled: computed(() => !!tenant.tenantId?.trim()),
    staleTime: 5 * 60_000,
  })
}
