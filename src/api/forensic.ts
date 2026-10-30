import { apiClient, post } from '@/api/client'
import type { components } from '@/types/api.generated'

export type ForensicExportRequest = components['schemas']['ForensicExportRequest']
export type ForensicExportResponse = components['schemas']['ForensicExportResponse']

export function requestForensicExport(request: ForensicExportRequest, idempotencyKey: string) {
  return post<ForensicExportResponse>('/api/console/forensic/export', request, {
    headers: { 'Idempotency-Key': idempotencyKey },
    timeout: 120_000,
  })
}

export function downloadForensicExport(exportId: string, tenantId: string) {
  return apiClient.get<Blob>(
    `/api/console/forensic/export/${encodeURIComponent(exportId)}/download`,
    { params: { tenantId }, responseType: 'blob', timeout: 120_000 },
  )
}
