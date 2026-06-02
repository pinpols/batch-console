/**
 * 内置原子节点 schema(`/api/console/atomic-task-types/schema`,API-P3-1 / PR #228)。
 * 平台四类原子执行器 sql / shell / stored_proc / http 的参数 schema + 安全闸说明。
 */
import { get } from '@/api/client'

export interface AtomicParamSpec {
  name: string
  type: string
  required: boolean
  description: string
}

export interface AtomicSecurityGate {
  field: string
  meaning: string
}

export interface AtomicTaskTypeSchema {
  taskType: string
  displayName: string
  enabledByDefault: boolean
  parameters: AtomicParamSpec[]
  securityGates: AtomicSecurityGate[]
}

/** GET /api/console/atomic-task-types/schema */
export async function listAtomicTaskTypeSchemas(): Promise<AtomicTaskTypeSchema[]> {
  const data = await get<unknown[]>('/api/console/atomic-task-types/schema')
  return (data ?? []).map((raw) => {
    const r = (raw ?? {}) as Partial<AtomicTaskTypeSchema>
    return {
      taskType: r.taskType ?? '',
      displayName: r.displayName ?? r.taskType ?? '',
      enabledByDefault: r.enabledByDefault ?? true,
      parameters: (r.parameters ?? []).map((p) => ({
        name: p.name ?? '',
        type: p.type ?? 'string',
        required: p.required ?? false,
        description: p.description ?? '',
      })),
      securityGates: (r.securityGates ?? []).map((g) => ({
        field: g.field ?? '',
        meaning: g.meaning ?? '',
      })),
    }
  })
}
