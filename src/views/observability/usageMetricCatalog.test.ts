import { describe, expect, it } from 'vitest'
import { usageMetricCodes, usageMetricLabel } from './usageMetricCatalog'

describe('usageMetricLabel', () => {
  it('separates stable metric codes from localized labels', () => {
    const label = usageMetricLabel('operation.jobdefinition.create', (key) => `<${key}>`)

    expect(label).toBe(
      '<usageSummary.metricDomains.jobDefinition> / <usageSummary.metricActions.create>',
    )
    expect(usageMetricCodes).toContain('operation.workflowrun.skipnode')
  })

  it('keeps unknown backend codes visible', () => {
    expect(usageMetricLabel('operation.future.action', (key) => key)).toBe(
      'operation.future.action',
    )
  })
})
