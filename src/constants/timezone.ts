import { ref } from 'vue'

import { STORAGE_KEYS } from './storageKeys'

export const DISPLAY_TIMEZONE_STORAGE_KEY = STORAGE_KEYS.displayTimezone

export const DISPLAY_TIMEZONE_OPTIONS = [
  'Asia/Shanghai',
  'UTC',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
] as const

const FALLBACK_TIMEZONE = 'UTC'

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export function detectBrowserTimezone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (timezone && isValidTimezone(timezone)) return timezone
  } catch {
    // 解析失败时继续使用稳定的 UTC 回退值。
  }
  return FALLBACK_TIMEZONE
}

function resolveInitialTimezone(): string {
  try {
    const storedTimezone = globalThis.localStorage?.getItem?.(DISPLAY_TIMEZONE_STORAGE_KEY)
    const stored = storedTimezone?.trim()
    if (stored && isValidTimezone(stored)) return stored
  } catch {
    // 隐私浏览或测试环境中 Storage 可能不可用。
  }

  const configuredTimezone = import.meta.env.VITE_DISPLAY_TIMEZONE
  const configured = configuredTimezone?.trim()
  if (configured && isValidTimezone(configured)) return configured
  return detectBrowserTimezone()
}

export const displayTimezone = ref(resolveInitialTimezone())

export function readDisplayTimezone(): string {
  return displayTimezone.value
}

/**
 * 保留一组常用时区，同时把当前自动检测/已保存的合法时区放进列表，避免当前值无法再次选择。
 */
export function getDisplayTimezoneOptions(current: string = displayTimezone.value): string[] {
  const uniqueTimezones = new Set([current, ...DISPLAY_TIMEZONE_OPTIONS])
  const timezoneOptions = Array.from(uniqueTimezones)
  return timezoneOptions.filter(Boolean)
}

/** 用用户本地化时区偏移辅助识别 IANA 名称，避免菜单里只有一串难读的标识。 */
export function getTimezoneOffsetLabel(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const formattedParts = formatter.formatToParts(date)
    const timezoneNamePart = formattedParts.find(({ type }) => type === 'timeZoneName')
    const part = timezoneNamePart?.value
    const shouldUseUtcFallback = !part || part === 'GMT' || part === 'GMT+0' || part === 'GMT-0'
    if (shouldUseUtcFallback) return 'UTC'
    return part.replace(/^GMT/, 'UTC')
  } catch {
    return 'UTC'
  }
}

export function writeDisplayTimezone(timezone: string): void {
  const normalized = timezone.trim()
  if (!normalized || !isValidTimezone(normalized)) {
    throw new Error(`Invalid IANA timezone: ${timezone}`)
  }
  try {
    globalThis.localStorage?.setItem?.(DISPLAY_TIMEZONE_STORAGE_KEY, normalized)
  } catch {
    // 未保存偏好不影响格式化，仍使用自动检测到的时区。
  }
  displayTimezone.value = normalized
}
