import { get } from '@/api/client'
import type { MyWorkerResponse } from '@/types/console-api'

/**
 * ADR-035 P4「我的 Worker」:租户自助查看自己注册的自托管 SDK worker(只读)。无分页(数量 ≤ 几十)。
 *
 * 响应 schema 是 MyWorkerResponse(映射后端 /api/console/my-workers 的 DTO WorkerRegistryResponse),
 * 不是运维 Worker 页的 ConsoleWorkerRegistryResponse:两者字段集不同 —— 前者有 maxConcurrent / port,
 * 没有 capabilityTags / resourceTag,后者相反。用错类型会静默丢字段。
 */
export function listMyWorkers(tenantId: string) {
  return get<MyWorkerResponse[]>('/api/console/my-workers', { tenantId })
}

/** GET /api/console/my-workers/count —— 自托管 worker 计数(仪表卡用) */
export function countMyWorkers(tenantId: string) {
  return get<number>('/api/console/my-workers/count', { tenantId })
}
