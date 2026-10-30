// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { workflowApi, type WorkflowMonitoringPolicyResponse } from '@/api/workflow'
import { useTenantStore } from '@/stores/tenant'
import labels from '@/locales/workflowDefinitionList.zh-CN'
import WorkflowMonitoringPolicyDialog from './WorkflowMonitoringPolicyDialog.vue'

vi.mock('@/api/workflow', () => ({
  workflowApi: { getMonitoringPolicy: vi.fn(), saveMonitoringPolicy: vi.fn() },
}))
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return { ...actual, ElMessage: { success: vi.fn() } }
})
vi.mock('@/utils/userErrorMessage', () => ({ userErrorMessage: () => '策略请求失败' }))
enableAutoUnmount(afterEach)

const button = defineComponent({
  props: ['disabled', 'loading'],
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () =>
      h(
        'button',
        { disabled: props.disabled || props.loading, onClick: () => emit('click') },
        slots.default?.(),
      )
  },
})
const numberInput = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        type: 'number',
        value: props.modelValue,
        onInput: (event: Event) =>
          emit('update:modelValue', Number((event.target as HTMLInputElement).value)),
      })
  },
})
const clock = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        class: 'clock',
        value: props.modelValue ?? '',
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLInputElement).value || null),
      })
  },
})

function policy(
  definitionId = 1,
  tenantId = 'ta',
  seconds = 600,
): WorkflowMonitoringPolicyResponse {
  return {
    tenantId,
    workflowDefinitionId: definitionId,
    softRuntimeSeconds: seconds,
    softRuntimeSeverity: 'ERROR',
    startGraceSeconds: 120,
    startGraceSeverity: 'WARN',
    completionDeadlineLocalTime: '04:30:00',
    completionDeadlineDayOffset: 1,
    completionDeadlineSeverity: 'CRITICAL',
  }
}

function render(canEdit = true) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useTenantStore().setTenantId('ta')
  return mount(WorkflowMonitoringPolicyDialog, {
    props: { modelValue: true, workflowId: 1, workflowCode: 'WF', canEdit },
    global: {
      plugins: [
        pinia,
        createI18n({
          legacy: false,
          locale: 'zh-CN',
          messages: {
            'zh-CN': {
              common: { close: '关闭', save: '保存', retry: '重试' },
              workflowDefinitionList: labels,
            },
          },
        }),
      ],
      directives: { loading: {} },
      stubs: {
        ElDialog: {
          props: ['modelValue'],
          template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>',
        },
        ElForm: {
          props: ['disabled'],
          template: '<fieldset :disabled="disabled"><slot /></fieldset>',
        },
        ElFormItem: { props: ['label'], template: '<label>{{ label }}<slot /></label>' },
        ElInputNumber: numberInput,
        ElTimePicker: clock,
        ElButton: button,
        ElSelect: { template: '<span><slot /></span>' },
        ElOption: true,
        ElAlert: { props: ['title'], template: '<p role="alert">{{ title }}</p>' },
      },
    },
  })
}

describe('WorkflowMonitoringPolicyDialog', () => {
  beforeEach(() => {
    vi.mocked(workflowApi.getMonitoringPolicy).mockReset().mockResolvedValue(policy())
    vi.mocked(workflowApi.saveMonitoringPolicy).mockReset().mockResolvedValue(policy())
  })

  it('读取当前根策略后允许管理员保存，读取期间禁用保存', async () => {
    const wrapper = render()
    const save = wrapper.findAll('button').find((item) => item.text() === '保存')!
    expect(save.attributes('disabled')).toBeDefined()
    await flushPromises()
    expect(workflowApi.getMonitoringPolicy).toHaveBeenCalledWith(1, 'ta')
    expect(save.attributes('disabled')).toBeUndefined()
    await save.trigger('click')
    await flushPromises()
    expect(workflowApi.saveMonitoringPolicy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'ta',
        softRuntimeSeconds: 600,
        completionDeadlineLocalTime: '04:30:00',
      }),
    )
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('只读角色可以查看但没有保存操作', async () => {
    const wrapper = render(false)
    await flushPromises()
    expect(wrapper.findAll('button').some((item) => item.text() === '保存')).toBe(false)
    expect(workflowApi.saveMonitoringPolicy).not.toHaveBeenCalled()
  })

  it('读取失败时保留重试入口，不能把空表单覆盖现有策略', async () => {
    vi.mocked(workflowApi.getMonitoringPolicy).mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('策略请求失败')
    const save = wrapper.findAll('button').find((item) => item.text() === '保存')!
    expect(save.attributes('disabled')).toBeDefined()
    await save.trigger('click')
    expect(workflowApi.saveMonitoringPolicy).not.toHaveBeenCalled()
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '重试')!
      .trigger('click')
    await flushPromises()
    expect(save.attributes('disabled')).toBeUndefined()
  })

  it('切换目标后旧响应不能覆盖新工作流的阈值', async () => {
    let finishOld!: (value: WorkflowMonitoringPolicyResponse) => void
    const oldRequest = new Promise<WorkflowMonitoringPolicyResponse>((resolve) => {
      finishOld = resolve
    })
    vi.mocked(workflowApi.getMonitoringPolicy)
      .mockReturnValueOnce(oldRequest)
      .mockResolvedValueOnce(policy(2, 'ta', 900))
    const wrapper = render()
    await wrapper.setProps({ workflowId: 2, workflowCode: 'WF2' })
    await flushPromises()
    finishOld(policy())
    await flushPromises()
    const runtimeInput = wrapper.findAll('input[type=number]')[1]!
    expect((runtimeInput.element as HTMLInputElement).value).toBe('900')
    expect(workflowApi.getMonitoringPolicy).toHaveBeenLastCalledWith(2, 'ta')
  })

  it('切换租户重新读取且拒绝身份不匹配的策略', async () => {
    const wrapper = render()
    await flushPromises()
    useTenantStore().setTenantId('tb')
    await flushPromises()
    expect(workflowApi.getMonitoringPolicy).toHaveBeenLastCalledWith(1, 'tb')
    expect(wrapper.text()).toContain(labels.monitoring.identityMismatch)
    const save = wrapper.findAll('button').find((item) => item.text() === '保存')!
    expect(save.attributes('disabled')).toBeDefined()
  })

  it('三类分别关闭时提交零阈值和空钟点，不发送旧元数据', async () => {
    const wrapper = render()
    await flushPromises()
    for (const input of wrapper.findAll('input[type=number]')) await input.setValue(0)
    await wrapper.get('input.clock').setValue('')
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '保存')!
      .trigger('click')
    await flushPromises()
    expect(workflowApi.saveMonitoringPolicy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'ta',
        softRuntimeSeconds: 0,
        startGraceSeconds: 0,
        completionDeadlineLocalTime: null,
      }),
    )
    const request = vi.mocked(workflowApi.saveMonitoringPolicy).mock.calls[0]![1]
    expect(request).not.toHaveProperty('workflowDefinitionId')
    expect(request).not.toHaveProperty('updatedAt')
  })
})
