import { get } from '@/api/client'
import type { ConsoleWorkerRegistryResponse } from '@/types/console-api'

/**
 * ADR-035 P4「我的 Worker」:租户自助查看自己注册的自托管 SDK worker(只读)。
 * 无分页(数量 ≤ 几十),与运维 Worker 页共用 ConsoleWorkerRegistryResponse 类型。
 */
export function listMyWorkers(tenantId: string) {
  return get<ConsoleWorkerRegistryResponse[]>('/api/console/my-workers', { tenantId })
}

/** GET /api/console/my-workers/count —— 自托管 worker 计数(仪表卡用) */
export function countMyWorkers(tenantId: string) {
  return get<number>('/api/console/my-workers/count', { tenantId })
}
