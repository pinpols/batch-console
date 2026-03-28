import { get, post } from '@/api/client'
import type { WorkerRegistry, DispatchChannel } from '@/types'

export const workerApi = {
  list: (tenantId?: string, workerType?: string) =>
    get<WorkerRegistry[]>('/api/console/query/workers', { tenantId, workerType }),

  drain: (workerCode: string, tenantId: string, reason?: string) =>
    post<string>(`/api/console/workers/${encodeURIComponent(workerCode)}/drain`, {
      tenantId,
      reason,
    }),

  forceOffline: (workerCode: string, tenantId: string, reason?: string) =>
    post<string>(`/api/console/workers/${encodeURIComponent(workerCode)}/force-offline`, {
      tenantId,
      reason,
    }),

  takeover: (_workerId: string, _tenantId: string) =>
    Promise.reject(new Error('takeover 已弃用，请使用 drain / force-offline')),

  listChannels: (tenantId?: string) =>
    get<DispatchChannel[]>('/api/console/query/file-channels', { tenantId }),

  channelReceipts: (_channelCode: string, _tenantId: string) =>
    Promise.reject(new Error('渠道回执：待 OpenAPI')),
}
