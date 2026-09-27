// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { displayTimezone } from '@/constants/timezone'
import DatetimeText from './DatetimeText.vue'

const originalTimezone = displayTimezone.value
afterEach(() => {
  displayTimezone.value = originalTimezone
})

describe('DatetimeText', () => {
  it('reacts to display timezone changes without changing the machine instant', async () => {
    displayTimezone.value = 'Asia/Shanghai'
    const wrapper = mount(DatetimeText, { props: { value: '2026-09-26T16:30:00Z' } })
    expect(wrapper.text()).toBe('2026-09-27 00:30:00')
    expect(wrapper.attributes('datetime')).toBe('2026-09-26T16:30:00.000Z')

    displayTimezone.value = 'UTC'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('2026-09-26 16:30:00')
    expect(wrapper.attributes('datetime')).toBe('2026-09-26T16:30:00.000Z')
  })

  it('preserves date-only business values', () => {
    const wrapper = mount(DatetimeText, { props: { value: '2026-09-27', mode: 'date' } })
    expect(wrapper.text()).toBe('2026-09-27')
    expect(wrapper.attributes('datetime')).toBe('2026-09-27')
  })

  it('serializes epoch milliseconds as a machine-readable instant', () => {
    const wrapper = mount(DatetimeText, { props: { value: 0 } })
    expect(wrapper.attributes('datetime')).toBe('1970-01-01T00:00:00.000Z')
  })

  it('keeps an explicit schedule timezone when the display preference changes', async () => {
    displayTimezone.value = 'UTC'
    const wrapper = mount(DatetimeText, {
      props: { value: '2026-09-26T16:30:00Z', timezone: 'Asia/Shanghai' },
    })
    expect(wrapper.text()).toBe('2026-09-27 00:30:00')
    displayTimezone.value = 'America/New_York'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('2026-09-27 00:30:00')
  })
})
