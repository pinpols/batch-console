import { get, post, del } from '@/api/client'

export type ResourceType = 'JOB' | 'WORKFLOW' | 'FILE_CHANNEL' | 'FILE_TEMPLATE'

/** GET /api/console/tags — list tags for a resource */
export function listResourceTags(
  tenantId: string,
  resourceType: ResourceType,
  resourceCode: string,
) {
  return get<unknown>('/api/console/tags', { tenantId, resourceType, resourceCode })
}

/** POST /api/console/tags — upsert a tag */
export function upsertResourceTag(
  tenantId: string,
  body: {
    resourceType: ResourceType
    resourceCode: string
    tagKey: string
    tagValue?: string
  },
) {
  return post<void>('/api/console/tags', body, { params: { tenantId } })
}

/** DELETE /api/console/tags — delete a single tag */
export function deleteResourceTag(
  tenantId: string,
  resourceType: string,
  resourceCode: string,
  tagKey: string,
) {
  return del<void>('/api/console/tags', {
    params: { tenantId, resourceType, resourceCode, tagKey },
  })
}

/** GET /api/console/tags/search */
export function searchByTag(tenantId: string, tagKey: string, tagValue?: string) {
  return get<unknown>('/api/console/tags/search', {
    tenantId,
    tagKey,
    ...(tagValue ? { tagValue } : {}),
  })
}

/** GET /api/console/tags/keys */
export function listTagKeys(tenantId: string) {
  return get<unknown>('/api/console/tags/keys', { tenantId })
}

/** DELETE /api/console/tags/all — delete all tags for a resource */
export function deleteAllResourceTags(
  tenantId: string,
  resourceType: string,
  resourceCode: string,
) {
  return del<void>('/api/console/tags/all', {
    params: { tenantId, resourceType, resourceCode },
  })
}
