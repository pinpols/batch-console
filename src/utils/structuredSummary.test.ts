import { describe, expect, it } from 'vitest'
import { structuredSummary } from './structuredSummary'

describe('structuredSummary', () => {
  it('prioritizes operational fields and omits nested payloads', () => {
    const result = structuredSummary(
      '{"detail":{"secret":"hidden"},"status":"FAILED","jobCode":"DAILY_IMPORT","reason":"timeout"}',
    )

    expect(result).toBe('jobCode=DAILY_IMPORT · status=FAILED · reason=timeout')
  })

  it('decodes HTML entities before parsing', () => {
    expect(
      structuredSummary('{&quot;fileId&quot;:9007199254740993,&quot;status&quot;:&quot;OK&quot;}'),
    ).toBe('fileId=9007199254740993 · status=OK')
  })

  it('truncates plain text summaries', () => {
    expect(structuredSummary('x'.repeat(30), 12)).toBe('xxxxxxxxxxx…')
  })
})
