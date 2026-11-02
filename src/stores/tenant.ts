import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { currentAuthSession, isSharedAuthRevisionCurrent } from '@/api/authSession'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { readCompositionGuard } from '@/utils/compositionGuard'

export const useTenantStore = defineStore('tenant', () => {
  readCompositionGuard()
  const tenantId = ref(localStorage.getItem(STORAGE_KEYS.tenantId) ?? '')
  const changeGuards = new Map<symbol, { hasChanges: () => boolean; revision: () => number }>()
  let guardRevision = 0
  const revision = ref(0)
  const tenantSwitchPending = ref(false)
  watch(
    tenantId,
    () => {
      revision.value += 1
    },
    { flush: 'sync' },
  )

  function setTenantId(id: string) {
    const val = id.trim()
    // 持久化默认租户供新标签和下次加载初始化。
    if (val) localStorage.setItem(STORAGE_KEYS.tenantId, val)
    else localStorage.removeItem(STORAGE_KEYS.tenantId)
    tenantId.value = val
  }

  /** 注册当前页面或表单的未保存状态；返回的函数在作用域结束时注销。 */
  function registerTenantChangeGuard(
    hasChanges: () => boolean,
    revision: () => number = () => 0,
  ): () => void {
    const key = Symbol('tenant-change-guard')
    changeGuards.set(key, { hasChanges, revision })
    guardRevision += 1
    return () => {
      if (changeGuards.delete(key)) guardRevision += 1
    }
  }

  /** 仅供交互式切换使用；认证与首次初始化仍使用同步 setTenantId。 */
  async function requestTenantSwitch(
    id: string,
    confirm: () => Promise<boolean>,
    onDraftChanged?: () => void,
  ): Promise<boolean> {
    if (typeof id !== 'string') return false
    const next = id.trim()
    if (
      !next ||
      next === tenantId.value ||
      tenantSwitchPending.value ||
      !isSharedAuthRevisionCurrent()
    )
      return false
    const expectedTenantRevision = revision.value
    const expectedGuardRevision = guardRevision
    const expectedSession = currentAuthSession()
    tenantSwitchPending.value = true
    try {
      const guards = [...changeGuards.values()]
      const draftRevisions = guards.map((guard) => guard.revision())
      const composition = readCompositionGuard()
      const hasChanges =
        guards.map((guard) => guard.hasChanges()).some(Boolean) || composition.pending
      if (hasChanges && !(await confirm())) return false
      if (
        revision.value !== expectedTenantRevision ||
        currentAuthSession() !== expectedSession ||
        !isSharedAuthRevisionCurrent()
      )
        return false
      if (
        guardRevision !== expectedGuardRevision ||
        guards.some((guard, index) => guard.revision() !== draftRevisions[index]) ||
        readCompositionGuard().revision !== composition.revision
      ) {
        onDraftChanged?.()
        return false
      }
      setTenantId(next)
      return true
    } catch {
      // 草稿状态或确认过程异常时不能静默丢弃用户输入。
      return false
    } finally {
      tenantSwitchPending.value = false
    }
  }

  return {
    tenantId,
    revision,
    tenantSwitchPending,
    setTenantId,
    registerTenantChangeGuard,
    requestTenantSwitch,
  }
})
