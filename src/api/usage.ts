import { get } from './client'
import type { components, operations } from '@/types/api.generated'

export type UsageSummaryQuery = NonNullable<
  operations['queryConsoleUsageSummary']['parameters']['query']
>
export type UsageSummaryRow = components['schemas']['ConsoleUsageSummaryResponse']

export function queryUsageSummary(query: UsageSummaryQuery): Promise<UsageSummaryRow[]> {
  return get<UsageSummaryRow[]>('/api/console/queries/usage-summary', query)
}
