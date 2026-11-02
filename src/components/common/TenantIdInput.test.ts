// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '@/locales/zh-CN'
import en from '@/locales/en-US'
import TenantIdInput from './TenantIdInput.vue'

describe('TenantIdInput 提示', () => {
  it.each([
    ['zh-CN', '建议使用小写字母', '不可使用保留前缀'],
    ['en-US', 'Use lowercase', 'Reserved prefixes'],
  ] as const)('在 %s 中隐藏重复建议时保留保留名单', async (locale, suggestion, reserved) => {
    const i18n = createI18n({ legacy: false, locale, messages: { 'zh-CN': zh, 'en-US': en } })
    const wrapper = mount(TenantIdInput, {
      props: { modelValue: '' },
      global: { plugins: [i18n], stubs: { ElInput: true, ElIcon: true } },
    })
    expect(wrapper.text()).toContain(suggestion)
    expect(wrapper.text()).toContain(reserved)
    await wrapper.setProps({ showSuggestion: false })
    expect(wrapper.text()).not.toContain(suggestion)
    expect(wrapper.text()).toContain(reserved)
  })
})
