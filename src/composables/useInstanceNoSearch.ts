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
export function useInstanceNoSearch(
  jobCode: Ref<string>,
  bizDate: Ref<string>,
  selectedInstanceNo?: Ref<string>,
) {
  const tenant = useTenantStore()
  const instanceLoading = ref(false)
  const instanceOptions = ref<InstanceOption[]>([])
  let requestGeneration = 0

  async function load(keyword = '') {
    const requestedTenantId = tenant.tenantId
    const requestedJobCode = jobCode.value
    const requestedBizDate = bizDate.value
    const generation = ++requestGeneration
    if (!requestedTenantId || !requestedJobCode || !requestedBizDate) {
      clearOptions()
      return
    }
    instanceLoading.value = true
    try {
      const res = await queryJobInstances({
        tenantId: requestedTenantId,
        jobCode: requestedJobCode,
        startDate: requestedBizDate,
        endDate: requestedBizDate,
        page: 1,
        pageSize: 30,
      })
      if (!isCurrentRequest(generation, requestedTenantId, requestedJobCode, requestedBizDate)) {
        return
      }
      const trimmedKeyword = keyword.trim()
      const q = trimmedKeyword.toLowerCase()
      const records = res.records ?? []
      const optionCandidates = records.map((record) => ({
        instanceNo: record.instanceNo,
        status: record.instanceStatus,
        batchNo: record.batchNo,
      }))
      const selectableOptions = optionCandidates.filter((option) => option.instanceNo)
      instanceOptions.value = selectableOptions.filter(
        (option) => !q || option.instanceNo.toLowerCase().includes(q),
      )
    } catch {
      if (isCurrentRequest(generation, requestedTenantId, requestedJobCode, requestedBizDate)) {
        instanceOptions.value = []
      }
    } finally {
      if (generation === requestGeneration) instanceLoading.value = false
    }
  }

  function clearOptions() {
    requestGeneration += 1
    instanceOptions.value = []
    if (selectedInstanceNo) selectedInstanceNo.value = ''
    instanceLoading.value = false
  }

  function isCurrentRequest(
    generation: number,
    requestedTenantId: string,
    requestedJobCode: string,
    requestedBizDate: string,
  ) {
    return (
      generation === requestGeneration &&
      tenant.tenantId === requestedTenantId &&
      jobCode.value === requestedJobCode &&
      bizDate.value === requestedBizDate
    )
  }

  // jobCode / bizDate 变化清候选,避免上一组的实例号留在 UI 上
  watch([jobCode, bizDate], () => {
    clearOptions()
  })
  watch(
    () => tenant.tenantId,
    () => {
      clearOptions()
    },
  )

  return {
    instanceLoading,
    instanceOptions,
    loadInstances: load,
    queryInstances: load,
    clearOptions,
  }
}
