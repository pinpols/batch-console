import type { ProgressStreamHandlers } from '@/types/progress'
import {
  getCurrentInstance,
  onActivated,
  onDeactivated,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue'
import type { SseConnectionStatus } from './useSseAutoReload'

/** 初始/重连读取快照，在线时直接消费推送；失联期间退避重连并低频补查。 */
interface ProgressOptions<T, K> {
  load: (key: K, tenant: string) => Promise<T>
  subscribe: (key: K, tenant: string, handlers: ProgressStreamHandlers<T>) => Promise<EventSource>
  matches: (snapshot: T, key: K) => boolean
  enabled: (key: K) => boolean
}
export function useProgressSnapshot<T extends { tenantId: string; generatedAt: string }, K>(
  tenantId: MaybeRefOrGetter<string>,
  scopeKey: MaybeRefOrGetter<K>,
  options: ProgressOptions<T, K>,
) {
  const progress = shallowRef<T | null>(null)
  const status = ref<SseConnectionStatus>('connecting')
  const error = shallowRef<unknown>(null)
  const loading = ref(false)
  const lastRefreshedAt = ref<number | null>(null)
  let generation = 0
  let active = true
  let disposed = false
  let source: EventSource | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined
  let failures = 0
  let pushSequence = 0
  let readSequence = 0

  function cleanup() {
    generation++
    source?.close()
    source = undefined
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    clearTimeout(fallbackTimer)
    fallbackTimer = undefined
  }
  function valid(g: number, tenant: string, id: K) {
    return (
      !disposed &&
      active &&
      g === generation &&
      tenant === toValue(tenantId) &&
      id === toValue(scopeKey)
    )
  }
  function accept(data: T, g: number, tenant: string, id: K) {
    if (!valid(g, tenant, id) || data.tenantId !== tenant || !options.matches(data, id))
      return false
    const timestamp = Date.parse(data.generatedAt)
    if (!Number.isFinite(timestamp)) return false
    if (progress.value && timestamp < Date.parse(progress.value.generatedAt)) return false
    progress.value = data
    lastRefreshedAt.value = timestamp
    error.value = null
    return true
  }
  async function read(g: number, tenant: string, id: K) {
    if (!valid(g, tenant, id) || !tenant || !options.enabled(id)) return
    const sequence = ++readSequence
    const observedPush = pushSequence
    loading.value = !progress.value
    try {
      const snapshot = await options.load(id, tenant)
      // 查询途中已收到推送时，旧读快照不得覆盖推送；并发读只接受最后请求。
      if (sequence === readSequence && observedPush === pushSequence)
        accept(snapshot, g, tenant, id)
    } catch (failure) {
      if (valid(g, tenant, id) && sequence === readSequence && observedPush === pushSequence)
        error.value = failure
    } finally {
      if (valid(g, tenant, id) && sequence === readSequence) loading.value = false
    }
  }
  function isLive() {
    return status.value === 'live'
  }
  function fallback(g: number, tenant: string, id: K) {
    clearTimeout(fallbackTimer)
    fallbackTimer = setTimeout(async () => {
      if (!valid(g, tenant, id) || status.value === 'live') return
      await read(g, tenant, id)
      if (valid(g, tenant, id) && !isLive()) fallback(g, tenant, id)
    }, 30_000)
  }
  async function connect(g: number, tenant: string, id: K) {
    let failed = false
    const fail = () => {
      if (failed || !valid(g, tenant, id)) return
      failed = true
      source?.close()
      source = undefined
      failures++
      status.value = failures >= 5 ? 'polling' : 'reconnecting'
      error.value = new Error('execution stream disconnected')
      fallback(g, tenant, id)
      reconnectTimer = setTimeout(
        async () => {
          if (!valid(g, tenant, id)) return
          await read(g, tenant, id)
          if (valid(g, tenant, id)) void connect(g, tenant, id)
        },
        Math.min(30_000, 2000 * 2 ** Math.min(failures - 1, 4)),
      )
    }
    try {
      const opened = await options.subscribe(id, tenant, {
        ready: () => {
          if (!valid(g, tenant, id) || failed) return
          status.value = 'live'
          failures = 0
          error.value = null
          clearTimeout(fallbackTimer)
        },
        snapshot: (data) => {
          if (!failed && accept(data, g, tenant, id)) pushSequence++
        },
        error: fail,
        reset: () => {
          if (!failed) void read(g, tenant, id)
        },
      })
      if (!valid(g, tenant, id) || failed) opened.close()
      else source = opened
    } catch {
      fail()
    }
  }
  function restart() {
    cleanup()
    progress.value = null
    error.value = null
    lastRefreshedAt.value = null
    loading.value = false
    const tenant = toValue(tenantId)
    const id = toValue(scopeKey)
    if (disposed || !active || !tenant || !options.enabled(id)) return
    failures = 0
    status.value = 'connecting'
    const g = generation
    void read(g, tenant, id)
    fallback(g, tenant, id)
    void connect(g, tenant, id)
  }
  function refresh() {
    const tenant = toValue(tenantId)
    const id = toValue(scopeKey)
    return read(generation, tenant, id)
  }
  watch(() => [toValue(tenantId), toValue(scopeKey)] as const, restart, { immediate: true })
  if (getCurrentInstance()) {
    onDeactivated(() => {
      active = false
      cleanup()
    })
    onActivated(() => {
      if (!active) {
        active = true
        restart()
      }
    })
  }
  onScopeDispose(() => {
    disposed = true
    cleanup()
  })
  return {
    progress: readonly(progress),
    status: readonly(status),
    error: readonly(error),
    loading: readonly(loading),
    lastRefreshedAt: readonly(lastRefreshedAt),
    refresh,
  }
}
