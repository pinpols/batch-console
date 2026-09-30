import { describe, expect, it } from 'vitest'
import { aiPageLabelKey, aiPageType } from './aiPageContext'

describe('aiPageType', () => {
  it('allows only reviewed route names', () => {
    expect(aiPageType('job-instance-detail')).toBe('job-instance')
    expect(aiPageType('m-job-detail')).toBe('job-instance')
    expect(aiPageType('m-ops-summary')).toBe('ops-summary')
    expect(aiPageType('m-workflow-viewer')).toBe('workflow-definition')
    expect(aiPageType('observability-trace')).toBe('trace')
    expect(aiPageType('m-files')).toBeUndefined()
    expect(aiPageType('system-parameters')).toBeUndefined()
    expect(aiPageType(null)).toBeUndefined()
  })
})

describe('aiPageLabelKey', () => {
  it('uses a localized page label without changing the request code', () => {
    expect(aiPageLabelKey(aiPageType('m-ops-summary'))).toBe('page.opsSummary.title')
    expect(aiPageLabelKey(aiPageType('m-files'))).toBeUndefined()
  })
})
