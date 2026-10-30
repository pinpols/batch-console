import type { AxiosRequestConfig } from 'axios'
import { get } from '@/api/client'
import type { components } from '@/types/api.generated'
export type DailyProgress = components['schemas']['DailyProgress']
export function getDailyProgress(bizDate: string, tenantId: string) {
  return get<DailyProgress>('/api/console/dashboard/daily-progress', { tenantId, bizDate }, {
    _silent: true,
  } as AxiosRequestConfig)
}
