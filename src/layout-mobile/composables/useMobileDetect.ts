/**
 * 移动端判定：UA 匹配（iPhone / iPad / Android / 通用 Mobile 字样）
 * 或 viewport 宽度 < 768px。用于：
 *   - 登录/默认路由的自动跳转（/ → /m/ops/summary）
 *   - 桌面专属页面在窄屏下显示 "请用桌面打开" 挡板
 */

export function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent)
}

export function isNarrowViewport(threshold = 768): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < threshold
}

export function isMobile(): boolean {
  return isMobileUA() || isNarrowViewport()
}
