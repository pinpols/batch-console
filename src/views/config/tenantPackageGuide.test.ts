import { describe, expect, it } from 'vitest'
import { guideMatchesScenario } from './tenantPackageGuide'

describe('tenant package guide scenario filtering', () => {
  it('matches a file-format scenario to its worker category', () => {
    expect(guideMatchesScenario(['IMPORT / EXPORT'], 'IMPORT_EXCEL')).toBe(true)
    expect(guideMatchesScenario(['IMPORT.RECEIVE'], 'IMPORT_FIXED_WIDTH')).toBe(true)
    expect(guideMatchesScenario(['EXPORT only'], 'IMPORT_JSON')).toBe(false)
    expect(guideMatchesScenario(['EXPORT only'], 'EXPORT_EXCEL')).toBe(true)
  })

  it('matches general worker scopes and the all-scenarios scope', () => {
    expect(guideMatchesScenario(['WORKFLOW'], 'WORKFLOW')).toBe(true)
    expect(guideMatchesScenario(['ALL（任意 Job 引用时必填）'], 'SCHEDULE')).toBe(true)
    expect(guideMatchesScenario(['PROCESS'], 'DISPATCH')).toBe(false)
    expect(guideMatchesScenario(['anything'], 'ALL')).toBe(true)
  })
})
