import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { queryWorkers } from '@/api/workers'
import { useTenantStore } from '@/stores/tenant'

/**
 * 获取当前租户的全量 Worker 列表，30s 内缓存不重复请求。
 * queryKey 包含 tenantId，切换租户自动重新获取。
 */
export function useWorkers() {
  const tenant = useTenantStore()
  const enabled = computed(() => !!tenant.tenantId)

  return useQuery({
    queryKey: computed(() => ['workers', tenant.tenantId]),
    queryFn: () => queryWorkers(tenant.tenantId),
    enabled,
  })
}
