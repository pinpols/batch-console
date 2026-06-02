/**
 * SDK 自定义 taskType 只读 API(`/api/console/custom-task-types`,API-P3-1)。
 *
 * BE 端 OpenAPI 当前未细化 response schema(`data` 为 untyped object),这里给出 FE 视图层
 * 真正需要的字段类型,与 `CustomTaskTypeEntity`(Java)字段对齐 —— 后续 BE 完善 schema
 * 后可改走 generated types。
 */
import { get } from '@/api/client'

export interface CustomTaskType {
  id: number
  tenantId: string
  taskTypeCode: string
  displayName: string | null
  /** descriptor 全文(JSONB ::text 透传),JSON 字符串;FE 自行 JSON.parse */
  descriptor: string | null
  descriptorVersion: string | null
  /** SDK 上报来源:'CODE' / 'CONFIG' 等,自由字符串 */
  source: string | null
  /** 上报的 worker code(用于追溯哪个 worker 注册的) */
  declaredByWorkerCode: string | null
  /** ACTIVE / RETIRED 等(后端目前只返 ACTIVE) */
  status: string
  firstDeclaredAt: string
  lastDeclaredAt: string
}

/** GET /api/console/custom-task-types */
export function listCustomTaskTypes(tenantId?: string) {
  return get<CustomTaskType[]>('/api/console/custom-task-types', tenantId ? { tenantId } : undefined)
}

/** GET /api/console/custom-task-types/count */
export function countCustomTaskTypes(tenantId?: string) {
  return get<number>(
    '/api/console/custom-task-types/count',
    tenantId ? { tenantId } : undefined,
  )
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
