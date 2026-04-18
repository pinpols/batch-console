import { describe, it, expect } from 'vitest'
import {
  excelPaths,
  supportsPreviewWorkbook,
  EXCEL_DOMAINS_WITH_WORKBOOK_PREVIEW,
  STANDALONE_DOMAINS,
  MERGED_DOMAINS,
  type ExcelDomain,
} from './excelDomains'

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

describe('domain split', () => {
  it('STANDALONE_DOMAINS has exactly 5 entries', () => {
    expect(STANDALONE_DOMAINS).toHaveLength(5)
  })

  it('MERGED_DOMAINS has exactly 5 entries', () => {
    expect(MERGED_DOMAINS).toHaveLength(5)
  })

  it('STANDALONE and MERGED together cover all 10 domains', () => {
    const all = [...STANDALONE_DOMAINS, ...MERGED_DOMAINS].sort()
    expect(all).toEqual([...allDomains].sort())
  })

  it('STANDALONE_DOMAINS contains the expected single-sheet domains', () => {
    expect(STANDALONE_DOMAINS).toContain('file-templates')
    expect(STANDALONE_DOMAINS).toContain('batch-windows')
    expect(STANDALONE_DOMAINS).toContain('business-calendars')
    expect(STANDALONE_DOMAINS).toContain('quota-policies')
    expect(STANDALONE_DOMAINS).toContain('resource-queues')
  })

  it('MERGED_DOMAINS contains the expected 8-Sheet tenant-package domains', () => {
    expect(MERGED_DOMAINS).toContain('file-channels')
    expect(MERGED_DOMAINS).toContain('workflows')
    expect(MERGED_DOMAINS).toContain('job-definitions')
    expect(MERGED_DOMAINS).toContain('alert-routings')
    expect(MERGED_DOMAINS).toContain('pipeline-definitions')
  })
})

describe('excelPaths', () => {
  it.each(allDomains)('returns all 5 path keys for domain "%s"', (domain) => {
    const p = excelPaths(domain)
    expect(p).toHaveProperty('template')
    expect(p).toHaveProperty('export')
    expect(p).toHaveProperty('upload')
    expect(p).toHaveProperty('preview')
    expect(p).toHaveProperty('apply')
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
    expect(a.upload).not.toBe(b.upload)
  })
})

describe('supportsPreviewWorkbook', () => {
  it('returns true for all 10 domains that expose the annotated workbook download', () => {
    for (const domain of EXCEL_DOMAINS_WITH_WORKBOOK_PREVIEW) {
      expect(supportsPreviewWorkbook(domain)).toBe(true)
    }
  })

  it('covers exactly 10 domains', () => {
    expect(EXCEL_DOMAINS_WITH_WORKBOOK_PREVIEW).toHaveLength(10)
  })
})
