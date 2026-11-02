import { get } from '@/api/client'
import { readActiveTenantId } from '@/utils/tenantContext'
import type { components } from '@/types/api.generated'
import { canReadConfigBatchRecovery, type ConfigBatchRecovery } from '@/utils/configBatchRecovery'

export type ConfigBatchRecoveryResponse =
  components['schemas']['ConfigBatchOperationRecoveryResponse']

/** 只读查询原请求；切换账号或租户后不得使用当前身份替代原身份。 */
export function getConfigBatchOperation(
  command: ConfigBatchRecovery,
  actor: string,
  headerTenant: string,
): Promise<ConfigBatchRecoveryResponse> {
  const activeTenant = readActiveTenantId()
  if (!canReadConfigBatchRecovery(command, actor, headerTenant) || activeTenant !== headerTenant) {
    return Promise.reject(new Error('Config batch recovery scope changed'))
  }
  return get<ConfigBatchRecoveryResponse>(
    '/api/console/config/batch-operation',
    { auditTenantId: command.auditTenantId, operationKind: command.operationKind },
    { headers: { 'Idempotency-Key': command.key } },
  )
}
