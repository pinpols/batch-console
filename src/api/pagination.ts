/**
 * 分页请求 / 响应通用类型(ADR-031 双轨)。
 *
 * BE 端 sealed interface PageQuery (Offset | Cursor) + PagedResult<T> 直接对应。
 */

export type PaginationMode = 'page' | 'cursor'

export interface OffsetPageParams {
  pageNo: number
  pageSize: number
}

export interface CursorPageParams {
  cursor: string | null
  pageSize: number
}

export type PageParams = OffsetPageParams | CursorPageParams

export interface PagedResult<T> {
  items: T[]
  /** offset 模式总数;cursor 模式 null */
  total: number | null
  /** offset 模式当前页号;cursor 模式 null */
  pageNo: number | null
  /** cursor 模式下一页 token;offset 模式 null */
  nextCursor: string | null
  /** 是否还有下一页 */
  hasMore: boolean
}

/** 类型守卫:cursor 模式响应 */
export function isCursorResult<T>(r: PagedResult<T>): boolean {
  return r.nextCursor !== null || r.total === null
}

/** 把 PageParams 序列化成 axios params 对象 */
export function toApiParams(p: PageParams): Record<string, string | number> {
  if ('cursor' in p) {
    const out: Record<string, string | number> = { pageSize: p.pageSize }
    if (p.cursor) out.cursor = p.cursor
    return out
  }
  return { pageNo: p.pageNo, pageSize: p.pageSize }
}
