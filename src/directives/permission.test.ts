// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { DirectiveBinding } from 'vue'
import { permissionDirective } from './permission'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/client', () => ({ get: vi.fn() }))
vi.mock('@/api/auth', () => ({
  authApi: { login: vi.fn(), logout: vi.fn() },
  mapProfileToUserInfo: (p: unknown) => p,
}))

// jsdom 自带 localStorage,但 auth store init 时若读 storage 抛会让 pinia setup 失败 — 兜底成空
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
})

/** 直接调用 directive.mounted(el, binding),不走 Vue 渲染,避免依赖 @vue/test-utils。 */
function runMounted(value: unknown): HTMLElement {
  const parent = document.createElement('div')
  const el = document.createElement('span')
  el.className = 'gated'
  parent.appendChild(el)
  document.body.appendChild(parent)
  permissionDirective.mounted!(el, { value } as DirectiveBinding, null as never, null)
  return parent
}

function survived(parent: HTMLElement): boolean {
  return parent.querySelector('.gated') != null
}

describe('v-permission directive', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.body.innerHTML = ''
  })

  it('keeps element when permission granted (string)', () => {
    const auth = useAuthStore()
    vi.spyOn(auth, 'hasPermission').mockReturnValue(true)
    expect(survived(runMounted('alert:read'))).toBe(true)
  })

  it('removes element when permission denied (string)', () => {
    const auth = useAuthStore()
    vi.spyOn(auth, 'hasPermission').mockReturnValue(false)
    expect(survived(runMounted('alert:read'))).toBe(false)
  })

  it('keeps element when ANY permission granted (array OR semantics)', () => {
    const auth = useAuthStore()
    vi.spyOn(auth, 'hasPermission').mockImplementation((p: string) => p === 'b')
    expect(survived(runMounted(['a', 'b', 'c']))).toBe(true)
  })

  it('removes element when ALL permissions denied (array)', () => {
    const auth = useAuthStore()
    vi.spyOn(auth, 'hasPermission').mockReturnValue(false)
    expect(survived(runMounted(['a', 'b']))).toBe(false)
  })

  it('keeps element when permissions list empty', () => {
    expect(survived(runMounted([]))).toBe(true)
  })

  it('object form: minRole gate denies when role insufficient', () => {
    const auth = useAuthStore()
    vi.spyOn(auth, 'canAccess').mockReturnValue(false)
    expect(survived(runMounted({ minRole: 'ROLE_ADMIN' }))).toBe(false)
  })

  it('object form: minRole + permissions both pass keeps element', () => {
    const auth = useAuthStore()
    vi.spyOn(auth, 'canAccess').mockReturnValue(true)
    vi.spyOn(auth, 'hasPermission').mockReturnValue(true)
    expect(survived(runMounted({ minRole: 'ROLE_USER', permissions: 'x' }))).toBe(true)
  })

  it('object form: minRole pass but permissions fail → removed (AND semantics)', () => {
    const auth = useAuthStore()
    vi.spyOn(auth, 'canAccess').mockReturnValue(true)
    vi.spyOn(auth, 'hasPermission').mockReturnValue(false)
    expect(survived(runMounted({ minRole: 'ROLE_USER', permissions: 'x' }))).toBe(false)
  })
})
