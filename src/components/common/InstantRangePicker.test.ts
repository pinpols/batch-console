// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { displayTimezone } from '@/constants/timezone'
import InstantPicker from './InstantPicker.vue'
import InstantRangePicker from './InstantRangePicker.vue'

const originalTimezone = displayTimezone.value
afterEach(() => {
  displayTimezone.value = originalTimezone
})

const DatePickerStub = defineComponent({
  name: 'ElDatePicker',
  props: ['modelValue', 'type', 'valueFormat'],
  emits: ['update:modelValue'],
  template: '<div />',
})

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': { dateRangePicker: { invalidLocalTime: '所选时间无效' } } },
})

const global = { plugins: [i18n], stubs: { ElDatePicker: DatePickerStub } }

describe('InstantRangePicker', () => {
  it('displays local wall time and emits UTC instants', async () => {
    displayTimezone.value = 'Asia/Shanghai'
    const wrapper = mount(InstantRangePicker, {
      props: { modelValue: ['2026-09-26T16:00:00Z', '2026-09-26T17:00:00Z'] },
      global,
    })
    const picker = wrapper.findComponent(DatePickerStub)
    expect(picker.props('modelValue')).toEqual(['2026-09-27 00:00:00', '2026-09-27 01:00:00'])

    picker.vm.$emit('update:modelValue', ['2026-09-27 02:00:00', '2026-09-27 03:00:00'])
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      ['2026-09-26T18:00:00.000Z', '2026-09-26T19:00:00.000Z'],
    ])
  })
})

describe('InstantPicker', () => {
  it('uses the same conversion contract for a single instant', async () => {
    displayTimezone.value = 'Asia/Shanghai'
    const wrapper = mount(InstantPicker, {
      props: { modelValue: '2026-09-26T16:00:00Z' },
      global,
    })
    const picker = wrapper.findComponent(DatePickerStub)
    expect(picker.props('modelValue')).toBe('2026-09-27 00:00:00')

    picker.vm.$emit('update:modelValue', '2026-09-27 01:30:00')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-09-26T17:30:00.000Z'])
  })
})
