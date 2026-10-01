import { ref } from 'vue'

export const DISPLAY_TIMEZONE_STORAGE_KEY = 'batch-console:display-timezone'

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
    const stored = globalThis.localStorage?.getItem?.(DISPLAY_TIMEZONE_STORAGE_KEY)?.trim()
    if (stored && isValidTimezone(stored)) return stored
  } catch {
    // 隐私浏览或测试环境中 Storage 可能不可用。
  }

  const configured = import.meta.env.VITE_DISPLAY_TIMEZONE?.trim()
  if (configured && isValidTimezone(configured)) return configured
  return detectBrowserTimezone()
}

export const displayTimezone = ref(resolveInitialTimezone())

export function readDisplayTimezone(): string {
  return displayTimezone.value
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
