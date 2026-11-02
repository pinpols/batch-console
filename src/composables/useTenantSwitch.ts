import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useTenantStore } from '@/stores/tenant'

/** 交互式切租户前，统一询问是否放弃当前作用域中的未保存内容。 */
export function useTenantSwitch() {
  const tenant = useTenantStore()
  const { t } = useI18n({ useScope: 'global' })

  async function switchTenant(id: string): Promise<boolean> {
    return tenant.requestTenantSwitch(
      id,
      async () => {
        try {
          await ElMessageBox.confirm(
            t('dirtyForm.tenantSwitchMessage'),
            t('dirtyForm.confirmTitle'),
            {
              type: 'warning',
              confirmButtonText: t('dirtyForm.confirmDiscard'),
              cancelButtonText: t('dirtyForm.cancelDiscard'),
            },
          )
          return true
        } catch {
          return false
        }
      },
      () => ElMessage.warning(t('dirtyForm.tenantSwitchDraftChanged')),
    )
  }

  return { switchTenant }
}
