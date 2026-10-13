import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'

/**
 * 统一维护期写操作守卫。
 *
 * 页面用 `writesFrozen` 绑定写按钮，事件处理器再调用 `ensureWriteAvailable()`；
 * Axios 拦截器仍保留最终兜底，防止漏接页面把请求发到后端。
 */
export function useWriteAvailability() {
  const app = useAppStore()
  const { t } = useI18n({ useScope: 'global' })

  const writesFrozen = computed(() => app.writesFrozen)
  const disabledReason = computed(() =>
    writesFrozen.value ? t('maintenance.writeBlocked') : undefined,
  )

  function ensureWriteAvailable(): boolean {
    if (!writesFrozen.value) return true
    ElMessage.warning(t('maintenance.writeBlocked'))
    return false
  }

  return { writesFrozen, disabledReason, ensureWriteAvailable }
}
