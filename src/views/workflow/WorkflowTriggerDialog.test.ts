// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import WorkflowTriggerDialog from './WorkflowTriggerDialog.vue'

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('WorkflowTriggerDialog', () => {
  it('透传选择的业务日与确认、取消事件', async () => {
    const wrapper = shallowMount(WorkflowTriggerDialog, {
      props: { modelValue: true, bizDate: '2026-11-02', busy: false },
      global: {
        stubs: {
          ElDialog: { template: '<section><slot /><slot name="footer" /></section>' },
          ElForm: { template: '<form><slot /></form>' },
          ElFormItem: { template: '<div><slot /></div>' },
          ElButton: { template: '<button><slot /></button>' },
        },
      },
    })
    wrapper.findComponent({ name: 'ElDatePicker' }).vm.$emit('update:modelValue', '2026-11-03')
    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('update:bizDate')).toEqual([['2026-11-03']])
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })
})
