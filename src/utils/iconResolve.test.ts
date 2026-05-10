import { describe, it, expect } from 'vitest'
import { resolveIcon } from './iconResolve'

describe('resolveIcon', () => {
  it('已知图标名:返回对应 EP 图标 Component', () => {
    const c = resolveIcon('Plus')
    expect(c).toBeDefined()
    expect(c).not.toBeNull()
  })

  it('未知图标名:返回 fallback(Menu)而非 undefined,保菜单可渲染', () => {
    const c = resolveIcon('NotARealIconName')
    expect(c).toBeDefined()
  })

  it('空 / null / undefined:返回 fallback', () => {
    expect(resolveIcon('')).toBeDefined()
    expect(resolveIcon(null)).toBeDefined()
    expect(resolveIcon(undefined)).toBeDefined()
  })

  it('已知 + 未知 fallback 应一致(都是非空 Component)', () => {
    const known = resolveIcon('Plus')
    const unknown = resolveIcon('NopeIcon')
    expect(known).toBeDefined()
    expect(unknown).toBeDefined()
    // unknown 应跟 fallback 同源(Menu / Operation / Box 之一)
    expect(unknown).not.toBe(known)
  })
})
