/**
 * Worker run-fingerprint 看板只读 API(`/api/console/workers/fingerprints`,
 * SDK Phase 5 / SDK-P5-3,console Lane D/F)。
 *
 * 类型直接复用 `src/types/api.generated.ts` 的 generated schema
 * (`WorkerFingerprintResponse` / `WorkerFingerprintSummaryResponse`),
 * BE 字段 `process_id` / `heartbeat_at` 已在 DTO 层映射为 camelCase
 * `processId` / `heartbeatAt`。
 *
 * 注意:tenantId 由 axios interceptor 自动注入到 header,query 参数可不传;
 * 仅当调用方明确要跨当前激活租户查询时再透传(目前 BE 也只信任 header)。
 */
import { get } from '@/api/client'
import type { components } from '@/types/api.generated'

export type WorkerFingerprint = components['schemas']['WorkerFingerprintResponse']
export type WorkerFingerprintSummary = components['schemas']['WorkerFingerprintSummaryResponse']

/** GET /api/console/workers/fingerprints */
export async function listWorkerFingerprints(tenantId?: string): Promise<WorkerFingerprint[]> {
  const data = await get<WorkerFingerprint[] | null>(
    '/api/console/workers/fingerprints',
    tenantId ? { tenantId } : undefined,
  )
  return data ?? []
}

/** GET /api/console/workers/fingerprints/summary */
export async function getWorkerFingerprintSummary(
  tenantId?: string,
): Promise<WorkerFingerprintSummary[]> {
  const data = await get<WorkerFingerprintSummary[] | null>(
    '/api/console/workers/fingerprints/summary',
    tenantId ? { tenantId } : undefined,
  )
  return data ?? []
}
