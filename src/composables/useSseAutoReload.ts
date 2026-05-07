import {
  getCurrentInstance,
  onActivated,
  onDeactivated,
  onScopeDispose,
  watch,
  type Ref,
  type WatchSource,
} from 'vue'
import { ElMessage } from 'element-plus'
import { createSseStream } from '@/api/stream'

type SseStreamType = Parameters<typeof createSseStream>[0]

export interface UseSseAutoReloadOptions {
  /** SSE 接入的后端域,对应 `/api/console/stream/{domain}/events` 或 `/api/console/{domain}/events` */
  domain: SseStreamType
  /** 收到事件后要触发的重新加载(会被去抖)。 */
  reload: () => void | Promise<void>
  /** 当该 watch 源变化时,关闭旧流并以新值重开(常用于 tenantId)。 */
  scope?: WatchSource<unknown>
  /** 去抖窗口(毫秒)。事件密集时在窗口内只触发一次 reload。默认 800ms。 */
  debounceMs?: number
  /** 是否启用。默认 true;传 ref 则运行期生效(false→关流,true→重开)。 */
  enabled?: Ref<boolean> | boolean
  /**
   * 连接失败(ticket 获取 / EventSource onerror)的最大重试次数。
   * 达到上限后停止并调用 `onFallback`。默认 5。
   */
  maxRetries?: number
  /**
   * 到达 maxRetries 仍未恢复时调用(仅触发一次)。
   * 不传则使用默认行为:弹一次 `ElMessage.warning('实时推送暂不可用,请手动刷新')`。
   * 传 `null` 禁用默认行为(完全静默)。
   */
  onFallback?: (() => void) | null
}

/**
 * 订阅后端 SSE 流并在收到事件时去抖刷新列表。
 * 适用场景:告警、Worker、Workflow 运行、Outbox 等 view 原本靠轮询,
 * 接 SSE 后可几乎实时更新。
 *
 * 关键设计:
 * - **KeepAlive 感知**:DefaultLayout 用 KeepAlive 缓存了 20 个 view 实例。如果只
 *   靠 onScopeDispose,SSE 永远不会在切走时关闭 → 8+ 个 SSE view 切完会撞上
 *   浏览器同源连接上限(HTTP/1.1 ≈ 6),后续请求堆积卡死。
 *   用 onActivated/onDeactivated 在 view 切走/回来时关流/重开。真正销毁(KeepAlive
 *   evict 或非 KeepAlive 路径)走 onScopeDispose 兜底。
 * - **generation guard**:tenantId/scope 快速切换时,旧 ticket 返回后不会上位。
 * - **指数退避自愈**:网络抖动后 SSE onerror → 自动换新 ticket 重连,1s/2s/4s/8s/16s(封顶 30s)。
 *   由于后端 ticket 一次性 + 5min 过期,浏览器原生 EventSource 重连机制用不了(会携带旧 ticket 必 401),
 *   这里必须 `es.close()` + 手动 fetch 新 ticket。
 * - **maxRetries 后 onFallback**:让调用方有机会开启 setInterval 兜底或提示用户。
 *
 * 使用示例:
 * ```ts
 * useSseAutoReload({ domain: 'alerts', reload: load, scope: () => tenant.tenantId })
 * ```
 */
export function useSseAutoReload(options: UseSseAutoReloadOptions): void {
  const { domain, reload, scope, debounceMs = 800, maxRetries = 5 } = options

  let sse: EventSource | null = null
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let reopenTimer: ReturnType<typeof setTimeout> | null = null
  let generation = 0
  let retries = 0
  let fallbackNotified = false
  /** KeepAlive 激活态;deactivate 时为 false,期间 maybeOpen() 会跳过。 */
  let isActive = true

  function isEnabled(): boolean {
    const e = options.enabled
    if (e == null) return true
    return typeof e === 'boolean' ? e : e.value
  }

  function schedule() {
    if (reloadTimer) return
    reloadTimer = setTimeout(() => {
      reloadTimer = null
      void reload()
    }, debounceMs)
  }

  function clearReopenTimer() {
    if (reopenTimer) {
      clearTimeout(reopenTimer)
      reopenTimer = null
    }
  }

  function close() {
    generation++
    clearReopenTimer()
    if (sse) {
      sse.close()
      sse = null
    }
    if (reloadTimer) {
      clearTimeout(reloadTimer)
      reloadTimer = null
    }
  }

  function fireFallback() {
    if (fallbackNotified) return
    fallbackNotified = true
    if (options.onFallback === null) return // 显式禁用默认行为
    if (options.onFallback) {
      options.onFallback()
    } else {
      ElMessage.warning({
        message: '实时推送暂不可用,请手动刷新获取最新数据',
        duration: 5_000,
        showClose: true,
      })
    }
  }

  function scheduleReopen(capturedGen: number) {
    if (capturedGen !== generation) return // 已被 close/切换作废
    if (retries >= maxRetries) {
      fireFallback()
      return
    }
    clearReopenTimer()
    const delay = Math.min(30_000, 1_000 * 2 ** retries)
    retries += 1
    reopenTimer = setTimeout(() => {
      reopenTimer = null
      void open()
    }, delay)
  }

  async function open() {
    close()
    if (!isEnabled()) return
    const my = generation
    try {
      const es = await createSseStream(
        domain,
        () => schedule(),
        () => scheduleReopen(my),
      )
      if (my !== generation) {
        es.close()
        return
      }
      sse = es
      retries = 0
      fallbackNotified = false
    } catch {
      scheduleReopen(my)
    }
  }

  /** 仅当 KeepAlive 激活态时才开流,deactivated 期间所有 trigger 都跳过。 */
  function maybeOpen() {
    if (!isActive) return
    void open()
  }

  if (scope) {
    watch(scope, () => maybeOpen(), { immediate: true })
  } else {
    maybeOpen()
  }

  // enabled 运行期响应:false → 关流,true → 重开
  const enabledSource = options.enabled
  if (enabledSource != null && typeof enabledSource !== 'boolean') {
    watch(enabledSource, (on) => {
      if (on) maybeOpen()
      else close()
    })
  }

  // KeepAlive 生命周期:被缓存(deactivate)立刻关流释放浏览器连接配额;
  // 重新激活时按当前 scope 重开。getCurrentInstance 防止在 effectScope 测试场景下报错。
  if (getCurrentInstance()) {
    onDeactivated(() => {
      isActive = false
      close()
    })
    onActivated(() => {
      // 首次 onActivated 紧跟 setup,此时 isActive 已经是 true 且 setup 期 maybeOpen
      // 已开过流;条件分支跳过避免双开。后续从 deactivated 回来才走重开。
      if (isActive) return
      isActive = true
      maybeOpen()
    })
  }

  // onScopeDispose works both inside a component (auto-fires on unmount)
  // and inside a bare effectScope (for testing).
  onScopeDispose(close)
}
