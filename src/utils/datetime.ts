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
