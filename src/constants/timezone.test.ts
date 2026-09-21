import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DISPLAY_TIMEZONE_STORAGE_KEY, displayTimezone, writeDisplayTimezone } from './timezone'

const storage = new Map<string, string>()
const initialTimezone = displayTimezone.value

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
})

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
