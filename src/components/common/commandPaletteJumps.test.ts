import { describe, expect, it } from 'vitest'
import { parseCommandPaletteJump } from './commandPaletteJumps'

describe('parseCommandPaletteJump', () => {
  it('keeps numeric input as a job instance shortcut', () => {
    expect(parseCommandPaletteJump('30296')).toEqual({
      kind: 'job',
      value: '30296',
      path: '/monitor/job-instances/30296',
    })
  })

  it('supports explicit file and trace prefixes', () => {
    expect(parseCommandPaletteJump('file: 42')?.path).toBe('/files/list?fileId=42')
    expect(parseCommandPaletteJump('trace: req-20260927')?.path).toBe(
      '/observability/trace?traceId=req-20260927',
    )
  })

  it('rejects malformed direct jumps', () => {
    expect(parseCommandPaletteJump('job:abc')).toBeNull()
    expect(parseCommandPaletteJump('file:')).toBeNull()
  })
})
