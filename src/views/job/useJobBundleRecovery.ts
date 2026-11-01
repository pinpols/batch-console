import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { currentAuthSession, isSharedAuthRevisionCurrent } from '@/api/authSession'
import { getConfigBatchOperation, type ConfigBatchRecoveryResponse } from '@/api/configBatchRecovery'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
import { usePermission } from '@/composables/usePermission'
import { useTenantStore } from '@/stores/tenant'
import { useAuthStore } from '@/stores/auth'
import {
  type ConfigBatchRecovery,
  createConfigBatchRecovery,
  saveConfigBatchRecovery,
  listConfigBatchRecoveries,
  clearConfigBatchRecovery,
  canReadConfigBatchRecovery,
} from '@/utils/configBatchRecovery'

/** 作业配置包的恢复记录保持当前主体、租户和权限边界。 */
export function useJobBundleRecovery() {
  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const { canManageSystem } = usePermission()
  const recoveryActor = computed(() => auth.userInfo?.userId ?? auth.userInfo?.username ?? '')
  const recoveryCommands = ref<ConfigBatchRecovery[]>([])
  const recoveryStorageBlocked = ref(false)
  const recoveryLoadingKey = ref('')
  const recoveryCurrent = ref<{ key: string; result?: ConfigBatchRecoveryResponse; error?: string }>()
  const recoveryScope = useTenantRequestScope()
  let recoveryRevision = 0

  function recoveryKindLabel(command: ConfigBatchRecovery) {
    return t(command.operationKind === 'JOB_BUNDLE_CREATE'
      ? 'configBatchRecovery.kindJobBundleCreate'
      : 'configBatchRecovery.kindJobBundleImport')
  }

  function headerTenant(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.tenantId) ?? ''
    } catch {
      return null
    }
  }

  function refreshRecoveryCommands() {
    const header = headerTenant()
    recoveryRevision += 1
    recoveryCurrent.value = undefined
    recoveryLoadingKey.value = ''
    if (!canManageSystem.value) {
      recoveryCommands.value = []
      recoveryStorageBlocked.value = false
      return
    }
    if (header === null || header !== tenant.tenantId) {
      recoveryCommands.value = []
      recoveryStorageBlocked.value = true
      return
    }
    const state = listConfigBatchRecoveries(recoveryActor.value, header)
    recoveryCommands.value = state.commands.filter((item) => item.operationKind.startsWith('JOB_BUNDLE_'))
    recoveryStorageBlocked.value = state.blocked
  }

  watch([recoveryActor, () => tenant.tenantId, canManageSystem], () => {
    recoveryRevision += 1
    recoveryCurrent.value = undefined
  }, { flush: 'sync' })
  watch([recoveryActor, () => tenant.tenantId, canManageSystem], refreshRecoveryCommands, {
    immediate: true,
  })

  function prepareRecovery(operationKind: 'JOB_BUNDLE_CREATE' | 'JOB_BUNDLE_IMPORT', auditTenantId: string) {
    const header = headerTenant()
    if (header === null || header !== tenant.tenantId) {
      ElMessage.error(t('configBatchRecovery.storageUnavailable'))
      return null
    }
    try {
      const command = createConfigBatchRecovery({
        actor: recoveryActor.value,
        headerTenant: header,
        auditTenantId,
        operationKind,
      })
      if (saveConfigBatchRecovery(command)) {
        refreshRecoveryCommands()
        return command
      }
    } catch {
      // 无法可靠记录原身份时不发送写请求。
    }
    recoveryStorageBlocked.value = true
    ElMessage.error(t('configBatchRecovery.storageUnavailable'))
    return null
  }

  async function checkRecovery(command: ConfigBatchRecovery) {
    const header = headerTenant()
    if (!canManageSystem.value || recoveryLoadingKey.value || header === null ||
        header !== tenant.tenantId || !canReadConfigBatchRecovery(command, recoveryActor.value, header) ||
        !isSharedAuthRevisionCurrent()) return
    const scope = recoveryScope.begin()
    const revision = recoveryRevision
    const authSession = currentAuthSession()
    const isCurrent = () => recoveryScope.isCurrent(scope) && revision === recoveryRevision &&
      canManageSystem.value && headerTenant() === header && currentAuthSession() === authSession &&
      isSharedAuthRevisionCurrent()
    recoveryLoadingKey.value = command.key
    try {
      const result = await getConfigBatchOperation(command, recoveryActor.value, header)
      if (!isCurrent()) return
      recoveryCurrent.value = { key: command.key, result }
    } catch (error) {
      if (!isCurrent()) return
      const status = (error as { response?: { status?: number } })?.response?.status
      recoveryCurrent.value = { key: command.key, error: status === 404 ? 'configBatchRecovery.notFound' : 'configBatchRecovery.queryFailed' }
    } finally {
      if (recoveryLoadingKey.value === command.key) recoveryLoadingKey.value = ''
    }
  }

  function canStopRecovery(command: ConfigBatchRecovery) {
    const current = recoveryCurrent.value
    return current?.key === command.key &&
      (current.error === 'configBatchRecovery.notFound' || current.result?.status === 'UNKNOWN')
  }

  async function stopTrackingRecovery(command: ConfigBatchRecovery) {
    const header = headerTenant()
    if (!canManageSystem.value || header === null || header !== tenant.tenantId ||
        !canReadConfigBatchRecovery(command, recoveryActor.value, header) ||
        !canStopRecovery(command) || !isSharedAuthRevisionCurrent()) return
    const scope = recoveryScope.begin()
    const revision = recoveryRevision
    const authSession = currentAuthSession()
    try {
      await ElMessageBox.confirm(
        t('configBatchRecovery.stopTrackingMessage'),
        t('configBatchRecovery.stopTrackingTitle'),
        {
          type: 'warning',
          confirmButtonText: t('configBatchRecovery.stopTracking'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch {
      return
    }
    const currentHeader = headerTenant()
    if (!recoveryScope.isCurrent(scope) || revision !== recoveryRevision || !canManageSystem.value ||
        currentHeader === null || currentHeader !== tenant.tenantId ||
        !canReadConfigBatchRecovery(command, recoveryActor.value, currentHeader) ||
        !canStopRecovery(command) || currentAuthSession() !== authSession ||
        !isSharedAuthRevisionCurrent()) return
    if (!clearConfigBatchRecovery(command)) {
      ElMessage.error(t('configBatchRecovery.storageUnavailable'))
      return
    }
    refreshRecoveryCommands()
  }

  function acknowledgeRecovery(command: ConfigBatchRecovery) {
    const header = headerTenant()
    if (!canManageSystem.value || header === null || header !== tenant.tenantId ||
        !canReadConfigBatchRecovery(command, recoveryActor.value, header) ||
        recoveryCurrent.value?.key !== command.key || recoveryCurrent.value.result?.status !== 'COMPLETE' ||
        !isSharedAuthRevisionCurrent()) return
    if (!clearConfigBatchRecovery(command)) {
      ElMessage.error(t('configBatchRecovery.storageUnavailable'))
      return
    }
    refreshRecoveryCommands()
  }

  return {
    recoveryCommands,
    recoveryStorageBlocked,
    recoveryLoadingKey,
    recoveryCurrent,
    recoveryKindLabel,
    headerTenant,
    refreshRecoveryCommands,
    prepareRecovery,
    checkRecovery,
    canStopRecovery,
    stopTrackingRecovery,
    acknowledgeRecovery,
  }
}
