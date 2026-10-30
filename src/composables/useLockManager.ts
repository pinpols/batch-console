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

import { onScopeDispose } from 'vue'
import { workflowDesignerApi, type WorkflowLockInfo } from '@/api/workflowDesigner'
import {
  useDesignerStore,
  type DesignerLockState,
} from '@/views/workflow/designer/store/useDesignerStore'
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
  interface LockSession {
    id: number
    tenantId: string
    owned: boolean
    displayed: DesignerLockState
  }
  let current: LockSession | null = null
  let disposed = false
  let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null

  function isCurrent(session: LockSession): boolean {
    return !disposed && current === session
  }

  function applyMine(session: LockSession, info: WorkflowLockInfo) {
    store.setLock({ isMine: true, lockedBy: info.lockedBy, expiresAt: info.expiresAt })
    session.owned = true
    session.displayed = store.lock
  }

  async function acquire(id: number, tenantId: string): Promise<'editable' | 'readonly'> {
    if (disposed) return 'readonly'
    stopTimer()
    uninstallBeforeUnload()
    const session: LockSession = { id, tenantId, owned: false, displayed: null }
    current = session
    try {
      const info = await workflowDesignerApi.acquireLock(id, tenantId)
      if (!isCurrent(session)) return 'readonly'
      applyMine(session, info)
      startTimer()
      installBeforeUnload()
      return 'editable'
    } catch (err) {
      if (!isCurrent(session)) return 'readonly'
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
    const session = current
    if (!session || !session.owned || !isCurrent(session)) return
    try {
      const info = await workflowDesignerApi.renewLock(session.id, session.tenantId)
      if (!isCurrent(session)) return
      applyMine(session, info)
    } catch (err) {
      if (!isCurrent(session)) return
      const conflict = extractLockConflict(err)
      if (conflict) {
        session.owned = false
        store.setLock({ isMine: false, ...conflict })
        session.displayed = store.lock
        stopTimer()
        opts.onLost?.('taken')
      } else {
        // 保持现有网络异常策略；迟到的旧上下文不能触发新画布的锁丢失通知。
        stopTimer()
        opts.onLost?.('network')
      }
    }
  }

  async function release(): Promise<void> {
    const session = current
    current = null
    stopTimer()
    uninstallBeforeUnload()
    if (!session) return
    if (session.displayed && store.lock === session.displayed) store.setLock(null)
    if (!session.owned) return
    session.owned = false
    try {
      await workflowDesignerApi.releaseLock(session.id, session.tenantId)
    } catch (err) {
      logRoute('[designer] releaseLock failed (ignored)', { err: String(err) })
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
      const session = current
      if (!session || !session.owned) return
      // sendBeacon 是 fire-and-forget,刷新/关闭窗口时唯一可靠的释放通道
      const url = `/api/console/workflow-definitions/${session.id}/lock?tenantId=${encodeURIComponent(
        session.tenantId,
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

  onScopeDispose(() => {
    disposed = true
    void release()
  })

  return { acquire, renew, release }
}
