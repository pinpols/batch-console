import { CanceledError, type InternalAxiosRequestConfig } from 'axios'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { createIdempotencyKey } from '@/utils/idempotency'

let generation = 0
let sharedRevision: string | null = null
let sharedRevisionInitialized = false

function readSharedRevision(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.authSessionRevision)
}

/** 保存当前标签已确认的共享会话代次。 */
export function initializeSharedAuthRevision(): void {
  sharedRevision = readSharedRevision()
  sharedRevisionInitialized = true
}

/** 检查其他标签是否已切换共享 Cookie 的会话。 */
export function isSharedAuthRevisionCurrent(): boolean {
  if (!sharedRevisionInitialized) initializeSharedAuthRevision()
  return sharedRevision === readSharedRevision()
}

/** 接收其他标签的会话变化，返回是否发生了变化。 */
export function acceptSharedAuthRevision(): boolean {
  if (isSharedAuthRevisionCurrent()) return false
  initializeSharedAuthRevision()
  return true
}

/** 通知其他标签重新确认用户身份；代次不包含凭据或用户信息。 */
export function publishSharedAuthRevision(): void {
  const nextRevision = createIdempotencyKey()
  localStorage.setItem(STORAGE_KEYS.authSessionRevision, nextRevision)
  sharedRevision = nextRevision
  sharedRevisionInitialized = true
}

/** 当前页面中的认证会话代次，用于隔离切换账号前后的异步请求。 */
export function currentAuthSession(): number {
  return generation
}

/** 登录或登出开始时使旧会话的在途请求失效。 */
export function advanceAuthSession(): number {
  generation += 1
  return generation
}
/** 旧会话的异步操作不得继续发送认证请求。 */
export function staleAuthSessionError(config?: InternalAxiosRequestConfig) {
  return Object.assign(new CanceledError('认证会话已切换', config), {
    staleSession: true,
    silenced: true,
  })
}
