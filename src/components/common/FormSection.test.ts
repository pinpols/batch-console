// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FormSection from './FormSection.vue'

describe('FormSection', () => {
  it('渲染标题、说明和字段区', () => {
    const wrapper = mount(FormSection, {
      props: { title: '投递设置', description: '失败时按退避重试' },
      slots: { default: '<div class="field" />' },
    })
    expect(wrapper.find('h3').text()).toBe('投递设置')
    expect(wrapper.find('.form-block__head p').text()).toBe('失败时按退避重试')
    expect(wrapper.find('.form-block__body .field').exists()).toBe(true)
    expect(wrapper.classes()).toContain('form-block--stacked')
  })

  it('无标题时不渲染标题区；两列与左右布局通过类名切换', () => {
    const wrapper = mount(FormSection, { props: { columns: 2, layout: 'side' } })
    expect(wrapper.find('.form-block__head').exists()).toBe(false)
    expect(wrapper.classes()).toContain('form-block--side')
    expect(wrapper.find('.form-block__body--pair').exists()).toBe(true)
  })
})
