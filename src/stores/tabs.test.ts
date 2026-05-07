import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useTabsStore, PAGE_TABS_MAX_TOTAL, PAGE_TABS_MAX_VISIBLE } from './tabs'

function mkRoute(path: string, title = path, fullPath = path): RouteLocationNormalizedLoaded {
  return {
    path,
    fullPath,
    name: path,
    meta: { title },
    query: {},
    params: {},
    hash: '',
    matched: [],
    redirectedFrom: undefined,
  } as unknown as RouteLocationNormalizedLoaded
}

describe('useTabsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('addFromRoute', () => {
    it('adds a new tab for a fresh route', () => {
      const tabs = useTabsStore()
      tabs.addFromRoute(mkRoute('/ops/summary', '运维概览'))
      expect(tabs.list).toHaveLength(1)
      expect(tabs.list[0].key).toBe('/ops/summary')
      expect(tabs.list[0].title).toBe('运维概览')
    })

    it('skips the login route', () => {
      const tabs = useTabsStore()
      tabs.addFromRoute(mkRoute('/login', '登录'))
      expect(tabs.list).toHaveLength(0)
    })

    it('updates existing tab path and timestamp instead of duplicating', () => {
      const tabs = useTabsStore()
      tabs.addFromRoute(mkRoute('/job/list', 'Jobs', '/job/list'))
      const first = tabs.list[0].lastAccessAt
      // Same key, different query — should not create a new tab
      tabs.addFromRoute(mkRoute('/job/list', 'Jobs', '/job/list?status=RUNNING'))
      expect(tabs.list).toHaveLength(1)
      expect(tabs.list[0].path).toBe('/job/list?status=RUNNING')
      expect(tabs.list[0].lastAccessAt).toBeGreaterThanOrEqual(first)
    })

    it('bubbles a revisited tab to the end of the list (MRU)', () => {
      const tabs = useTabsStore()
      ;['/a', '/b', '/c'].forEach((p) => tabs.addFromRoute(mkRoute(p)))
      // 重访 /a 应该把它移到最右(活跃 tab 永远在末尾)
      tabs.addFromRoute(mkRoute('/a'))
      expect(tabs.list.map((t) => t.key)).toEqual(['/b', '/c', '/a'])
    })

    it('caps total list to PAGE_TABS_MAX_TOTAL, evicting the leftmost', () => {
      const tabs = useTabsStore()
      for (let i = 0; i < PAGE_TABS_MAX_TOTAL + 3; i++) {
        tabs.addFromRoute(mkRoute(`/page-${i}`))
      }
      expect(tabs.list).toHaveLength(PAGE_TABS_MAX_TOTAL)
      // 最左 3 条(/page-0..2)应被淘汰,保留 /page-3 起
      expect(tabs.list[0].key).toBe('/page-3')
      expect(tabs.list[tabs.list.length - 1].key).toBe(`/page-${PAGE_TABS_MAX_TOTAL + 2}`)
    })
  })

  describe('removeByKey', () => {
    it('removes an existing tab and returns its index', () => {
      const tabs = useTabsStore()
      tabs.addFromRoute(mkRoute('/a'))
      tabs.addFromRoute(mkRoute('/b'))
      tabs.addFromRoute(mkRoute('/c'))
      expect(tabs.removeByKey('/b')).toBe(1)
      expect(tabs.list.map((t) => t.key)).toEqual(['/a', '/c'])
    })

    it('returns -1 for unknown key', () => {
      const tabs = useTabsStore()
      expect(tabs.removeByKey('/missing')).toBe(-1)
    })
  })

  describe('closeAllRightOf', () => {
    it('closes tabs to the right of refKey', () => {
      const tabs = useTabsStore()
      ;['/a', '/b', '/c', '/d'].forEach((p) => tabs.addFromRoute(mkRoute(p)))
      const result = tabs.closeAllRightOf('/a', '/b')
      expect(tabs.list.map((t) => t.key)).toEqual(['/a', '/b'])
      expect(result).toBeNull() // current /a is not among removed
    })

    it('returns refKey when current tab was closed', () => {
      const tabs = useTabsStore()
      ;['/a', '/b', '/c'].forEach((p) => tabs.addFromRoute(mkRoute(p)))
      // Current route is /c, refKey is /a → /c gets closed
      const result = tabs.closeAllRightOf('/c', '/a')
      expect(result).toBe('/a')
    })

    it('returns null when refKey has nothing to its right', () => {
      const tabs = useTabsStore()
      ;['/a', '/b'].forEach((p) => tabs.addFromRoute(mkRoute(p)))
      expect(tabs.closeAllRightOf('/b', '/b')).toBeNull()
    })
  })

  describe('closeAllLeftOf', () => {
    it('closes tabs to the left of refKey', () => {
      const tabs = useTabsStore()
      ;['/a', '/b', '/c'].forEach((p) => tabs.addFromRoute(mkRoute(p)))
      tabs.closeAllLeftOf('/c', '/b')
      expect(tabs.list.map((t) => t.key)).toEqual(['/b', '/c'])
    })

    it('returns refKey when current tab was closed', () => {
      const tabs = useTabsStore()
      ;['/a', '/b', '/c'].forEach((p) => tabs.addFromRoute(mkRoute(p)))
      const result = tabs.closeAllLeftOf('/a', '/c')
      expect(result).toBe('/c')
    })
  })

  describe('closeOthers', () => {
    it('keeps only the refKey tab', () => {
      const tabs = useTabsStore()
      ;['/a', '/b', '/c'].forEach((p) => tabs.addFromRoute(mkRoute(p)))
      tabs.closeOthers('/b', '/b')
      expect(tabs.list.map((t) => t.key)).toEqual(['/b'])
    })

    it('returns refKey when current tab was closed', () => {
      const tabs = useTabsStore()
      ;['/a', '/b', '/c'].forEach((p) => tabs.addFromRoute(mkRoute(p)))
      const result = tabs.closeOthers('/a', '/b')
      expect(result).toBe('/b')
    })
  })

  describe('visible / overflow split', () => {
    it('keeps the last PAGE_TABS_MAX_VISIBLE in visibleTabs', () => {
      const tabs = useTabsStore()
      for (let i = 0; i < PAGE_TABS_MAX_VISIBLE + 3; i++) {
        tabs.addFromRoute(mkRoute(`/page-${i}`))
      }
      expect(tabs.visibleTabs).toHaveLength(PAGE_TABS_MAX_VISIBLE)
      expect(tabs.overflowTabs).toHaveLength(3)
      expect(tabs.overflowTabs.map((t) => t.key)).toEqual(['/page-0', '/page-1', '/page-2'])
    })
  })

  describe('clear', () => {
    it('empties the list', () => {
      const tabs = useTabsStore()
      tabs.addFromRoute(mkRoute('/a'))
      tabs.clear()
      expect(tabs.list).toHaveLength(0)
    })
  })
})
