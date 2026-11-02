// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import DateRangePresetPicker from './DateRangePresetPicker.vue'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DateRangePresetPicker', () => {
  it('only exposes the keyboard scroll region while its date controls overflow', async () => {
    let onResize: ResizeObserverCallback | undefined
    const disconnect = vi.fn()
    class ResizeObserverStub {
      constructor(callback: ResizeObserverCallback) {
        onResize = callback
      }
      observe() {}
      disconnect = disconnect
    }
    let frame: FrameRequestCallback | undefined
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frame = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const wrapper = mount(DateRangePresetPicker, {
      props: { modelValue: ['2026-10-01', '2026-10-30'], type: 'daterange' },
      global: {
        stubs: {
          ElSelect: true,
          ElOption: true,
          ElDatePicker: true,
          ElTooltip: true,
          ElIcon: true,
        },
      },
    })
    const viewport = wrapper.get('.dr-preset__viewport')
    Object.defineProperty(viewport.element, 'clientWidth', { configurable: true, value: 120 })
    Object.defineProperty(viewport.element, 'scrollWidth', { configurable: true, value: 196 })
    onResize?.([], {} as ResizeObserver)
    frame?.(0)
    await nextTick()
    expect(viewport.attributes('role')).toBe('region')
    expect(viewport.attributes('tabindex')).toBe('0')
    expect(viewport.attributes('aria-label')).toBe('dateRangePicker.scrollRange')

    Object.defineProperty(viewport.element, 'scrollWidth', { configurable: true, value: 120 })
    onResize?.([], {} as ResizeObserver)
    frame?.(0)
    await nextTick()
    expect(viewport.attributes('role')).toBeUndefined()
    expect(viewport.attributes('tabindex')).toBeUndefined()
    wrapper.unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})
