import { describe, it, expect } from 'vitest'
import { uniqueFieldValues } from './queryFormOptions'

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
    expect(uniqueFieldValues(data, (r) => r.v)).toEqual(['hello'])
  })
})
