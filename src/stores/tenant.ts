import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'batch-console-tenant-id'

export const useTenantStore = defineStore('tenant', () => {
  const tenantId = ref(localStorage.getItem(STORAGE_KEY) ?? 'default-tenant')

  function setTenantId(id: string) {
    const val = id || 'default-tenant'
    tenantId.value = val
    // 同步写 localStorage，确保 API interceptor 立即读到最新值
    localStorage.setItem(STORAGE_KEY, val)
  }

  return { tenantId, setTenantId }
})
