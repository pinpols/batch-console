import { describe, it, expect } from 'vitest'
import {
  buildResourceCode,
  buildVersionSuffix,
  findSimilarCodes,
  normalizeBiz,
  validateBiz,
} from './resourceCodeBuilder'

describe('normalizeBiz', () => {
  it('uppercases lower', () => {
    expect(normalizeBiz('daily_report')).toBe('DAILY_REPORT')
  })

  it('replaces non [A-Z0-9_] with underscore', () => {
    expect(normalizeBiz('daily-report')).toBe('DAILY_REPORT')
    expect(normalizeBiz('daily report')).toBe('DAILY_REPORT')
    expect(normalizeBiz('da/ily!rpt')).toBe('DA_ILY_RPT')
  })

  it('keeps digits + underscores', () => {
    expect(normalizeBiz('rep_2025_q1')).toBe('REP_2025_Q1')
  })
})

describe('validateBiz', () => {
  it('empty → EMPTY', () => {
    expect(validateBiz('')).toEqual({ ok: false, violation: 'EMPTY' })
  })

  it('< 3 chars → LENGTH', () => {
    expect(validateBiz('AB')).toEqual({ ok: false, violation: 'LENGTH' })
  })

  it('> 30 chars → LENGTH', () => {
    expect(validateBiz('A'.repeat(31))).toEqual({ ok: false, violation: 'LENGTH' })
  })

  it('valid normalized biz passes', () => {
    expect(validateBiz('DAILY_REPORT')).toEqual({ ok: true })
    expect(validateBiz('REP_2025_Q1')).toEqual({ ok: true })
  })

  it('digit-leading rejected (BIZ_FORMAT requires letter first)', () => {
    expect(validateBiz('2REPORT')).toEqual({ ok: false, violation: 'FORMAT' })
  })

  it('exact 30 chars boundary OK', () => {
    expect(validateBiz('A'.repeat(30))).toEqual({ ok: true })
  })
})

describe('buildVersionSuffix', () => {
  it('empty / whitespace → ""', () => {
    expect(buildVersionSuffix('')).toBe('')
    expect(buildVersionSuffix('   ')).toBe('')
  })

  it('accepts v-prefixed', () => {
    expect(buildVersionSuffix('v2')).toBe('_v2')
    expect(buildVersionSuffix('V3')).toBe('_v3')
  })

  it('accepts bare digits', () => {
    expect(buildVersionSuffix('5')).toBe('_v5')
    expect(buildVersionSuffix('10')).toBe('_v10')
  })

  it('rejects non-numeric tail', () => {
    expect(buildVersionSuffix('beta')).toBe('')
    expect(buildVersionSuffix('v1.0')).toBe('')
    expect(buildVersionSuffix('vX')).toBe('')
  })
})

describe('buildResourceCode', () => {
  it('returns "" when biz empty', () => {
    expect(buildResourceCode('JOB', '', 'v1')).toBe('')
  })

  it('builds without version', () => {
    expect(buildResourceCode('JOB', 'DAILY_REPORT')).toBe('JOB_DAILY_REPORT')
  })

  it('builds with version', () => {
    expect(buildResourceCode('JOB', 'DAILY_REPORT', 'v2')).toBe('JOB_DAILY_REPORT_v2')
  })

  it('normalizes biz input on the fly', () => {
    expect(buildResourceCode('WORKFLOW', 'daily-report', '3')).toBe('WORKFLOW_DAILY_REPORT_v3')
  })

  it('drops bad version silently', () => {
    expect(buildResourceCode('TEMPLATE', 'FOO', 'wat')).toBe('TEMPLATE_FOO')
  })
})

describe('findSimilarCodes', () => {
  it('empty existing → empty', () => {
    expect(findSimilarCodes('JOB', 'JOB_X', [])).toEqual([])
  })

  it('filters by domain prefix, excludes self', () => {
    const existing = ['JOB_A', 'JOB_B', 'JOB_X', 'WORKFLOW_A']
    expect(findSimilarCodes('JOB', 'JOB_X', existing)).toEqual(['JOB_A', 'JOB_B'])
  })

  it('returns all if final not in existing', () => {
    const existing = ['JOB_A', 'JOB_B']
    expect(findSimilarCodes('JOB', 'JOB_NEW', existing)).toEqual(['JOB_A', 'JOB_B'])
  })
})
