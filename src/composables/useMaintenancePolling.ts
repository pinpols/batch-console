import { onMounted, onUnmounted } from 'vue'
import { getMaintenanceStatus } from '@/api/system.maintenance'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

/**
 * 启动时 + 30s 轮询拉维护状态,写入 appStore。
 *
 * - 同时被 axios 503 拦截器写入(对端进入维护期的瞬时反馈)
 * - 退出维护期靠这里的轮询发现 enabled=false → banner 自动消失
 * - 失败静默(`_silent: true`),不污染错误 toast
 *
 * 在 App.vue / 顶层布局调用一次即可,SSR 安全(只在 onMounted 启动)。
 */
export function useMaintenancePolling(
  normalIntervalMs = 30_000,
  maintenanceIntervalMs = 10_000,
): void {
  const app = useAppStore()
  const auth = useAuthStore()
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  function schedule() {
    if (stopped) return
    const delay = app.maintenance.enabled
      ? app.maintenance.active
        ? maintenanceIntervalMs
        : Math.min(5_000, maintenanceIntervalMs)
      : normalIntervalMs
    timer = setTimeout(() => void poll(), delay)
  }

  async function poll() {
    try {
      const s = await getMaintenanceStatus()
      if (stopped) return
      app.setMaintenance({
        ...s,
        adminBypass: s.active && auth.hasPermission('ROLE_ADMIN'),
        lastSyncedAt: new Date().toISOString(),
        syncError: null,
        isStale: false,
      })
    } catch (error) {
      if (stopped) return
      const last = app.maintenance.lastSyncedAt
      const staleAfterMs = Math.max(normalIntervalMs * 2, 60_000)
      const syncError = error instanceof Error ? error.message : String(error)
      let isStale = !last
      if (last) {
        const observedAtMs = Date.now()
        const lastSyncedAtMs = Date.parse(last)
        const elapsedSinceSyncMs = observedAtMs - lastSyncedAtMs
        isStale = elapsedSinceSyncMs > staleAfterMs
      }
      app.setMaintenance({
        syncError,
        isStale,
      })
    } finally {
      schedule()
    }
  }

  onMounted(() => {
    void poll()
  })
  onUnmounted(() => {
    stopped = true
    if (timer) clearTimeout(timer)
  })
}
