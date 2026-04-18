import { describe, it, expect } from 'vitest'
import {
  optionsFromStatusMap,
  uniqueFieldValues,
  outboxStatusSelectLabel,
} from './queryFormOptions'
import type { StatusMeta } from '@/constants/status'

describe('optionsFromStatusMap', () => {
  const map: Record<string, StatusMeta> = {
    PENDING: { label: '待处理', type: 'warning' },
    SUCCESS: { label: '成功', type: 'success' },
  }

  it('converts status map to label·value options', () => {
    const opts = optionsFromStatusMap(map)
    expect(opts).toEqual([
      { value: 'PENDING', label: '待处理 · PENDING' },
      { value: 'SUCCESS', label: '成功 · SUCCESS' },
    ])
  })

  it('returns empty array for empty map', () => {
    expect(optionsFromStatusMap({})).toEqual([])
  })
})

describe('uniqueFieldValues', () => {
  const rows = [
    { status: 'A' },
    { status: 'B' },
    { status: 'A' },
    { status: null },
    { status: '  ' },
    { status: 'C' },
  ]

  it('returns sorted unique non-empty values', () => {
    expect(uniqueFieldValues(rows, (r) => r.status)).toEqual(['A', 'B', 'C'])
  })

  it('returns empty array for empty input', () => {
    expect(uniqueFieldValues([], (r: unknown) => String(r))).toEqual([])
  })

  it('filters out undefined picks', () => {
    const data = [{ x: 1 }, { x: 2 }]
    expect(uniqueFieldValues(data, () => undefined)).toEqual([])
  })

  it('trims whitespace values to empty and excludes them', () => {
    const data = [{ v: '  hello  ' }, { v: '   ' }]
    // '   ' trims to '' → excluded; '  hello  ' trims to 'hello' → kept
    expect(uniqueFieldValues(data, (r) => r.v)).toEqual(['hello'])
  })
})

describe('outboxStatusSelectLabel', () => {
  it('returns Chinese label with code for known status', () => {
    expect(outboxStatusSelectLabel('PENDING')).toBe('待处理 · PENDING')
  })

  it('returns raw code for unknown status', () => {
    expect(outboxStatusSelectLabel('UNKNOWN_XYZ')).toBe('UNKNOWN_XYZ')
  })
})
