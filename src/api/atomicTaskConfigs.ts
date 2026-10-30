import { get, post } from '@/api/client'
import type { components, operations } from '@/types/api.generated'

export type AtomicTaskConfig = components['schemas']['AtomicTaskConfigResponse']
export type CreateAtomicTaskConfigRequest =
  operations['createAtomicTaskConfig']['requestBody']['content']['application/json']

const BASE_PATH = '/api/console/ops/atomic-task-configs'

export const atomicTaskConfigsApi = {
  list(tenantId: string, taskType: string): Promise<AtomicTaskConfig[]> {
    return get<AtomicTaskConfig[]>(BASE_PATH, { tenantId, taskType })
  },

  create(body: CreateAtomicTaskConfigRequest): Promise<AtomicTaskConfig> {
    return post<AtomicTaskConfig>(BASE_PATH, body)
  },
}
