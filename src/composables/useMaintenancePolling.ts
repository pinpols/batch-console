import { onMounted, onUnmounted } from 'vue'
import { getMaintenanceStatus } from '@/api/system.maintenance'
import { useAppStore } from '@/stores/app'

/**
 * 启动时 + 30s 轮询拉维护状态,写入 appStore。
 *
 * - 同时被 axios 503 拦截器写入(对端进入维护期的瞬时反馈)
 * - 退出维护期靠这里的轮询发现 enabled=false → banner 自动消失
 * - 失败静默(`_silent: true`),不污染错误 toast
 *
 * 在 App.vue / 顶层布局调用一次即可,SSR 安全(只在 onMounted 启动)。
 */
export function useMaintenancePolling(intervalMs = 30_000): void {
  const app = useAppStore()
  let timer: ReturnType<typeof setInterval> | null = null

  async function poll() {
    try {
      const s = await getMaintenanceStatus()
      app.setMaintenance(s)
    } catch {
      /* 探活失败不动状态 — 接口本身允许偶发 5xx(虽不应该);保持现有 banner 状态 */
    }
  }

  onMounted(() => {
    void poll()
    timer = setInterval(poll, intervalMs)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })
}
