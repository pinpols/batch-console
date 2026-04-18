import { onBeforeUnmount, watch, type Ref, type WatchSource } from 'vue'
import { createSseStream } from '@/api/stream'

type SseStreamType = Parameters<typeof createSseStream>[0]

export interface UseSseAutoReloadOptions {
  /** SSE 接入的后端域,对应 `/api/console/stream/{domain}/events` 或 `/api/console/{domain}/events` */
  domain: SseStreamType
  /** 收到事件后要触发的重新加载(会被去抖)。 */
  reload: () => void | Promise<void>
  /** 当该 watch 源变化时,关闭旧流并以新值重开(常用于 tenantId)。 */
  scope?: WatchSource<unknown>
  /**
   * 去抖窗口(毫秒)。事件密集时在窗口内只触发一次 reload。默认 800ms。
   */
  debounceMs?: number
  /**
   * 是否启用。默认 true;可传 ref 动态控制。
   */
  enabled?: Ref<boolean> | boolean
}

/**
 * 订阅后端 SSE 流并在收到事件时去抖刷新列表。
 * 适用场景:告警、Worker、Workflow 运行、Outbox 等 view 原本靠轮询,
 * 接 SSE 后可几乎实时更新,同时保留轮询兜底(调用方自行保留原 load 逻辑即可)。
 *
 * 使用示例:
 * ```ts
 * useSseAutoReload({ domain: 'alerts', reload: load, scope: () => tenant.tenantId })
 * ```
 */
export function useSseAutoReload(options: UseSseAutoReloadOptions): void {
  const { domain, reload, scope, debounceMs = 800 } = options

  let sse: EventSource | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function isEnabled(): boolean {
    const e = options.enabled
    if (e == null) return true
    return typeof e === 'boolean' ? e : e.value
  }

  function schedule() {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      void reload()
    }, debounceMs)
  }

  function close() {
    if (sse) {
      sse.close()
      sse = null
    }
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function open() {
    close()
    if (!isEnabled()) return
    sse = createSseStream(domain, () => schedule())
  }

  if (scope) {
    watch(scope, open, { immediate: true })
  } else {
    open()
  }

  onBeforeUnmount(close)
}
