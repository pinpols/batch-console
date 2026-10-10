import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { STORAGE_KEYS } from '@/constants/storageKeys'

export const useTenantStore = defineStore('tenant', () => {
  const tenantId = ref(localStorage.getItem(STORAGE_KEYS.tenantId) ?? '')

  function setTenantId(id: string) {
    const val = id.trim()
    tenantId.value = val
    // 同步写 localStorage，确保 API interceptor 立即读到最新值
    if (val) localStorage.setItem(STORAGE_KEYS.tenantId, val)
    else localStorage.removeItem(STORAGE_KEYS.tenantId)
  }

  return { tenantId, setTenantId }
})
