import { get } from '@/api/client'
import { ElMessage } from 'element-plus'
import { i18n } from '@/locales'
import type { PageResponse, PageResult } from '@/types'

const truncationNotified = new Set<string>()

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

/**
 * 将分页 query 拉满到单数组（OpenAPI data 为 PageResponse 且未提供筛选参数时，用于端上筛选/关联解析）。
 * 数据量大时可能较慢；后端若补充 query 参数应改为服务端筛选。
 */
export async function fetchAllPageItems<T>(
  url: string,
  baseParams: Record<string, string | number | boolean | undefined>,
  opts?: { pageSize?: number; maxPages?: number; devWarnThreshold?: number },
): Promise<T[]> {
  const pageSize = opts?.pageSize ?? 200
  const maxPages = opts?.maxPages ?? 20
  const devWarnThreshold = opts?.devWarnThreshold ?? 2000

  const first = await get<PageResponse<T> | T[]>(url, {
    ...baseParams,
    pageNo: 1,
    pageSize,
  })

  if (Array.isArray(first)) {
    return first as T[]
  }

  const pr0 = first as PageResponse<T>
  const batch0 = (pr0.items ?? []) as T[]
  const out: T[] = [...batch0]
  const total = Number(pr0.total ?? 0)
  if (batch0.length < pageSize || (total > 0 && out.length >= total)) {
    return out
  }

  // 根据 total 计算剩余页数，并行请求
  const totalPages = total > 0 ? Math.min(Math.ceil(total / pageSize), maxPages) : maxPages
  if (totalPages > 1) {
    const remaining = Array.from({ length: totalPages - 1 }, (_, i) =>
      get<PageResponse<T>>(url, { ...baseParams, pageNo: i + 2, pageSize }),
    )
    const results = await Promise.all(remaining)
    for (const pr of results) {
      const items = (pr.items ?? []) as T[]
      out.push(...items)
      if (total > 0 && out.length >= total) break
    }
  }
  if (import.meta.env.DEV && devWarnThreshold > 0 && out.length > devWarnThreshold) {
    console.warn(
      `[fetchAllPageItems] ${url} returned ${out.length} items — consider server-side filtering`,
    )
  }
  const cappedByMaxPages = total > 0 && Math.ceil(total / pageSize) > maxPages
  if (
    cappedByMaxPages &&
    out.length < total &&
    typeof document !== 'undefined' &&
    !truncationNotified.has(url)
  ) {
    truncationNotified.add(url)
    ElMessage.warning({
      message: i18n.global.t('fetchAllPageItems.truncated', { shown: out.length, total }),
      showClose: true,
      duration: 6500,
    })
  }
  return out
}
