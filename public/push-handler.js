/* eslint-disable no-restricted-globals */
/**
 * Service Worker push handler 骨架。
 * 由 vite-plugin-pwa 的 workbox.importScripts 注入到生成的 SW。
 *
 * 后端推送 payload 约定(JSON):
 *   {
 *     "title": "[CRITICAL] Job XXX failed",
 *     "body":  "tenant=ta · jobCode=ETL_01 · 2 retries exhausted",
 *     "tag":   "alert-1234",       // 同 tag 折叠为 1 条
 *     "url":   "/m/alerts?id=1234" // 点击通知后导航目标
 *   }
 *
 * 当前 push handler 已实现,后端发送侧未上线 — 接入只需后端按上述 payload 发即可。
 */

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Notification', body: event.data.text() }
  }
  const { title = 'Batch Console', body = '', tag, url = '/m/ops/summary', icon } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag, // 折叠:同 tag 的旧通知被新通知替换
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png', // Android 状态栏小图标
      data: { url },
      requireInteraction: false,
    }),
  )
})

/** 用户点通知 → 复用已开窗口 或 新开 PWA 落地页 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/m/ops/summary'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 优先 focus 已开窗口并导航到 target
        for (const c of clientList) {
          if ('focus' in c) {
            void c.focus()
            if ('navigate' in c) return c.navigate(target)
            return
          }
        }
        // 没活动窗口 → 新开
        return self.clients.openWindow(target)
      }),
  )
})
