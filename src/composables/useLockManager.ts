/**
 * Workflow 设计器单人编辑锁管理 composable(MVP)。
 *
 * 行为:
 *  - `acquire(id, tenantId)`:PUT `/lock`,成功 → store.setLock({ isMine:true, ... });
 *    409(他人持锁) → store.setLock({ isMine:false, lockedBy, ... }) 返回 'readonly'
 *  - mount 后开 30s setInterval 续期 `renew`;续期 409/失败 → 转只读 + 抛 onLost 回调
 *  - `release()`:调 DELETE `/lock`,onUnmounted / beforeunload 触发(后者用 sendBeacon 兜底)
 *
 * 设计要点:
 *  - 不直接读 axios 错误格式;由调用方 try/catch 后告诉 composable 走哪个分支
 *  - 单测无须 mock 定时器(可外部传 intervalMs=0 关闭轮询)
 */

import { onBeforeUnmount } from 'vue'
import { workflowDesignerApi, type WorkflowLockInfo } from '@/api/workflowDesigner'
import { useDesignerStore } from '@/views/workflow/designer/store/useDesignerStore'
import { logRoute } from '@/utils/logger'

export interface UseLockManagerOptions {
  /** 锁续期间隔 ms,默认 30s;0 = 不启自动续期(供单测) */
  intervalMs?: number
  /** 锁丢失(续期失败或被夺)时回调;UI 层弹 banner + 切只读 */
  onLost?: (reason: 'expired' | 'taken' | 'network') => void
}

interface ApiError {
  response?: { status?: number; data?: unknown }
  status?: number
}

function extractLockConflict(err: unknown): {
  lockedBy: string
  lockedByDisplayName?: string
  expiresAt: string
} | null {
  const e = err as ApiError
  const status = e?.response?.status ?? e?.status
  if (status !== 409) return null
  const data = e?.response?.data as Record<string, unknown> | undefined
  // BE BizException 返回 envelope `{ code, message, data: { lockedBy, ... } }`;
  // 兼容直接平铺与嵌套 data 两种形态
  const payload = (data?.data as Record<string, unknown>) ?? data ?? {}
  const lockedBy = payload?.lockedBy
  if (typeof lockedBy !== 'string') return null
  return {
    lockedBy,
    lockedByDisplayName:
      typeof payload?.lockedByDisplayName === 'string' ? payload.lockedByDisplayName : undefined,
    expiresAt: typeof payload?.expiresAt === 'string' ? payload.expiresAt : '',
  }
}

export function useLockManager(opts: UseLockManagerOptions = {}) {
  const store = useDesignerStore()
  const intervalMs = opts.intervalMs ?? 30_000

  let timer: ReturnType<typeof setInterval> | null = null
  let currentId: number | null = null
  let currentTenant: string | null = null
  let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null

  function applyMine(info: WorkflowLockInfo) {
    store.setLock({ isMine: true, lockedBy: info.lockedBy, expiresAt: info.expiresAt })
  }

  async function acquire(id: number, tenantId: string): Promise<'editable' | 'readonly'> {
    currentId = id
    currentTenant = tenantId
    try {
      const info = await workflowDesignerApi.acquireLock(id, tenantId)
      applyMine(info)
      startTimer()
      installBeforeUnload()
      return 'editable'
    } catch (err) {
      const conflict = extractLockConflict(err)
      if (conflict) {
        store.setLock({ isMine: false, ...conflict })
        return 'readonly'
      }
      // 非 409 错误:走只读兜底(避免脏写),但不填 lockedBy
      store.setLock({ isMine: false, lockedBy: '', expiresAt: '' })
      throw err
    }
  }

  async function renew(): Promise<void> {
    if (currentId == null || currentTenant == null) return
    try {
      const info = await workflowDesignerApi.renewLock(currentId, currentTenant)
      applyMine(info)
    } catch (err) {
      const conflict = extractLockConflict(err)
      if (conflict) {
        store.setLock({ isMine: false, ...conflict })
        stopTimer()
        opts.onLost?.('taken')
      } else {
        // 网络/服务问题:暂保持本地锁状态不切只读,但停止续期(避免风暴)
        stopTimer()
        opts.onLost?.('network')
      }
    }
  }

  async function release(): Promise<void> {
    stopTimer()
    uninstallBeforeUnload()
    if (currentId == null || currentTenant == null) return
    const lock = store.lock
    if (!lock || !lock.isMine) {
      currentId = null
      currentTenant = null
      return
    }
    try {
      await workflowDesignerApi.releaseLock(currentId, currentTenant)
    } catch (err) {
      logRoute('[designer] releaseLock failed (ignored)', { err: String(err) })
    } finally {
      store.setLock(null)
      currentId = null
      currentTenant = null
    }
  }

  function startTimer() {
    stopTimer()
    if (intervalMs <= 0) return
    timer = setInterval(() => {
      void renew()
    }, intervalMs)
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function installBeforeUnload() {
    if (typeof window === 'undefined' || beforeUnloadHandler) return
    beforeUnloadHandler = () => {
      if (currentId == null || currentTenant == null) return
      const lock = store.lock
      if (!lock || !lock.isMine) return
      // sendBeacon 是 fire-and-forget,刷新/关闭窗口时唯一可靠的释放通道
      const url = `/api/console/workflow-definitions/${currentId}/lock?tenantId=${encodeURIComponent(
        currentTenant,
      )}`
      try {
        // 浏览器 fetch keepalive DELETE 兜底 sendBeacon 不支持 DELETE 的限制
        if (typeof fetch === 'function') {
          void fetch(url, { method: 'DELETE', credentials: 'include', keepalive: true }).catch(
            () => undefined,
          )
        }
      } catch {
        // 静默
      }
    }
    window.addEventListener('beforeunload', beforeUnloadHandler)
  }

  function uninstallBeforeUnload() {
    if (typeof window === 'undefined' || !beforeUnloadHandler) return
    window.removeEventListener('beforeunload', beforeUnloadHandler)
    beforeUnloadHandler = null
  }

  onBeforeUnmount(() => {
    void release()
  })

  return { acquire, renew, release }
}
