// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { workflowApi } from '@/api/workflow'
import labels from '@/locales/workflowDefinitionList.zh-CN'
import WorkflowBulkTriggerDialog from './WorkflowBulkTriggerDialog.vue'

vi.mock('@/api/workflow', () => ({ workflowApi: { trigger: vi.fn(), triggerStatus: vi.fn() } }))
vi.mock('@/utils/userErrorMessage', () => ({ userErrorMessage: () => '请求未完成' }))
enableAutoUnmount(afterEach)
const targets = [1, 2].map((id) => ({ id, tenantId: 'ta', workflowCode: `WF_${id}`, enabled: true }))
const button = defineComponent({
  props: ['disabled', 'loading'], emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h('button', { disabled: props.disabled || props.loading, onClick: () => emit('click') }, slots.default?.())
  },
})
const picker = defineComponent({
  props: ['modelValue', 'disabled'], emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', { type: 'date', value: props.modelValue, disabled: props.disabled,
      onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) })
  },
})

function render() {
  return mount(WorkflowBulkTriggerDialog, {
    props: { modelValue: true, tenantId: 'ta', canTrigger: true, targets },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: {
        'zh-CN': { common: { close: '关闭' }, workflowDefinitionList: labels },
      } })],
      stubs: {
        ElDialog: { props: ['modelValue'], template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>' },
        ElForm: { template: '<form><slot /></form>' }, ElFormItem: { template: '<div><slot /></div>' },
        ElButton: button, ElDatePicker: picker,
        ElAlert: { props: ['title'], template: '<p role="alert">{{ title }}</p>' },
        ElTable: { props: ['data'], template: '<div><span v-for="row in data" :key="row.workflowDefinitionId">{{ row.workflowCode }} {{ row.state }} {{ row.receipt }}</span><slot /></div>' },
        ElTableColumn: { template: '<div><slot :row="{}" /></div>' },
      },
    },
  })
}

describe('WorkflowBulkTriggerDialog', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.mocked(workflowApi.trigger).mockReset().mockResolvedValue('801')
    vi.mocked(workflowApi.triggerStatus).mockReset()
  })

  it('表格列以空行探测插槽时不查询不存在的状态翻译', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render()
      await flushPromises()
      const messages = warning.mock.calls.flat().join(' ')
      expect(messages).not.toContain('workflowDefinitionList.bulk.states.undefined')
    } finally {
      warning.mockRestore()
    }
  })

  it('必须选择业务日并逐项确认，不混合预检或自动关闭逐项结果', async () => {
    const wrapper = render()
    expect(wrapper.text()).toContain(labels.bulk.hint)
    const submit = wrapper.findAll('button').find((item) => item.text() === '确认发起 2 项')!
    expect(submit.attributes('disabled')).toBeDefined()
    await wrapper.get('input[type=date]').setValue('2026-10-24')
    await submit.trigger('click')
    await flushPromises()
    expect(workflowApi.trigger).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('SUBMITTED')
    expect(wrapper.get('input[type=date]').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('未知结果显示核对入口并禁用新批次，关闭再打开仍保留原结果', async () => {
    vi.mocked(workflowApi.trigger).mockRejectedValue(new Error('timeout'))
    const wrapper = render()
    await wrapper.get('input[type=date]').setValue('2026-10-24')
    await wrapper.findAll('button').find((item) => item.text() === '确认发起 2 项')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(labels.bulk.unknownHint)
    expect(wrapper.findAll('button').some((item) => item.text() === labels.bulk.retryFailed)).toBe(false)
    expect(wrapper.findAll('button').find((item) => item.text() === labels.bulk.newBatch)!.attributes('disabled')).toBeDefined()
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.text()).toContain('UNKNOWN')
    expect(workflowApi.trigger).toHaveBeenCalledTimes(2)
  })
})
