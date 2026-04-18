import { computed, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jobApi } from '@/api/job'
import { useTenantStore } from '@/stores/tenant'

/**
 * 获取指定租户的全量 Job 定义列表，30s 内缓存不重复请求。
 * queryKey 包含 tenantId，切换租户自动重新获取。
 *
 * @param tenantIdOverride 可选，若传入则优先使用该值；否则取全局 tenant store
 */
export function useJobDefinitions(tenantIdOverride?: Ref<string>) {
  const tenant = useTenantStore()
  const effectiveTenantId = computed(() => tenantIdOverride?.value || tenant.tenantId)

  return useQuery({
    queryKey: computed(() => ['job-definitions', effectiveTenantId.value]),
    queryFn: () => jobApi.listDefinitions(effectiveTenantId.value),
  })
}
