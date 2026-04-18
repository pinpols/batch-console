import { fetchAllPageItems } from '@/api/adapters'
import type { ConsoleFileChannelResponse } from '@/types/console-api'

export function queryFileChannels(tenantId: string) {
  return fetchAllPageItems<ConsoleFileChannelResponse>('/api/console/queries/file-channels', {
    tenantId,
  })
}
