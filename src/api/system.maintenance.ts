import type { AxiosRequestConfig } from 'axios'
import { get, put } from '@/api/client'

export interface MaintenanceStatus {
  enabled: boolean
  readOnly: boolean
  message: string | null
  etaAt: string | null
  /** 受影响子系统 code 列表(空数组=整站维护) */
  affectedServices: string[]
}

export interface UpdateMaintenanceRequest {
  enabled: boolean
  readOnly?: boolean
  message?: string | null
  etaAt?: string | null
  affectedServices?: string[]
}

/** GET /api/console/system/maintenance — 维护状态(始终 200,permitAll) */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const cfg = { _silent: true } as AxiosRequestConfig
  const data = await get<Partial<MaintenanceStatus> | null>(
    '/api/console/system/maintenance',
    undefined,
    cfg,
  )
  return normalize(data)
}

/** GET /api/console/admin/system/maintenance — 当前状态(admin 用) */
export async function getAdminMaintenanceState(): Promise<MaintenanceStatus> {
  const data = await get<Partial<MaintenanceStatus> | null>('/api/console/admin/system/maintenance')
  return normalize(data)
}

/** PUT /api/console/admin/system/maintenance — 热更新(无须重启) */
export async function updateMaintenance(
  body: UpdateMaintenanceRequest,
): Promise<MaintenanceStatus> {
  const data = await put<Partial<MaintenanceStatus> | null>(
    '/api/console/admin/system/maintenance',
    body,
  )
  return normalize(data)
}

function normalize(data: Partial<MaintenanceStatus> | null): MaintenanceStatus {
  return {
    enabled: !!data?.enabled,
    readOnly: !!data?.readOnly,
    message: data?.message ?? null,
    etaAt: data?.etaAt ?? null,
    affectedServices: Array.isArray(data?.affectedServices) ? data.affectedServices : [],
  }
}
