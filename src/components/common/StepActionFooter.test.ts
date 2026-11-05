// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import StepActionFooter from './StepActionFooter.vue'

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const ElButton = {
  name: 'ElButton',
  props: ['type', 'disabled', 'loading', 'nativeType', 'form', 'plain', 'icon'],
  emits: ['click'],
  template:
    '<button :type="nativeType || \'button\'" :form="form" :data-type="type" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

function render(props: Record<string, unknown> = {}) {
  return mount(StepActionFooter, {
    props: { previewText: '预览', submitText: '确认提交', ...props },
    global: { stubs: { ElButton } },
  })
}

describe('先预览再提交的抽屉底部', () => {
  it('提交不可用时显示原因说明', () => {
    const wrapper = render({ submitDisabled: true, hint: '请先预览' })
    expect(wrapper.get('.step-footer__hint').text()).toContain('请先预览')
    expect(wrapper.findAll('button').at(-1)!.attributes('disabled')).toBeDefined()
  })

  it('正式执行用危险色，常规提交用主色', () => {
    expect(render({ submitTone: 'danger' }).findAll('button').at(-1)!.attributes('data-type')).toBe(
      'danger',
    )
    expect(render().findAll('button').at(-1)!.attributes('data-type')).toBe('primary')
  })

  it('关联表单时提交走原生 submit，不额外触发 submit 事件', async () => {
    const wrapper = render({ submitForm: 'replay-form' })
    const submit = wrapper.findAll('button').at(-1)!
    expect(submit.attributes('type')).toBe('submit')
    expect(submit.attributes('form')).toBe('replay-form')
    await submit.trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('依次发出取消、预览、提交事件', async () => {
    const wrapper = render()
    const [cancel, preview, submit] = wrapper.findAll('button')
    await cancel!.trigger('click')
    await preview!.trigger('click')
    await submit!.trigger('click')
    expect(Object.keys(wrapper.emitted())).toEqual(
      expect.arrayContaining(['cancel', 'preview', 'submit']),
    )
  })
})
