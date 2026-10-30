import { get, post } from './client'
import type { components } from '@/types/api.generated'

export type TerminalDelivery = components['schemas']['TerminalDeliveryRecoveryResponse']
export type TerminalDeliveryRetry = components['schemas']['TerminalDeliveryRetryRequest']

export function listTerminalDeliveries(tenantId: string, limit = 100) {
  return get<TerminalDelivery[]>('/api/console/notifications/terminal-deliveries', { tenantId, limit })
}

export function retryTerminalDelivery(
  tenantId: string,
  source: TerminalDelivery['source'],
  id: number,
  evidence: TerminalDeliveryRetry,
) {
  return post<void>(`/api/console/notifications/terminal-deliveries/${source}/${id}/retry`, evidence, {
    params: { tenantId },
  })
}
