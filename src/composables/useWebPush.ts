/**
 * Web Push 推送订阅前端骨架。
 *
 * iOS 16.4+ / 所有现代 Android 都支持。前提:
 *   1. 站点是 HTTPS(本地 dev 用 localhost 也算 secure context)
 *   2. PWA 已"添加到主屏幕"(iOS 强制要求,不在 standalone 模式不让请求权限)
 *   3. Service Worker 已 register
 *
 * 后端提供:
 *   - VAPID 公钥端点 `GET /api/console/push/vapid-public-key`
 *   - 订阅注册 `POST /api/console/push/subscribe?tenantId=...` body: `{ endpoint, keys: { p256dh, auth } }`
 *   - 取消 `POST /api/console/push/unsubscribe?tenantId=...`
 *   - 推送发送 internal 端点(告警 / 审批触发时调)
 */

import { get, post } from '@/api/client'
import { readStoredTenantId } from '@/api/interceptors'

const PUSH_API_BASE = '/api/console/push'

export type PushPermissionResult = 'granted' | 'denied' | 'unsupported' | 'not-standalone'

/** 当前环境是否能用 Push */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** PWA 是否已加到主屏幕(iOS 强制条件) */
function isInStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const matchMode =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || matchMode
}

/** base64-url-safe → Uint8Array(VAPID applicationServerKey 用) */
function urlBase64ToUint8(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/**
 * 请求 push 授权 + 订阅 + 上报后端。
 * 调用方应在用户显式行动(点击 "Enable notifications" 按钮)后调,不要悄悄请求。
 */
export async function requestPushPermission(): Promise<PushPermissionResult> {
  if (!isPushSupported()) return 'unsupported'
  if (!isInStandalone()) return 'not-standalone'

  // 1. 浏览器原生权限弹窗
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'

  // 2. 拿 VAPID 公钥
  const { publicKey } = await get<{ publicKey: string }>(`${PUSH_API_BASE}/vapid-public-key`)
  if (!publicKey) throw new Error('VAPID key missing')

  // 3. SW 注册 + 订阅
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true, // Web Push API 要求所有 push 必须有 UI(防 silent push)
    applicationServerKey: urlBase64ToUint8(publicKey),
  })

  // 4. 上报后端持久化
  await post<void>(`${PUSH_API_BASE}/subscribe`, sub.toJSON(), {
    params: { tenantId: readStoredTenantId() },
  })

  return 'granted'
}

/** 取消订阅 */
export async function unsubscribePush(): Promise<void> {
  if (!isPushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await post<void>(
    `${PUSH_API_BASE}/unsubscribe`,
    { endpoint: sub.endpoint },
    {
      params: { tenantId: readStoredTenantId() },
    },
  ).catch(() => {
    /* 后端失败也继续 unsubscribe,前端态优先 */
  })
  await sub.unsubscribe()
}

/** 当前是否已订阅 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}
