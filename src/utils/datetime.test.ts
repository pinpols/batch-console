import { describe, it, expect } from 'vitest'
import { fmtDatetime, fmtDate } from './datetime'

describe('fmtDatetime', () => {
  it('formats ISO string to local datetime', () => {
    // Use a fixed offset-0 string; result is local time
    const result = fmtDatetime('2026-04-12T05:12:18.905Z')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('returns — for null', () => expect(fmtDatetime(null)).toBe('—'))
  it('returns — for undefined', () => expect(fmtDatetime(undefined)).toBe('—'))
  it('returns — for empty string', () => expect(fmtDatetime('')).toBe('—'))
  it('returns — for empty string (typed)', () => expect(fmtDatetime('')).toBe('—'))

  it('handles epoch ms number', () => {
    const result = fmtDatetime(0)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('returns raw string for invalid date', () => {
    expect(fmtDatetime('not-a-date')).toBe('not-a-date')
  })
})

describe('fmtDate', () => {
  it('formats ISO string to date only', () => {
    const result = fmtDate('2026-04-12T05:12:18.905Z')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns — for null', () => expect(fmtDate(null)).toBe('—'))
  it('returns — for undefined', () => expect(fmtDate(undefined)).toBe('—'))
})
