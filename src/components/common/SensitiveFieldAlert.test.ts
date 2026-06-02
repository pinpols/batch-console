// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SensitiveFieldAlert from './SensitiveFieldAlert.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': {
      sensitiveFieldAlert: {
        title: '检测到 {n} 个疑似凭据字段',
        hint: '请改走环境变量,不要落入 parameters / descriptor',
      },
    },
    'en-US': {
      sensitiveFieldAlert: {
        title: '{n} suspected credential field(s) detected',
        hint: 'Use environment variables; never embed in parameters / descriptor',
      },
    },
  },
})

function factory(props: Record<string, unknown>, slots?: Record<string, string>) {
  return mount(SensitiveFieldAlert, {
    props,
    slots,
    global: {
      plugins: [i18n],
      // 简易 stub:避免 element-plus auto-import css 链路
      stubs: {
        'el-alert': {
          props: ['title', 'type'],
          template: `<div class="stub-el-alert" :data-type="type" :data-title="title"><slot /></div>`,
        },
        ElAlert: {
          props: ['title', 'type'],
          template: `<div class="stub-el-alert" :data-type="type" :data-title="title"><slot /></div>`,
        },
      },
    },
  })
}

describe('SensitiveFieldAlert', () => {
  it('renders nothing when no sensitive keys (no alert, no empty slot)', () => {
    const w = factory({ value: { name: 'a', count: 3 } })
    expect(w.find('.stub-el-alert').exists()).toBe(false)
    expect(w.html()).toBe('')
  })

  it('uses #empty slot when provided and no hits', () => {
    const w = factory({ value: { name: 'a' } }, { empty: '<span class="ok">clean</span>' })
    expect(w.find('.ok').exists()).toBe(true)
  })

  it('renders alert with hit count and all hit paths', () => {
    const w = factory({ value: { password: 'p', auth: { token: 't' } } })
    const alert = w.find('.stub-el-alert')
    expect(alert.exists()).toBe(true)
    expect(alert.attributes('data-type')).toBe('warning')
    expect(alert.attributes('data-title')).toContain('2')
    const codes = w.findAll('.sensitive-field-alert__list code').map((c) => c.text())
    expect(codes.sort()).toEqual(['auth.token', 'password'])
  })

  it('parses JSON string input', () => {
    const w = factory({ value: '{"apiKey":"x"}' })
    expect(w.find('.stub-el-alert').exists()).toBe(true)
    const codes = w.findAll('.sensitive-field-alert__list code').map((c) => c.text())
    expect(codes).toEqual(['apiKey'])
  })

  it('honors exemptPaths prop (HTTP auth.* skipped)', () => {
    const w = factory({
      value: { auth: { password: 'p' }, body: { secret: 's' } },
      exemptPaths: ['auth'],
    })
    const codes = w.findAll('.sensitive-field-alert__list code').map((c) => c.text())
    expect(codes).toEqual(['body.secret'])
  })

  it('handles invalid JSON string gracefully (no render)', () => {
    const w = factory({ value: 'not json' })
    expect(w.find('.stub-el-alert').exists()).toBe(false)
  })
})
