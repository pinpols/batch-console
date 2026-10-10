import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DISPLAY_TIMEZONE_STORAGE_KEY,
  displayTimezone,
  getDisplayTimezoneOptions,
  getTimezoneOffsetLabel,
  writeDisplayTimezone,
} from './timezone'
import { stubLocalStorage } from '@/test-utils/localStorage'

const storage = stubLocalStorage()
const initialTimezone = displayTimezone.value

beforeEach(() => storage.clear())

afterEach(() => {
  displayTimezone.value = initialTimezone
  storage.clear()
})

describe('writeDisplayTimezone', () => {
  it('updates reactive state and persists the normalized timezone', () => {
    writeDisplayTimezone('  America/New_York  ')

    expect(displayTimezone.value).toBe('America/New_York')
    expect(storage.get(DISPLAY_TIMEZONE_STORAGE_KEY)).toBe('America/New_York')
  })

  it('rejects invalid IANA timezones without changing the preference', () => {
    const before = displayTimezone.value

    expect(() => writeDisplayTimezone('Mars/Olympus')).toThrow('Invalid IANA timezone')
    expect(displayTimezone.value).toBe(before)
    expect(storage.has(DISPLAY_TIMEZONE_STORAGE_KEY)).toBe(false)
  })
})

describe('timezone display helpers', () => {
  it('keeps an automatically detected timezone selectable', () => {
    const options = getDisplayTimezoneOptions('Europe/Berlin')
    expect(options[0]).toBe('Europe/Berlin')
    expect(options).toContain('Asia/Shanghai')
    expect(new Set(options).size).toBe(options.length)
  })

  it('shows a stable UTC offset for a valid timezone', () => {
    expect(getTimezoneOffsetLabel('UTC', new Date('2026-01-01T00:00:00Z'))).toBe('UTC')
    expect(getTimezoneOffsetLabel('Asia/Shanghai', new Date('2026-01-01T00:00:00Z'))).toBe('UTC+8')
  })
})
