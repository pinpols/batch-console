import type { PageResult } from '@/types'

/** OpenAPI 多为数组返回时，列表页前端分页用 */
export function toPageResult<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const total = items.length
  const start = (page - 1) * pageSize
  return {
    records: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  }
}
