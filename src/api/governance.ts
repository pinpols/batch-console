import { get } from '@/api/client'
import type { TenantQuotaPolicy, SchedulerSnapshot } from '@/types'

export const governanceApi = {
  listPolicies: async () => [] as TenantQuotaPolicy[],

  updatePolicy: (_policyCode: string, _data: Partial<TenantQuotaPolicy>) =>
    Promise.reject(new Error('配额更新：待命令 API')),

  snapshots: async (tenantId?: string) => {
    const row = await get<SchedulerSnapshot>('/api/console/scheduler/snapshot', { tenantId })
    return [row]
  },

  snapshotHistory: (tenantId?: string, limit = 20) =>
    get<SchedulerSnapshot[]>('/api/console/scheduler/snapshot/history', { tenantId, limit }),

  listQueues: () => Promise.resolve([] as unknown[]),

  listWindows: () => Promise.resolve([] as unknown[]),
}
