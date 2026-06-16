import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
})

import { useSavedFilters } from './useSavedFilters'

interface DemoFilters extends Record<string, unknown> {
  status: string
  keyword: string
}

function setup(pageKey = 'demo', userId?: () => string | undefined) {
  const current = { status: '', keyword: '' } as DemoFilters
  const applied: DemoFilters[] = []
  const handle = useSavedFilters<DemoFilters>({
    pageKey,
    getCurrent: () => ({ ...current }),
    apply: (f) => {
      applied.push(f)
      Object.assign(current, f)
    },
    userId,
  })
  return { handle, current, applied }
}

describe('useSavedFilters', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('saves current filters as a named set and persists', () => {
    const { handle, current } = setup()
    current.status = 'FAILED'
    current.keyword = 'abc'
    const created = handle.save('我的失败筛选')
    expect(created).not.toBeNull()
    expect(handle.sets.value).toHaveLength(1)
    expect(handle.sets.value[0].name).toBe('我的失败筛选')
    expect(handle.sets.value[0].filters).toEqual({ status: 'FAILED', keyword: 'abc' })

    // 持久化:新建一个 handle 应读回
    const second = setup()
    expect(second.handle.sets.value).toHaveLength(1)
    expect(second.handle.sets.value[0].name).toBe('我的失败筛选')
  })

  it('save returns null for blank name', () => {
    const { handle } = setup()
    expect(handle.save('   ')).toBeNull()
    expect(handle.sets.value).toHaveLength(0)
  })

  it('same-name save overwrites instead of duplicating', () => {
    const { handle, current } = setup()
    current.status = 'A'
    handle.save('dup')
    current.status = 'B'
    handle.save('dup')
    expect(handle.sets.value).toHaveLength(1)
    expect(handle.sets.value[0].filters.status).toBe('B')
  })

  it('applySet writes filters back via apply()', () => {
    const { handle, current, applied } = setup()
    current.status = 'CANCELLED'
    const created = handle.save('c')!
    current.status = '' // user changed filters
    handle.applySet(created.id)
    expect(applied.at(-1)).toEqual({ status: 'CANCELLED', keyword: '' })
    expect(current.status).toBe('CANCELLED')
  })

  it('snapshot is decoupled — mutating current does not change saved set', () => {
    const { handle, current } = setup()
    current.status = 'X'
    handle.save('snap')
    current.status = 'MUTATED'
    expect(handle.sets.value[0].filters.status).toBe('X')
  })

  it('remove and rename', () => {
    const { handle, current } = setup()
    current.status = 'A'
    const a = handle.save('a')!
    current.status = 'B'
    handle.save('b')
    expect(handle.sets.value).toHaveLength(2)
    handle.rename(a.id, 'renamed')
    expect(handle.sets.value.find((s) => s.id === a.id)?.name).toBe('renamed')
    handle.remove(a.id)
    expect(handle.sets.value).toHaveLength(1)
    expect(handle.sets.value.find((s) => s.id === a.id)).toBeUndefined()
  })

  it('export / import round-trips', () => {
    const { handle, current } = setup('p1')
    current.status = 'A'
    handle.save('one')
    current.status = 'B'
    handle.save('two')
    const json = handle.exportSets()

    const fresh = setup('p2')
    const n = fresh.handle.importSets(json)
    expect(n).toBe(2)
    expect(fresh.handle.sets.value).toHaveLength(2)
    expect(fresh.handle.sets.value.map((s) => s.name).sort()).toEqual(['one', 'two'])
  })

  it('importSets ignores malformed json', () => {
    const { handle } = setup()
    expect(handle.importSets('not json')).toBe(0)
    expect(handle.importSets('{"a":1}')).toBe(0)
    expect(handle.sets.value).toHaveLength(0)
  })

  it('isolates storage per user', () => {
    const a = setup('shared', () => 'userA')
    a.current.status = 'A'
    a.handle.save('a-set')
    const b = setup('shared', () => 'userB')
    expect(b.handle.sets.value).toHaveLength(0)
  })
})
