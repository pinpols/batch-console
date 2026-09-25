import { describe, expect, it } from 'vitest'
import { filterCatalogRows, hasCatalogSchema, parseCatalogSchema } from './eventCatalogPresentation'

describe('eventCatalogPresentation', () => {
  it('filters across the visible catalog row fields', () => {
    const rows = [
      { eventType: 'JOB_DONE', category: 'job' },
      { eventType: 'FILE_READY', category: 'file' },
    ]
    expect(filterCatalogRows(rows, 'ready')).toEqual([rows[1]])
    expect(filterCatalogRows(rows, ' JOB ')).toEqual([rows[0]])
  })

  it('parses JSON schemas and preserves non-JSON schema references', () => {
    expect(parseCatalogSchema('{"type":"object"}')).toEqual({ type: 'object' })
    expect(parseCatalogSchema('schema://job-done')).toBe('schema://job-done')
    expect(parseCatalogSchema('—')).toEqual({})
  })

  it('distinguishes missing schemas from registered objects and references', () => {
    expect(hasCatalogSchema(undefined)).toBe(false)
    expect(hasCatalogSchema('{}')).toBe(false)
    expect(hasCatalogSchema('—')).toBe(false)
    expect(hasCatalogSchema('{"type":"object"}')).toBe(true)
    expect(hasCatalogSchema('schema://job-done')).toBe(true)
  })
})
