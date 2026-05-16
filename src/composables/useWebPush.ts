/**
 * Web Push 推送订阅前端骨架。
 *
 * iOS 16.4+ / 所有现代 Android 都支持。前提:
 *   1. 站点是 HTTPS(本地 dev 用 localhost 也算 secure context)
 *   2. PWA 已"添加到主屏幕"(iOS 强制要求,不在 standalone 模式不让请求权限)
 *   3. Service Worker 已 register
 *
 * 后端要提供:
 *   - VAPID 公钥端点 `GET /api/console/push/vapid-public-key`
 *   - 订阅注册 `POST /api/console/push/subscribe` body: `{ endpoint, keys: { p256dh, auth } }`
 *   - 取消 `POST /api/console/push/unsubscribe`
 *   - 推送发送 internal 端点(告警 / 审批触发时调)
 *
 * 当前后端这 3 个端点还没上,这里只实现前端逻辑 + 给后端留接口契约。
 * 接入步骤:后端实现完上述 endpoint 后,把下面 4 个 fetch URL 改回 `/api/...`
 * 然后在 MobileAppBar 或 MInstallHint 内合适时机调 `requestPushPermission()`。
 */

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
  const keyResp = await fetch(`${PUSH_API_BASE}/vapid-public-key`)
  if (!keyResp.ok) throw new Error(`VAPID key fetch failed: ${keyResp.status}`)
  const { publicKey } = (await keyResp.json()) as { publicKey: string }

  // 3. SW 注册 + 订阅
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true, // Web Push API 要求所有 push 必须有 UI(防 silent push)
    applicationServerKey: urlBase64ToUint8(publicKey),
  })

  // 4. 上报后端持久化
  const reportResp = await fetch(`${PUSH_API_BASE}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  })
  if (!reportResp.ok) throw new Error(`subscribe report failed: ${reportResp.status}`)

  return 'granted'
}

/** 取消订阅 */
export async function unsubscribePush(): Promise<void> {
  if (!isPushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await fetch(`${PUSH_API_BASE}/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {
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
