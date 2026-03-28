import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'batch-console-tenant-id'

export const useTenantStore = defineStore('tenant', () => {
  const tenantId = ref(localStorage.getItem(STORAGE_KEY) ?? 'default')

  watch(tenantId, (id) => {
    localStorage.setItem(STORAGE_KEY, id)
  })

  function setTenantId(id: string) {
    tenantId.value = id || 'default'
  }

  return { tenantId, setTenantId }
})
