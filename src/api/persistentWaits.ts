import { get } from '@/api/client'
import type { components, operations } from '@/types/api.generated'

export type PersistentWait = components['schemas']['ConsolePersistentWaitResponse']
export type PersistentWaitPage = components['schemas']['ConsolePersistentWaitPageResponse']
export type PersistentWaitQuery = NonNullable<
  operations['listConsolePersistentWaits']['parameters']['query']
>

export function listPersistentWaits(query: PersistentWaitQuery): Promise<PersistentWaitPage> {
  return get<PersistentWaitPage>('/api/console/ops/persistent-waits', query)
}
