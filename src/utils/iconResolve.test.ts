import { describe, it, expect } from 'vitest'
import { Menu, Plus } from '@lucide/vue'
import { resolveIcon } from './iconResolve'

describe('resolveIcon', () => {
  it('未知图标名:返回 fallback(Menu)而非 undefined,保菜单可渲染', () => {
    const c = resolveIcon('NotARealIconName')
    expect(c).toBe(Menu)
  })

  it('空 / null / undefined:返回 fallback', () => {
    expect(resolveIcon('')).toBe(Menu)
    expect(resolveIcon(null)).toBe(Menu)
    expect(resolveIcon(undefined)).toBe(Menu)
  })

  it('已知图标与未知名称的兜底图标均可用且不同', () => {
    const known = resolveIcon('Plus')
    const unknown = resolveIcon('NopeIcon')
    expect(known).toBe(Plus)
    expect(unknown).toBe(Menu)
  })
})
