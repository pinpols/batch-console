// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { loadScript, __resetLoadScriptCache } from './loadScript'

function fireOn(src: string, event: 'load' | 'error') {
  const el = document.head.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
  el?.dispatchEvent(new Event(event))
}

describe('loadScript', () => {
  beforeEach(() => {
    __resetLoadScriptCache()
    document.head.querySelectorAll('script').forEach((s) => s.remove())
  })

  it('resolves when the script fires load', async () => {
    const p = loadScript('https://example.com/a.js')
    fireOn('https://example.com/a.js', 'load')
    await expect(p).resolves.toBeUndefined()
  })

  it('rejects when the script fires error', async () => {
    const p = loadScript('https://example.com/b.js')
    fireOn('https://example.com/b.js', 'error')
    await expect(p).rejects.toThrow(/Failed to load script/)
  })

  it('inserts the script only once for concurrent calls', async () => {
    const p1 = loadScript('https://example.com/c.js')
    const p2 = loadScript('https://example.com/c.js')
    expect(p1).toBe(p2)
    expect(document.head.querySelectorAll('script[src="https://example.com/c.js"]').length).toBe(1)
    fireOn('https://example.com/c.js', 'load')
    await Promise.all([p1, p2])
  })

  it('allows retry after a failure (cache evicted on error)', async () => {
    const p1 = loadScript('https://example.com/d.js')
    fireOn('https://example.com/d.js', 'error')
    await expect(p1).rejects.toThrow()
    document.head.querySelectorAll('script').forEach((s) => s.remove())
    const p2 = loadScript('https://example.com/d.js')
    expect(document.head.querySelectorAll('script[src="https://example.com/d.js"]').length).toBe(1)
    fireOn('https://example.com/d.js', 'load')
    await expect(p2).resolves.toBeUndefined()
  })
})
