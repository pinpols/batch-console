import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  apiInstantToWallTime,
  businessCalendarDate,
  fmtClockTime,
  fmtCompact,
  fmtDatetime,
  fmtDate,
  fmtRelative,
  fmtTodayOrDatetime,
  presetDateRange,
  recentBusinessDateRange,
  todayBusinessDate,
  wallTimeToApiInstant,
} from './datetime'
import { setI18nLocale } from '@/locales'

afterEach(() => {
  vi.useRealTimers()
  setI18nLocale('zh-CN')
})

describe('fmtDatetime', () => {
  it('formats ISO string in the requested IANA timezone', () => {
    expect(fmtDatetime('2026-04-12T05:12:18.905Z', 'Asia/Shanghai')).toBe('2026-04-12 13:12:18')
    expect(fmtDatetime('2026-04-12T05:12:18.905Z', 'America/New_York')).toBe('2026-04-12 01:12:18')
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
    expect(fmtDate('2026-04-12T05:12:18.905Z', 'Asia/Shanghai')).toBe('2026-04-12')
    expect(fmtDate('2026-04-12')).toBe('2026-04-12')
  })

  it('returns — for null', () => expect(fmtDate(null)).toBe('—'))
  it('returns — for undefined', () => expect(fmtDate(undefined)).toBe('—'))
})

describe('wallTimeToApiInstant', () => {
  it('converts a selected wall time to an offset-aware API instant', () => {
    expect(wallTimeToApiInstant('2026-09-27 00:30:00', 'Asia/Shanghai')).toBe(
      '2026-09-26T16:30:00.000Z',
    )
    expect(apiInstantToWallTime('2026-09-26T16:30:00.000Z', 'Asia/Shanghai')).toBe(
      '2026-09-27 00:30:00',
    )
    expect(apiInstantToWallTime('2026-09-27 00:30:00', 'Asia/Shanghai')).toBe('2026-09-27 00:30:00')
  })

  it('rejects invalid calendar values and a nonexistent DST wall time', () => {
    expect(wallTimeToApiInstant('2026-02-30 12:00:00', 'Asia/Shanghai')).toBeNull()
    expect(wallTimeToApiInstant('2026-03-08 02:30:00', 'America/New_York')).toBeNull()
  })
})

describe('presetDateRange', () => {
  it('uses the requested timezone for timestamp boundaries', () => {
    expect(
      presetDateRange('today', 'datetimerange', 'Asia/Shanghai', new Date('2026-09-26T16:30:00Z')),
    ).toEqual(['2026-09-26T16:00:00.000Z', '2026-09-27T15:59:59.999999Z'])
  })

  it('uses a 23-hour instant window on a DST spring-forward day', () => {
    expect(
      presetDateRange(
        'today',
        'datetimerange',
        'America/New_York',
        new Date('2026-03-08T16:00:00Z'),
      ),
    ).toEqual(['2026-03-08T05:00:00.000Z', '2026-03-09T03:59:59.999999Z'])
  })

  it('keeps business dates as dates, including at local midnight', () => {
    expect(todayBusinessDate(new Date('2026-09-26T16:30:00Z'))).toBe('2026-09-27')
    expect(recentBusinessDateRange(7, new Date('2026-09-26T16:30:00Z'))).toEqual([
      '2026-09-21',
      '2026-09-27',
    ])
    expect(
      presetDateRange('7d', 'daterange', 'Asia/Shanghai', new Date('2026-09-26T16:30:00Z')),
    ).toEqual(['2026-09-21', '2026-09-27'])
  })

  it('opens calendar controls on the platform business day', () => {
    const date = businessCalendarDate(new Date('2026-09-30T16:30:00Z'))
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 10, 1])
  })
})

describe('fmtClockTime', () => {
  it('formats the same instant in the requested display timezone', () => {
    expect(fmtClockTime('2026-09-26T16:30:00Z', 'Asia/Shanghai')).toBe('00:30:00')
    expect(fmtClockTime('2026-09-26T16:30:00Z', 'UTC', false)).toBe('16:30')
    expect(fmtClockTime('invalid', 'UTC')).toBe('—')
  })
})

describe('fmtTodayOrDatetime', () => {
  it('uses the display timezone to decide whether an instant is today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-26T16:30:00Z'))
    expect(fmtTodayOrDatetime('2026-09-26T16:10:00Z', 'Asia/Shanghai')).toBe('今天 00:10')
    expect(fmtTodayOrDatetime('2026-09-26T15:10:00Z', 'Asia/Shanghai')).toBe('2026-09-26 23:10:00')
  })
})

describe('fmtCompact', () => {
  it('uses zh-CN labels for today and yesterday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 21, 8, 0))

    expect(fmtCompact(new Date(2026, 5, 21, 7, 30).getTime())).toBe('今天 07:30')
    expect(fmtCompact(new Date(2026, 5, 20, 9, 15).getTime())).toBe('昨天 09:15')
  })

  it('uses en-US labels when locale changes', () => {
    vi.useFakeTimers()
    setI18nLocale('en-US')
    vi.setSystemTime(new Date(2026, 5, 21, 8, 0))

    expect(fmtCompact(new Date(2026, 5, 21, 7, 30).getTime())).toBe('Today 07:30')
    expect(fmtCompact(new Date(2026, 5, 20, 9, 15).getTime())).toBe('Yesterday 09:15')
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

    expect(fmtRelative('2026-06-21T07:59:30+08:00')).toBe('just now')
    expect(fmtRelative('2026-06-21T07:55:00+08:00')).toBe('5 min ago')
  })
})
