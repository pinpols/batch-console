/**
 * 将后端 ISO-8601 时间字符串（或 number epoch ms）格式化为本地可读时间。
 * 输出示例：2026-04-12 13:12:18
 * 对 null / undefined / 空字符串返回 '—'。
 */
export function fmtDatetime(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  const d = typeof val === 'number' ? new Date(val) : new Date(String(val))
  if (isNaN(d.getTime())) return String(val)

  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/**
 * 仅格式化日期部分，输出示例：2026-04-12
 */
export function fmtDate(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  const d = typeof val === 'number' ? new Date(val) : new Date(String(val))
  if (isNaN(d.getTime())) return String(val)

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 紧凑时间:今天/昨天显示「今天 14:47」「昨天 09:30」,本年内显示「5-17 14:47」,
 * 跨年显示完整 `YYYY-MM-DD HH:mm`。适合列表单元格,信息密度高且语义清晰。
 */
export function fmtCompact(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  const d = typeof val === 'number' ? new Date(val) : new Date(String(val))
  if (isNaN(d.getTime())) return String(val)
  const pad = (n: number) => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`

  const now = new Date()
  const sameY = d.getFullYear() === now.getFullYear()
  const sameD = sameY && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  const isYday = sameY && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()

  if (sameD) return `今天 ${hm}`
  if (isYday) return `昨天 ${hm}`
  if (sameY) return `${d.getMonth() + 1}-${pad(d.getDate())} ${hm}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
}

/**
 * 相对时间:< 1m 显示「刚刚」,< 60m 显示「N 分钟前」,< 24h 显示「N 小时前」,
 * < 30d 显示「N 天前」,更早回退到 fmtCompact。最近活动场景用,如「最近更新 3 分钟前」。
 */
export function fmtRelative(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  const d = typeof val === 'number' ? new Date(val) : new Date(String(val))
  if (isNaN(d.getTime())) return String(val)
  const diff = Date.now() - d.getTime()
  if (diff < 0) return fmtCompact(val) // 未来时间不走相对
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  return fmtCompact(val)
}

/**
 * 时长(毫秒)→ 人读字符串。
 *  < 1s → `123ms`
 *  < 60s → `45s`
 *  < 60m → `12m 30s`
 *  ≥ 1h → `2h 15m`
 */
export function fmtDuration(ms: unknown): string {
  if (ms === null || ms === undefined || ms === '') return '—'
  const n = typeof ms === 'number' ? ms : Number(ms)
  if (!isFinite(n) || n < 0) return '—'
  if (n < 1000) return `${Math.round(n)}ms`
  const sec = Math.floor(n / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  if (min < 60) return remSec ? `${min}m ${remSec}s` : `${min}m`
  const hr = Math.floor(min / 60)
  const remMin = min % 60
  return remMin ? `${hr}h ${remMin}m` : `${hr}h`
}
