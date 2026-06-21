import { computed, ref } from 'vue'
import type {
  CursorPageParams,
  OffsetPageParams,
  PagedResult,
  PageParams,
  PaginationMode,
} from '@/api/pagination'

/**
 * 双轨分页 composable(ADR-031)。
 *
 * 用法:
 * ```ts
 * const pager = usePagination({ mode: 'page', pageSize: 15 })
 * async function load() {
 *   const result = await api.list({ ...query, ...pager.apiParams.value })
 *   pager.applyResponse(result)
 * }
 * watch(pager.cursor, load)  // 翻页时自动重载
 * ```
 */
export function usePagination(options?: { mode?: PaginationMode; pageSize?: number }) {
  const mode = ref<PaginationMode>(options?.mode ?? 'page')
  const pageSize = ref(options?.pageSize ?? 15)
  const pageNo = ref(1)
  const cursor = ref<string | null>(null)
  /** Cursor 模式下保留前页 token 栈,支持「上一页」 */
  const prevCursors = ref<string[]>([])
  const total = ref<number | null>(null)
  const hasMore = ref(false)

  const apiParams = computed<PageParams>(() => {
    if (mode.value === 'cursor') {
      return { cursor: cursor.value, pageSize: pageSize.value } satisfies CursorPageParams
    }
    return { pageNo: pageNo.value, pageSize: pageSize.value } satisfies OffsetPageParams
  })

  function applyResponse<T>(r: PagedResult<T>) {
    total.value = r.total
    hasMore.value = r.hasMore
    if (mode.value === 'cursor') {
      cursor.value = r.nextCursor
    }
  }

  function reset() {
    pageNo.value = 1
    cursor.value = null
    prevCursors.value = []
    total.value = null
    hasMore.value = false
  }

  function nextPage() {
    if (mode.value === 'cursor') {
      if (!hasMore.value) return
      prevCursors.value.push(cursor.value ?? '')
      // cursor 已被 applyResponse 更新到 nextCursor,这里只是触发 reactivity
      cursor.value = cursor.value
    } else {
      pageNo.value += 1
    }
  }

  function prevPage() {
    if (mode.value === 'cursor') {
      const prev = prevCursors.value.pop()
      cursor.value = prev === '' ? null : (prev ?? null)
    } else {
      pageNo.value = Math.max(1, pageNo.value - 1)
    }
  }

  function gotoPage(n: number) {
    if (mode.value === 'cursor') return // cursor 模式不支持跳页
    pageNo.value = Math.max(1, n)
  }

  function setPageSize(n: number) {
    pageSize.value = n
    reset()
  }

  function setMode(m: PaginationMode) {
    mode.value = m
    reset()
  }

  return {
    mode,
    pageSize,
    pageNo,
    cursor,
    total,
    hasMore,
    apiParams,
    applyResponse,
    reset,
    nextPage,
    prevPage,
    gotoPage,
    setPageSize,
    setMode,
  }
}
