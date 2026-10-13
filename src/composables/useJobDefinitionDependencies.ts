import { ref } from 'vue'
import { jobApi } from '@/api/job'
import type { ConsoleJobDefinitionResponse } from '@/types/console-api'

const PAGE_SIZE = 15

export function useJobDefinitionDependencies() {
  const loading = ref(false)
  const downstreamLoading = ref(false)
  const hasError = ref(false)
  const definition = ref<ConsoleJobDefinitionResponse | null>(null)
  const upstream = ref<ConsoleJobDefinitionResponse | null>(null)
  const downstream = ref<ConsoleJobDefinitionResponse[]>([])
  const downstreamTotal = ref(0)
  const downstreamPage = ref(1)
  let requestSequence = 0
  let downstreamSequence = 0

  async function findByExactCode(tenantId: string, jobCode: string) {
    const result = await jobApi.listDefinitionsPaged({
      tenantId,
      pageNo: 1,
      pageSize: 1,
      exactJobCode: jobCode,
      includeDisabled: true,
    })
    return result.records.find((row) => row.jobCode === jobCode) ?? null
  }

  async function load(tenantId: string, jobCode: string, page = 1) {
    const sequence = ++requestSequence
    downstreamSequence += 1
    downstreamPage.value = page
    definition.value = null
    upstream.value = null
    downstream.value = []
    downstreamTotal.value = 0
    downstreamLoading.value = false
    hasError.value = false
    if (!tenantId || !jobCode) {
      loading.value = false
      return
    }

    loading.value = true
    try {
      try {
        const selectedDefinition = await findByExactCode(tenantId, jobCode)
        if (sequence !== requestSequence) return
        definition.value = selectedDefinition
      } catch {
        if (sequence === requestSequence) hasError.value = true
      }
      if (sequence !== requestSequence) return

      const dependsOnJobCode = definition.value?.dependsOnJobCode?.trim() ?? ''
      const [upstreamResult, downstreamResult] = await Promise.allSettled([
        dependsOnJobCode ? findByExactCode(tenantId, dependsOnJobCode) : Promise.resolve(null),
        jobApi.listDefinitionsPaged({
          tenantId,
          pageNo: page,
          pageSize: PAGE_SIZE,
          dependsOnJobCode: jobCode,
          includeDisabled: true,
        }),
      ])
      if (sequence !== requestSequence) return

      if (upstreamResult.status === 'fulfilled') upstream.value = upstreamResult.value
      else hasError.value = true
      if (downstreamResult.status === 'fulfilled') {
        downstream.value = downstreamResult.value.records
        downstreamTotal.value = downstreamResult.value.total
      } else {
        hasError.value = true
      }
    } finally {
      if (sequence === requestSequence) {
        loading.value = false
      }
    }
  }

  async function loadDownstreamPage(tenantId: string, jobCode: string, page: number) {
    const sequence = requestSequence
    const downstreamRequest = ++downstreamSequence
    downstreamPage.value = page
    if (!tenantId || !jobCode) return
    downstreamLoading.value = true
    try {
      const result = await jobApi.listDefinitionsPaged({
        tenantId,
        pageNo: page,
        pageSize: PAGE_SIZE,
        dependsOnJobCode: jobCode,
        includeDisabled: true,
      })
      if (sequence !== requestSequence || downstreamRequest !== downstreamSequence) return
      downstream.value = result.records
      downstreamTotal.value = result.total
    } catch {
      if (sequence === requestSequence && downstreamRequest === downstreamSequence) {
        hasError.value = true
      }
    } finally {
      if (sequence === requestSequence && downstreamRequest === downstreamSequence) {
        downstreamLoading.value = false
      }
    }
  }

  return {
    loading,
    downstreamLoading,
    hasError,
    definition,
    upstream,
    downstream,
    downstreamTotal,
    downstreamPage,
    pageSize: PAGE_SIZE,
    load,
    loadDownstreamPage,
  }
}
