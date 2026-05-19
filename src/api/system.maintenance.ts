import type { AxiosRequestConfig } from 'axios'
import { get } from '@/api/client'

export interface MaintenanceStatus {
  enabled: boolean
  readOnly: boolean
  message: string | null
  etaAt: string | null
}

/** GET /api/console/system/maintenance — 维护状态(始终 200,permitAll) */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const cfg = { _silent: true } as AxiosRequestConfig
  const data = await get<Partial<MaintenanceStatus> | null>(
    '/api/console/system/maintenance',
    undefined,
    cfg,
  )
  return {
    enabled: !!data?.enabled,
    readOnly: !!data?.readOnly,
    message: data?.message ?? null,
    etaAt: data?.etaAt ?? null,
  }
}
