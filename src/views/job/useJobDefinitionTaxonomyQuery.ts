import { computed } from 'vue'
import type { JobDefinitionListParams } from '@/api/job'

export function useJobDefinitionTaxonomyQuery(filters: {
  scheduleType: JobDefinitionListParams['scheduleType'] | ''
  triggerMode: JobDefinitionListParams['triggerMode'] | ''
  dependency: string
}) {
  return {
    scheduleType: computed(() => filters.scheduleType || undefined),
    triggerMode: computed(() => filters.triggerMode || undefined),
    hasUpstreamDependency: computed(() => {
      if (filters.dependency === 'HAS_DEPENDENCY') return true
      if (filters.dependency === 'NO_DEPENDENCY') return false
      return undefined
    }),
  }
}
