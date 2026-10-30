import { get } from './client'
import type { components } from '@/types/api.generated'
export type AtomicRuntimeStatus = components['schemas']['AtomicRuntimeStatus']
/** 当前配置的单个Atomic Worker反向只读快照；不是租户任务进度或集群聚合。 */
export function getAtomicRuntimeStatus() {
  return get<AtomicRuntimeStatus>('/api/console/ops/atomic-runtime-status')
}
