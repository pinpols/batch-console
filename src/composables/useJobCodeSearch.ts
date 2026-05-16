import { ref } from 'vue'
import { jobApi } from '@/api/job'
import { useTenantStore } from '@/stores/tenant'

/**
 * 远程搜索 Job Code 下拉选项,用于自助服务 rerun / compensation 等表单的
 * el-select 绑定。默认加载 30 条启用中的作业;输入关键字时远程精确搜索。
 */
export function useJobCodeSearch() {
  const tenant = useTenantStore()
  const jobCodeLoading = ref(false)
  const jobCodeOptions = ref<string[]>([])

  async function loadDefaultJobCodes() {
    if (jobCodeLoading.value) return
    if (jobCodeOptions.value.length > 0) return
    jobCodeLoading.value = true
    try {
      const res = await jobApi.listDefinitionsPaged({
        tenantId: tenant.tenantId,
        pageNo: 1,
        pageSize: 30,
        enabled: true,
      })
      jobCodeOptions.value = Array.from(
        new Set(
          (res.records ?? [])
            .map((r) => r.jobCode)
            .filter((v): v is string => typeof v === 'string' && !!v),
        ),
      )
    } catch {
      jobCodeOptions.value = []
    } finally {
      jobCodeLoading.value = false
    }
  }

  async function queryJobCodes(keyword: string) {
    const q = keyword.trim()
    if (!q) return
    jobCodeLoading.value = true
    try {
      const res = await jobApi.listDefinitionsPaged({
        tenantId: tenant.tenantId,
        pageNo: 1,
        pageSize: 30,
        jobCode: q,
        enabled: true,
      })
      jobCodeOptions.value = Array.from(
        new Set(
          (res.records ?? [])
            .map((r) => r.jobCode)
            .filter((v): v is string => typeof v === 'string' && !!v),
        ),
      )
    } catch {
      jobCodeOptions.value = []
    } finally {
      jobCodeLoading.value = false
    }
  }

  function clearOptions() {
    jobCodeOptions.value = []
  }

  return {
    jobCodeLoading,
    jobCodeOptions,
    loadDefaultJobCodes,
    queryJobCodes,
    clearOptions,
  }
}
