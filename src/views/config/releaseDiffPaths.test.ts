import { describe, expect, it } from 'vitest'
import { releaseDiffPaths } from './releaseDiffPaths'

describe('release diff paths', () => {
  it('finds nested changes and missing fields without copying their values', () => {
    const result = releaseDiffPaths({ db: { password: 'old', port: 10 }, items: [1, 2] }, { db: { password: 'new', port: 10 }, items: [1, 3], enabled: false })
    expect(result.paths).toEqual(['$["db"]["password"]', '$["enabled"]', '$["items"][1]'])
    expect(JSON.stringify(result)).not.toContain('old')
    expect(JSON.stringify(result)).not.toContain('new')
    expect(result.truncated).toBe(false)
  })

  it('bounds large change lists and distinguishes null from missing', () => {
    const result = releaseDiffPaths({ a: null, b: 1 }, { b: 2, c: null }, 2)
    expect(result.paths).toEqual(['$["a"]', '$["b"]'])
    expect(result.truncated).toBe(true)
  })
})
