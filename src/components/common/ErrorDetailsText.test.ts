// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import ErrorDetailsText from './ErrorDetailsText.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': { common: { viewFullValue: '查看完整内容', copy: '复制' } } },
})
const global = {
  plugins: [i18n],
  stubs: {
    ElPopover: { template: '<div><slot name="reference" /><slot /></div>' },
    ElIcon: { template: '<span><slot /></span>' },
    ElButton: { template: '<button><slot /></button>' },
  },
}

describe('ErrorDetailsText', () => {
  it.each([
    ['ERR', 'detailed message', '[ERR] detailed message'],
    ['ERR', '', '[ERR]'],
    ['', 'detailed message', 'detailed message'],
  ])('只读查看错误码和原文', (code, message, expected) => {
    const wrapper = mount(ErrorDetailsText, { props: { code, message }, global })
    expect(wrapper.get('.copyable-text__inspect').attributes('aria-label')).toBe('查看完整内容')
    expect(wrapper.get('.copyable-text__full-value').text()).toBe(expected)
    expect(wrapper.get('.copyable-text__value').text()).toBe(expected)
    expect(wrapper.find('.copyable-text__copy').exists()).toBe(false)
    expect(wrapper.find('.mono').exists()).toBe(!!code)
    wrapper.unmount()
  })

  it('没有错误码和消息时显示占位', () => {
    const wrapper = mount(ErrorDetailsText, { global })
    expect(wrapper.text()).toBe('—')
    expect(wrapper.find('.copyable-text__inspect').exists()).toBe(false)
    wrapper.unmount()
  })
})
