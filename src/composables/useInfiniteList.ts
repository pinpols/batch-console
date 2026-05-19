import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export interface InfiniteListPage<T> {
  rows: T[]
  /** 总条数;不知道时返回 undefined,会用 hasMore 兜底 */
  total?: number
  /** 显式告知是否还有下一页(后端不返回 total 时用) */
  hasMore?: boolean
}

export interface UseInfiniteListOptions<T> {
  pageSize?: number
  /** 分页拉取函数,page 从 1 开始 */
  fetchPage: (page: number, pageSize: number) => Promise<InfiniteListPage<T>>
  /** sentinel 进入视口前的距离(px),默认 200 提前预加载下一页 */
  rootMargin?: string
}

/**
 * 移动端无限滚动列表 hook。
 *
 * - `attach(sentinelEl)`:把哨兵元素交给 IntersectionObserver,进入视口自动加载
 * - `reset()`:重置后从第一页加载,用于切租户 / 改筛选 / 下拉刷新
 * - `loadMore()`:手动加载下一页(网络暂时不通时按钮兜底)
 *
 * 不写成响应式的 watch + computed 是为了让调用方用 reactive
 * query 触发时能精确控制 reset 时机(避免初始化双拉)。
 */
export function useInfiniteList<T>(opts: UseInfiniteListOptions<T>) {
  const pageSize = opts.pageSize ?? 15
  // 之前写 `as { value: T[] }` 想绕过 ref<T[]> 的 DeepReadonly,但同时把 Ref 类型也
  // 抹掉了,调用方解构后类型变成 { value }(失去 unwrap),tsc 报 "Property 'X' does
  // not exist on { value: T[] }"。改用 Ref<T[]> 显式标注,保持 ref 语义。
  const rows: Ref<T[]> = ref<T[]>([]) as Ref<T[]>
  const page = ref(0)
  const total = ref(0)
  const hasMore = ref(true)
  const loading = ref(false)
  const error = ref<unknown>(null)

  let observer: IntersectionObserver | null = null
  let attachedEl: Element | null = null
  let lastReqId = 0 // race-safe:reset/loadMore 并发时只接受最新一次

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    loading.value = true
    error.value = null
    const reqId = ++lastReqId
    const next = page.value + 1
    try {
      const result = await opts.fetchPage(next, pageSize)
      if (reqId !== lastReqId) return
      rows.value.push(...result.rows)
      page.value = next
      if (typeof result.total === 'number') {
        total.value = result.total
        hasMore.value = rows.value.length < result.total
      } else {
        hasMore.value = result.hasMore ?? result.rows.length === pageSize
      }
    } catch (err) {
      if (reqId === lastReqId) error.value = err
    } finally {
      if (reqId === lastReqId) loading.value = false
    }
  }

  async function reset(loadFirst = true) {
    rows.value = []
    page.value = 0
    total.value = 0
    hasMore.value = true
    error.value = null
    lastReqId++ // 让进行中的请求作废
    if (loadFirst) await loadMore()
  }

  function detach() {
    if (observer && attachedEl) observer.unobserve(attachedEl)
    observer?.disconnect()
    observer = null
    attachedEl = null
  }

  function attach(el: Element | null | undefined) {
    detach()
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    attachedEl = el
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void loadMore()
            return
          }
        }
      },
      { rootMargin: opts.rootMargin ?? '200px' },
    )
    observer.observe(el)
  }

  onMounted(() => {
    if (rows.value.length === 0 && !loading.value) {
      void loadMore()
    }
  })
  onBeforeUnmount(detach)

  return {
    rows,
    page,
    total,
    hasMore,
    loading,
    error,
    pageSize,
    loadMore,
    reset,
    attach,
  }
}
