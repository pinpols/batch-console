import { get, post, del } from '@/api/client'

export type ResourceType = 'JOB' | 'WORKFLOW' | 'FILE_CHANNEL' | 'FILE_TEMPLATE'

/** GET /api/console/tags — 查询资源标签 */
export function listResourceTags(
  tenantId: string,
  resourceType: ResourceType,
  resourceCode: string,
) {
  return get<unknown>('/api/console/tags', { tenantId, resourceType, resourceCode })
}

/** POST /api/console/tags — 新增或更新标签 */
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

/** DELETE /api/console/tags — 删除单个标签 */
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

/** DELETE /api/console/tags/all — 删除资源的全部标签 */
export function deleteAllResourceTags(
  tenantId: string,
  resourceType: string,
  resourceCode: string,
) {
  return del<void>('/api/console/tags/all', {
    params: { tenantId, resourceType, resourceCode },
  })
}
