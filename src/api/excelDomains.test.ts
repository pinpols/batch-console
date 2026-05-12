import { describe, it, expect } from 'vitest'
import { excelPaths, EXCEL_TEMPLATE_EXPORT_DOMAINS, type ExcelDomain } from './excelDomains'

const allDomains: ExcelDomain[] = [
  'file-templates',
  'file-channels',
  'workflows',
  'job-definitions',
  'alert-routings',
  'batch-windows',
  'business-calendars',
  'pipeline-definitions',
  'quota-policies',
  'resource-queues',
]

describe('excel template/export domains', () => {
  it('covers all 10 config domains', () => {
    expect([...EXCEL_TEMPLATE_EXPORT_DOMAINS].sort()).toEqual([...allDomains].sort())
  })
})

describe('excelPaths', () => {
  it.each(allDomains)('returns only template/export paths for domain "%s"', (domain) => {
    const p = excelPaths(domain)
    expect(Object.keys(p).sort()).toEqual(['export', 'template'])
  })

  it.each(allDomains)('paths for "%s" contain the domain name', (domain) => {
    const p = excelPaths(domain)
    for (const value of Object.values(p)) {
      expect(value).toContain(`/api/console/config/${domain}/excel/`)
    }
  })

  it.each(allDomains)('paths for "%s" start with /api/console/', (domain) => {
    const p = excelPaths(domain)
    for (const value of Object.values(p)) {
      expect(value).toMatch(/^\/api\/console\//)
    }
  })

  it('returns distinct paths for different domains', () => {
    const a = excelPaths('file-templates')
    const b = excelPaths('file-channels')
    expect(a.template).not.toBe(b.template)
    expect(a.export).not.toBe(b.export)
  })
})
