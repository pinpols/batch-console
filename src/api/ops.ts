import { get } from '@/api/client'

/** 运营概览 — GET /api/console/ops/summary?tenantId= */
export function getOpsSummary(tenantId: string) {
  return get<Record<string, unknown>>('/api/console/ops/summary', { tenantId })
}
