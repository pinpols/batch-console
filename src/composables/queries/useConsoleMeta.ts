import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import {
  getMetaBizTypes,
  getMetaCalendars,
  getMetaEnums,
  getMetaWindows,
  getMetaWorkerGroups,
} from '@/api/meta'
import { useTenantStore } from '@/stores/tenant'

/**
 * 全局枚举字典(与租户无关);多页共享缓存。
 * staleTime 2 分钟:既避免每次挂载都拉,又让后端修文案后较快生效。
 * 真要强制刷新可调用 `queryClient.invalidateQueries({ queryKey: ['console-meta', 'enums'] })`。
 */
export function useConsoleMetaEnumsQuery() {
  return useQuery({
    queryKey: ['console-meta', 'enums'],
    queryFn: getMetaEnums,
    staleTime: 2 * 60_000,
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

export function useMetaWindowsQuery() {
  const tenant = useTenantStore()
  return useQuery({
    queryKey: computed(() => ['console-meta', 'windows', tenant.tenantId]),
    queryFn: () => getMetaWindows(tenant.tenantId),
    enabled: computed(() => !!tenant.tenantId?.trim()),
    staleTime: 5 * 60_000,
  })
}

export function useMetaBizTypesQuery() {
  const tenant = useTenantStore()
  return useQuery({
    queryKey: computed(() => ['console-meta', 'biz-types', tenant.tenantId]),
    queryFn: () => getMetaBizTypes(tenant.tenantId),
    enabled: computed(() => !!tenant.tenantId?.trim()),
    staleTime: 5 * 60_000,
  })
}
