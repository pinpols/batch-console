import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useTenantStore } from '@/stores/tenant'

/**
 * 统一“需要先选择租户”的操作守卫。
 *
 * 新增、导入、触发等用户操作在事件处理器开头调用 `ensureTenantSelected()`：
 * 未选择租户时给出提示并返回 false，避免处理器静默返回、点击后毫无反应。
 * 依赖租户的数据加载仍使用 `useTenantReload`，不在这里处理。
 */
export function useTenantRequirement() {
  const tenant = useTenantStore()
  const { t } = useI18n({ useScope: 'global' })

  const tenantMissing = computed(() => !tenant.tenantId)

  function ensureTenantSelected(): boolean {
    if (!tenantMissing.value) return true
    ElMessage.warning(t('common.selectTenantBeforeAction'))
    return false
  }

  return { tenantMissing, ensureTenantSelected }
}
