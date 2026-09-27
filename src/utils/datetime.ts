import { i18n } from '@/locales'
import { readDisplayTimezone } from '@/constants/timezone'
import dayjs, { type Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezonePlugin from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezonePlugin)

const WALL_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'
const WALL_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

type CalendarParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** 取相对/紧凑时间词条(util 非组件,走全局 i18n 实例)。 */
function dt(key: string, named?: Record<string, unknown>): string {
  return i18n.global.t(`common.datetime.${key}`, named ?? {})
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value as string | number)
  return Number.isNaN(date.getTime()) ? null : date
}

function safeTimezone(timezone?: string): string {
  if (timezone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format()
      return timezone
    } catch {
      // Invalid caller input must not break an operational page.
    }
  }
  return readDisplayTimezone()
}

function partsOf(date: Date, timezone?: string): CalendarParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dateText(parts: CalendarParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function datetimeText(parts: CalendarParts): string {
  return `${dateText(parts)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
}

function previousCalendarDate(parts: CalendarParts): CalendarParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - 1))
  return {
    ...parts,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

/**
 * 将后端 ISO-8601 时间字符串（或 number epoch ms）格式化为本地可读时间。
 * 输出示例：2026-04-12 13:12:18
 * 对 null / undefined / 空字符串返回 '—'。
 */
export function fmtDatetime(val: unknown, timezone?: string): string {
  const date = parseDate(val)
  if (!date) return val === null || val === undefined || val === '' ? '—' : String(val)
  return datetimeText(partsOf(date, timezone))
}

/** 日期选择器的墙上时间转为 API Instant；不存在的夏令时时刻会被拒绝。 */
export function wallTimeToApiInstant(value: string, zone = readDisplayTimezone()): string | null {
  if (!WALL_TIME_PATTERN.test(value)) return null
  const parsed = dayjs.tz(value, zone)
  return parsed.isValid() && parsed.format(WALL_TIME_FORMAT) === value ? parsed.toISOString() : null
}

/** 后端 Instant 转日期选择器的墙上时间；兼容旧版已保存的无时区筛选值。 */
export function apiInstantToWallTime(value: string, zone = readDisplayTimezone()): string {
  if (WALL_TIME_PATTERN.test(value)) return value
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.tz(zone).format(WALL_TIME_FORMAT) : ''
}

export function readBusinessTimezone(): string {
  const configured = import.meta.env.VITE_DISPLAY_TIMEZONE?.trim()
  if (configured) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: configured }).format()
      return configured
    } catch {
      // Keep business-date defaults independent of the user's display preference.
    }
  }
  return 'Asia/Shanghai'
}

/** 业务日期使用部署配置的时区，不受个人展示时区切换影响。 */
export function todayBusinessDate(now: Date = new Date()): string {
  return fmtDate(now, readBusinessTimezone())
}

/** 将平台业务日映射为日历控件的本地日期模型，不把 LocalDate 当作 Instant 解析。 */
export function businessCalendarDate(now: Date = new Date()): Date {
  const [year, month, day] = todayBusinessDate(now).split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

/** 近 N 个业务日（包含今天），用于 LocalDate 筛选而非 Instant 时间窗口。 */
export function recentBusinessDateRange(days = 7, now: Date = new Date()): [string, string] {
  const today = dayjs(now).tz(readBusinessTimezone())
  const count = Math.max(1, Math.floor(days))
  return [today.subtract(count - 1, 'day').format('YYYY-MM-DD'), today.format('YYYY-MM-DD')]
}

/** 保持包含式结束边界，并对齐 PostgreSQL 时间戳的微秒精度。 */
function inclusiveEndOfDayInstant(day: Dayjs): string {
  const lastMillisecond = day.add(1, 'day').startOf('day').subtract(1, 'millisecond').toISOString()
  return lastMillisecond.replace(/\.999Z$/, '.999999Z')
}

export function presetDateRange(
  key: 'today' | '7d' | '30d' | 'thisMonth',
  type: 'daterange' | 'datetimerange',
  zone: string,
  now: Date = new Date(),
): [string, string] {
  const today = dayjs(now).tz(zone)
  const start =
    key === 'thisMonth'
      ? today.startOf('month')
      : today.subtract(key === '30d' ? 29 : key === '7d' ? 6 : 0, 'day').startOf('day')
  if (type === 'daterange') return [start.format('YYYY-MM-DD'), today.format('YYYY-MM-DD')]
  return [start.toISOString(), inclusiveEndOfDayInstant(today)]
}

/**
 * 仅格式化日期部分，输出示例：2026-04-12
 */
export function fmtDate(val: unknown, timezone?: string): string {
  if (val === null || val === undefined || val === '') return '—'
  const raw = String(val)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const date = parseDate(val)
  return date ? dateText(partsOf(date, timezone)) : raw
}

/** 仅显示当前展示时区的钟表时间；用于刷新状态等不需要重复日期的场景。 */
export function fmtClockTime(val: unknown, timezone?: string, includeSeconds = true): string {
  const date = parseDate(val)
  if (!date) return '—'
  const parts = partsOf(date, timezone)
  const hm = `${pad(parts.hour)}:${pad(parts.minute)}`
  return includeSeconds ? `${hm}:${pad(parts.second)}` : hm
}

/** 今天显示紧凑时间，历史时间显示完整日期。 */
export function fmtTodayOrDatetime(val: unknown, timezone?: string): string {
  const date = parseDate(val)
  if (!date) return fmtDatetime(val, timezone)
  const zone = safeTimezone(timezone)
  return fmtDate(date, zone) === fmtDate(new Date(), zone)
    ? fmtCompact(date, zone)
    : fmtDatetime(date, zone)
}

/**
 * 紧凑时间:今天/昨天显示本地化的「今天 14:47」「昨天 09:30」,本年内显示「5-17 14:47」,
 * 跨年显示完整 `YYYY-MM-DD HH:mm`。适合列表单元格,信息密度高且语义清晰。
 */
export function fmtCompact(val: unknown, timezone?: string): string {
  const date = parseDate(val)
  if (!date) return val === null || val === undefined || val === '' ? '—' : String(val)

  const displayParts = partsOf(date, timezone)
  const nowParts = partsOf(new Date(), timezone)
  const yesterday = previousCalendarDate(nowParts)
  const hm = `${pad(displayParts.hour)}:${pad(displayParts.minute)}`
  const sameDay = dateText(displayParts) === dateText(nowParts)
  const isYesterday = dateText(displayParts) === dateText(yesterday)

  if (sameDay) return `${dt('today')} ${hm}`
  if (isYesterday) return `${dt('yesterday')} ${hm}`
  if (displayParts.year === nowParts.year)
    return `${displayParts.month}-${pad(displayParts.day)} ${hm}`
  return `${dateText(displayParts)} ${hm}`
}

/**
 * 相对时间:< 1m 显示本地化的「刚刚」,< 60m 显示「N 分钟前」,< 24h 显示「N 小时前」,
 * < 30d 显示「N 天前」,更早回退到 fmtCompact。最近活动场景用。
 */
export function fmtRelative(val: unknown, timezone?: string): string {
  const date = parseDate(val)
  if (!date) return val === null || val === undefined || val === '' ? '—' : String(val)
  const diff = Date.now() - date.getTime()
  if (diff < 0) return fmtCompact(val, timezone) // 未来时间不走相对
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return dt('justNow')
  const min = Math.floor(sec / 60)
  if (min < 60) return dt('minutesAgo', { n: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return dt('hoursAgo', { n: hr })
  const day = Math.floor(hr / 24)
  if (day < 30) return dt('daysAgo', { n: day })
  return fmtCompact(val, timezone)
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
