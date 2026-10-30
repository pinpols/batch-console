import { ref, watch } from 'vue'
import { jobApi } from '@/api/job'
import { useTenantStore } from '@/stores/tenant'
import { useTenantRequestScope } from '@/composables/useTenantRequestScope'

export const JOB_CODE_SEARCH_PAGE_SIZE = 30

function uniqueJobCodes(records: Array<{ jobCode?: string | null }>): string[] {
  const codes = records.map((record) => record.jobCode)
  const nonEmptyCodes = codes.filter((code): code is string => typeof code === 'string' && !!code)
  const uniqueCodes = new Set(nonEmptyCodes)
  return Array.from(uniqueCodes)
}

/**
 * 远程搜索 Job Code 下拉选项,用于自助服务 rerun / compensation 等表单的
 * el-select 绑定。默认加载 30 条启用中的作业;输入关键字时远程精确搜索。
 */
export function useJobCodeSearch() {
  const tenant = useTenantStore()
  const jobCodeLoading = ref(false)
  const jobCodeOptions = ref<string[]>([])

  const loadScope = useTenantRequestScope()
  async function loadDefaultJobCodes() {
    if (jobCodeLoading.value) return
    if (jobCodeOptions.value.length > 0) return
    const request = loadScope.begin()
    if (!request.tenantId) return
    jobCodeLoading.value = true
    try {
      const res = await jobApi.listDefinitionsPaged({
        tenantId: request.tenantId,
        pageNo: 1,
        pageSize: JOB_CODE_SEARCH_PAGE_SIZE,
        enabled: true,
      })
      if (!loadScope.isCurrent(request)) return
      const records = res.records ?? []
      jobCodeOptions.value = uniqueJobCodes(records)
    } catch {
      if (!loadScope.isCurrent(request)) return
      jobCodeOptions.value = []
    } finally {
      if (loadScope.isCurrent(request)) jobCodeLoading.value = false
    }
  }

  async function queryJobCodes(keyword: string) {
    const q = keyword.trim()
    if (!q) {
      clearOptions()
      return
    }
    const request = loadScope.begin()
    if (!request.tenantId) return
    jobCodeLoading.value = true
    try {
      const res = await jobApi.listDefinitionsPaged({
        tenantId: request.tenantId,
        pageNo: 1,
        pageSize: JOB_CODE_SEARCH_PAGE_SIZE,
        jobCode: q,
        enabled: true,
      })
      if (!loadScope.isCurrent(request)) return
      const records = res.records ?? []
      jobCodeOptions.value = uniqueJobCodes(records)
    } catch {
      if (!loadScope.isCurrent(request)) return
      jobCodeOptions.value = []
    } finally {
      if (loadScope.isCurrent(request)) jobCodeLoading.value = false
    }
  }

  function clearOptions() {
    loadScope.begin()
    jobCodeLoading.value = false
    jobCodeOptions.value = []
  }

  watch(() => tenant.tenantId, clearOptions, { flush: 'sync' })

  return {
    jobCodeLoading,
    jobCodeOptions,
    loadDefaultJobCodes,
    queryJobCodes,
    clearOptions,
  }
}
