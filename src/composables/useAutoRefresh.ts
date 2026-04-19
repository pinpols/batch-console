import { onBeforeUnmount, onMounted } from 'vue'

/**
 * 按固定间隔调用 `fn`，**页面隐藏（切后台 / 切 tab / 锁屏）时自动暂停**，
 * 可见时恢复并立刻刷一次避免数据滞后。用于 oncall 场景（告警 / 概览）
 * 让手机放在那也能自动滚动最新数据。
 *
 * - `intervalMs` 默认 30s
 * - 组件卸载自动清理
 * - 不会与 `fn` 本身的 onMounted/watch 冲突（只追加周期性刷新）
 */
export function useAutoRefresh(fn: () => void | Promise<void>, intervalMs = 30_000): void {
  let timer: ReturnType<typeof setInterval> | null = null
  let lastRunAt = 0
  const MIN_GAP_MS = 1000

  function safeRun() {
    const now = Date.now()
    if (now - lastRunAt < MIN_GAP_MS) return
    lastRunAt = now
    try {
      void fn()
    } catch {
      /* fn 自己应吞掉错误；这里再兜一层防意外 */
    }
  }

  function start() {
    if (timer != null) return
    timer = setInterval(safeRun, intervalMs)
  }

  function stop() {
    if (timer != null) {
      clearInterval(timer)
      timer = null
    }
  }

  function onVisibilityChange() {
    if (typeof document === 'undefined') return
    if (document.hidden) {
      stop()
    } else {
      safeRun()
      start()
    }
  }

  onMounted(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    start()
  })

  onBeforeUnmount(() => {
    stop()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })
}
