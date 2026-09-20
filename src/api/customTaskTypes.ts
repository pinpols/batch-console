import { get } from '@/api/client'
import type { components } from '@/types/api.generated'

export type CustomTaskType = components['schemas']['CustomTaskTypeResponse']

/** GET /api/console/custom-task-types */
export function listCustomTaskTypes(tenantId?: string) {
  return get<CustomTaskType[]>(
    '/api/console/custom-task-types',
    tenantId ? { tenantId } : undefined,
  )
}

/** GET /api/console/custom-task-types/count */
export function countCustomTaskTypes(tenantId?: string) {
  return get<number>('/api/console/custom-task-types/count', tenantId ? { tenantId } : undefined)
}

/** GET /api/console/custom-task-types/{taskTypeCode} */
export function getCustomTaskType(taskTypeCode: string, tenantId?: string) {
  return get<CustomTaskType>(
    `/api/console/custom-task-types/${encodeURIComponent(taskTypeCode)}`,
    tenantId ? { tenantId } : undefined,
  )
}

/**
 * descriptor 内常见结构(SDK SdkTaskTypeDescriptor 上报):
 *  { schema, parameters, outputs?, requiredEnv?, ... }
 * 留 unknown,FE 渲染层自适应展示。
 */
export interface ParsedDescriptor {
  schema?: unknown
  parameters?: unknown
  outputs?: unknown
  requiredEnv?: unknown
  [key: string]: unknown
}

export function parseDescriptor(raw: string | null | undefined): ParsedDescriptor | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' ? (obj as ParsedDescriptor) : null
  } catch {
    return null
  }
}
