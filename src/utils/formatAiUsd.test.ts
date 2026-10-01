import { describe, expect, it } from 'vitest'
import { formatAiUsd } from './formatAiUsd'

describe('formatAiUsd', () => {
  it('keeps meaningful precision for sub-cent model usage', () => {
    expect(formatAiUsd(0.001569)).toBe('0.001569')
    expect(formatAiUsd(0.0001)).toBe('0.0001')
    expect(formatAiUsd(0.0000004)).toBe('<0.000001')
  })

  it('uses cents for zero and ordinary amounts', () => {
    expect(formatAiUsd(0)).toBe('0.00')
    expect(formatAiUsd(20)).toBe('20.00')
  })
})
