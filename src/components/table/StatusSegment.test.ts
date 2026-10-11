// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusSegment from './StatusSegment.vue'

describe('StatusSegment', () => {
  const items = [
    { value: '', label: '全部', tone: 'neutral' as const },
    { value: 'OPEN', label: '未处理', tone: 'warning' as const, count: 2 },
    { value: 'ACKED', label: '已确认', tone: 'success' as const },
  ]

  it('保留选项顺序并为每种状态呈现语义色标记', () => {
    const wrapper = mount(StatusSegment, {
      props: { modelValue: 'OPEN', items, ariaLabel: '状态' },
    })
    const options = wrapper.findAll('[role="radio"]')

    expect(options.map((option) => option.text())).toEqual(['全部', '未处理2', '已确认'])
    expect(options[0].classes()).toContain('is-neutral')
    expect(options[1].classes()).toContain('is-warning')
    expect(options[1].attributes('aria-checked')).toBe('true')
    expect(options[1].find('.status-segment__dot').exists()).toBe(true)
    expect(options[2].classes()).toContain('is-success')
  })

  it('点击选项时发出新的筛选值', async () => {
    const wrapper = mount(StatusSegment, {
      props: { modelValue: '', items, ariaLabel: '状态' },
    })

    await wrapper.findAll('[role="radio"]')[2].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['ACKED']])
  })
})
