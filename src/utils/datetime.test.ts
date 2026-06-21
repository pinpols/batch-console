import { afterEach, describe, it, expect, vi } from 'vitest'
import { fmtCompact, fmtDatetime, fmtDate, fmtRelative } from './datetime'
import { setI18nLocale } from '@/locales'

afterEach(() => {
  vi.useRealTimers()
  setI18nLocale('zh-CN')
})

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

describe('fmtCompact', () => {
  it('uses zh-CN labels for today and yesterday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T08:00:00+08:00'))

    expect(fmtCompact('2026-06-21T07:30:00+08:00')).toBe('今天 07:30')
    expect(fmtCompact('2026-06-20T09:15:00+08:00')).toBe('昨天 09:15')
  })

  it('uses en-US labels when locale changes', () => {
    vi.useFakeTimers()
    setI18nLocale('en-US')
    vi.setSystemTime(new Date('2026-06-21T08:00:00+08:00'))

    expect(fmtCompact('2026-06-21T07:30:00+08:00')).toBe('Today 07:30')
    expect(fmtCompact('2026-06-20T09:15:00+08:00')).toBe('Yesterday 09:15')
  })
})

describe('fmtRelative', () => {
  it('uses zh-CN relative labels', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T08:00:00+08:00'))

    expect(fmtRelative('2026-06-21T07:59:30+08:00')).toBe('刚刚')
    expect(fmtRelative('2026-06-21T07:55:00+08:00')).toBe('5 分钟前')
  })

  it('uses en-US relative labels when locale changes', () => {
    vi.useFakeTimers()
    setI18nLocale('en-US')
    vi.setSystemTime(new Date('2026-06-21T08:00:00+08:00'))

    expect(fmtRelative('2026-06-21T07:59:30+08:00')).toBe('Just now')
    expect(fmtRelative('2026-06-21T07:55:00+08:00')).toBe('5 minutes ago')
  })
})
