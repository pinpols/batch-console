import { ref, watch, type Ref } from 'vue'
import { instanceApi } from '@/api/instance'
import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
import { useTenantStore } from '@/stores/tenant'
import type { ConsoleJobDefinitionResponse, ConsoleJobInstanceResponse } from '@/types/console-api'

/** 最近运行请求只允许更新仍打开的同一作业和租户。 */
export function useJobDefinitionDetailRuns(
  detailRow: Ref<ConsoleJobDefinitionResponse | null>,
  visible: Ref<boolean>,
) {
  const tenant = useTenantStore()
  const rows = ref<ConsoleJobInstanceResponse[]>([])
  const loading = ref(false)
  const loadedForJobCode = ref('')
  const scope = useTenantRequestScope()

  function reset() {
    scope.begin()
    rows.value = []
    loading.value = false
    loadedForJobCode.value = ''
  }

  async function load() {
    const def = detailRow.value
    if (!def?.jobCode || loadedForJobCode.value === def.jobCode) return
    const request = scope.begin()
    const isCurrent = () => scope.isCurrent(request) && detailRow.value === def && visible.value
    loading.value = true
    try {
      const pageResult = await instanceApi.list({
        tenantId: def.tenantId ?? tenant.tenantId,
        exactJobCode: def.jobCode,
        page: 1,
        pageSize: 15,
      })
      if (!isCurrent()) return
      rows.value = pageResult.records ?? []
      loadedForJobCode.value = def.jobCode
    } catch {
      if (isCurrent()) rows.value = []
    } finally {
      if (isCurrent()) loading.value = false
    }
  }

  watch(() => tenant.tenantId, reset, { flush: 'sync' })
  watch(
    visible,
    (isVisible) => {
      if (!isVisible) {
        scope.begin()
        loading.value = false
      }
    },
    { flush: 'sync' },
  )

  return { rows, loading, load, reset }
}
