import { computed, type Ref } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { jobApi, type JobDefinitionListParams } from '@/api/job'
import { useTenantStore } from '@/stores/tenant'

/**
 * 服务端分页版 Job 定义查询。page / pageSize / jobCode / enabled 变化时自动重取，
 * 切租户也会自动失效（tenantId 进 queryKey）。保留上一页数据减少翻页时的闪烁。
 *
 * @example
 *   const page = ref(1), pageSize = ref(20)
 *   const jobCode = ref('')
 *   const { data, isPending, refetch } = useJobDefinitionsPaged({
 *     page, pageSize, jobCode,
 *   })
 *   const rows = computed(() => data.value?.records ?? [])
 *   const total = computed(() => data.value?.total ?? 0)
 */
export function useJobDefinitionsPaged(args: {
  page: Ref<number>
  pageSize: Ref<number>
  jobCode?: Ref<string | undefined>
  enabled?: Ref<boolean | undefined>
  tenantIdOverride?: Ref<string>
}) {
  const tenant = useTenantStore()
  const effectiveTenantId = computed(() => args.tenantIdOverride?.value || tenant.tenantId)

  return useQuery({
    queryKey: computed(() => [
      'job-definitions-paged',
      effectiveTenantId.value,
      args.page.value,
      args.pageSize.value,
      args.jobCode?.value ?? null,
      args.enabled?.value ?? null,
    ]),
    queryFn: () => {
      const params: JobDefinitionListParams = {
        tenantId: effectiveTenantId.value,
        pageNo: args.page.value,
        pageSize: args.pageSize.value,
      }
      const code = args.jobCode?.value?.trim()
      if (code) params.jobCode = code
      if (args.enabled?.value != null) params.enabled = args.enabled.value
      return jobApi.listDefinitionsPaged(params)
    },
    placeholderData: keepPreviousData,
  })
}
