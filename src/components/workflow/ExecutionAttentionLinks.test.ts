// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ExecutionAttentionLinks from './ExecutionAttentionLinks.vue'

enableAutoUnmount(afterEach)
describe('执行异常与等待快捷选择', () => {
  it('逐项保留并行失败和等待节点，不把未知状态当作等待', async () => {
    const wrapper = mount(ExecutionAttentionLinks, {
      props: {
        selected: 'wait-a',
        items: [
          { code: 'wait-a', name: 'A', state: 'WAITING', stateLabel: '等待' },
          { code: 'wait-b', name: 'B', state: 'WAITING_DEPENDENCY', stateLabel: '等待依赖' },
          { code: 'failed', name: 'C', state: 'FAILED', stateLabel: '失败' },
          { code: 'unknown', name: 'D', state: 'FUTURE_STATE', stateLabel: '未知' },
        ],
      },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'zh-CN',
            messages: { 'zh-CN': { workflowProgress: { attentionTitle: '失败与等待' } } },
          }),
        ],
        stubs: {
          ElButton: {
            props: ['ariaPressed'],
            template:
              '<button :aria-pressed="ariaPressed" @click="$emit(\'click\')"><slot /></button>',
            emits: ['click'],
          },
        },
      },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.map((item) => item.text())).toEqual(['A · 等待', 'B · 等待依赖', 'C · 失败'])
    expect(buttons[0].attributes('aria-pressed')).toBe('true')
    await buttons[2].trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['failed'])
  })
})
