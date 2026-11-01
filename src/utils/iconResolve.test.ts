import { describe, it, expect } from 'vitest'
import { resolveIcon } from './iconResolve'

describe('resolveIcon', () => {
  it('未知图标名:返回 fallback(Menu)而非 undefined,保菜单可渲染', () => {
    const c = resolveIcon('NotARealIconName')
    expect(c).toBeDefined()
  })

  it('空 / null / undefined:返回 fallback', () => {
    expect(resolveIcon('')).toBeDefined()
    expect(resolveIcon(null)).toBeDefined()
    expect(resolveIcon(undefined)).toBeDefined()
  })

  it('已知图标与未知名称的兜底图标均可用且不同', () => {
    const known = resolveIcon('Plus')
    const unknown = resolveIcon('NopeIcon')
    expect(known).toBeDefined()
    expect(known).not.toBeNull()
    expect(unknown).toBeDefined()
    // unknown 应跟 fallback 同源(Menu / Operation / Box 之一)
    expect(unknown).not.toBe(known)
  })
})
