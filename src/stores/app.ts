import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

const sidebarCollapsedKey = 'batch-console:sidebar-collapsed'
const contentDensityKey = 'batch-console:content-density'

export type ContentDensity = 'comfortable' | 'compact'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(localStorage.getItem(sidebarCollapsedKey) === '1')
  const contentDensity = ref<ContentDensity>(
    (localStorage.getItem(contentDensityKey) as ContentDensity | null) ?? 'comfortable',
  )

  const contentPadding = computed(() => (contentDensity.value === 'compact' ? 16 : 24))

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setSidebarCollapsed(value: boolean) {
    sidebarCollapsed.value = value
  }

  function setContentDensity(value: ContentDensity) {
    contentDensity.value = value
  }

  watch(sidebarCollapsed, (value) => {
    localStorage.setItem(sidebarCollapsedKey, value ? '1' : '0')
  })

  watch(contentDensity, (value) => {
    localStorage.setItem(contentDensityKey, value)
  })

  return {
    sidebarCollapsed,
    contentDensity,
    contentPadding,
    toggleSidebar,
    setSidebarCollapsed,
    setContentDensity,
  }
})
