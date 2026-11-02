// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MSearchBar from './MSearchBar.vue'
import { logClick } from '@/utils/logger'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/utils/logger', () => ({ logClick: vi.fn() }))

describe('MSearchBar', () => {
  afterEach(() => vi.useRealTimers())

  it('does not issue a stale debounced search after clearing', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MSearchBar, {
      props: { modelValue: '' },
      global: { stubs: { ElIcon: true } },
    })
    await wrapper.get('input').setValue('keyword')
    await wrapper.get('button').trigger('click')
    await vi.runAllTimersAsync()
    expect(wrapper.emitted('search')).toEqual([['']])
    wrapper.unmount()
  })

  it('does not search after the component is unmounted', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MSearchBar, {
      props: { modelValue: '' },
      global: { stubs: { ElIcon: true } },
    })
    await wrapper.get('input').setValue('keyword')
    wrapper.unmount()
    await vi.runAllTimersAsync()
    expect(wrapper.emitted('search')).toBeUndefined()
    expect(logClick).not.toHaveBeenCalled()
  })

  it('discards the old pending search when the parent resets the value', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MSearchBar, {
      props: { modelValue: '' },
      global: { stubs: { ElIcon: true } },
    })
    await wrapper.get('input').setValue('keyword')
    await wrapper.setProps({ modelValue: 'replacement' })
    await vi.runAllTimersAsync()
    expect(wrapper.emitted('search')).toBeUndefined()
    wrapper.unmount()
  })
})
