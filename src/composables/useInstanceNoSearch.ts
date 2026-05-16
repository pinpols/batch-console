import { ref, watch, type Ref } from 'vue'
import { queryJobInstances } from '@/api/queries/instances'
import { useTenantStore } from '@/stores/tenant'

export interface InstanceOption {
  instanceNo: string
  status: string
  batchNo: string
}

/**
 * 在 jobCode + bizDate 已选定的前提下,从 console 实例查询接口拉对应实例号候选,
 * 用于「自助重跑 / 自助补偿」里的「目标实例号」下拉。jobCode 或 bizDate 变化
 * 会清空已选 instanceNo,避免错位提交。
 */
export function useInstanceNoSearch(jobCode: Ref<string>, bizDate: Ref<string>) {
  const tenant = useTenantStore()
  const instanceLoading = ref(false)
  const instanceOptions = ref<InstanceOption[]>([])

  async function load(keyword = '') {
    if (!jobCode.value || !bizDate.value) {
      instanceOptions.value = []
      return
    }
    instanceLoading.value = true
    try {
      const res = await queryJobInstances({
        tenantId: tenant.tenantId,
        jobCode: jobCode.value,
        startDate: bizDate.value,
        endDate: bizDate.value,
        page: 1,
        pageSize: 30,
      })
      const q = keyword.trim().toLowerCase()
      instanceOptions.value = (res.records ?? [])
        .map((r) => ({
          instanceNo: r.instanceNo,
          status: r.instanceStatus,
          batchNo: r.batchNo,
        }))
        .filter((r) => r.instanceNo)
        .filter((r) => !q || r.instanceNo.toLowerCase().includes(q))
    } catch {
      instanceOptions.value = []
    } finally {
      instanceLoading.value = false
    }
  }

  function clearOptions() {
    instanceOptions.value = []
  }

  // jobCode / bizDate 变化清候选,避免上一组的实例号留在 UI 上
  watch([jobCode, bizDate], () => {
    clearOptions()
  })

  return {
    instanceLoading,
    instanceOptions,
    loadInstances: load,
    queryInstances: load,
    clearOptions,
  }
}
