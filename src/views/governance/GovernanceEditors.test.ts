// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import GovernanceQueueEditor from './GovernanceQueueEditor.vue'
import GovernanceCalendarEditor from './GovernanceCalendarEditor.vue'

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const stubs = {
  ElDrawer: { template: '<section><slot /><slot name="footer" /></section>' },
  ElForm: { template: '<form><slot /></form>' },
  ElFormItem: { props: ['label'], template: '<label><span>{{ label }}</span><slot /></label>' },
  ElInput: {
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
    template:
      '<input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  ElButton: {
    emits: ['click'],
    template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
  },
  ElInputNumber: true,
  ElSwitch: true,
  MetaSelect: true,
}

describe('治理配置编辑抽屉', () => {
  it('队列编辑保留表单响应式、编辑态代码锁定和保存事件', async () => {
    const form = reactive({
      queueCode: 'queue-a',
      queueName: '原名称',
      queueType: 'MIXED',
      maxRunningJobs: undefined,
      maxRunningPartitions: undefined,
      maxQps: undefined,
      workerGroup: '',
      resourceTag: '',
      priorityPolicy: '',
      fairShareWeight: undefined,
      enabled: true,
      description: '',
    })
    const wrapper = mount(GovernanceQueueEditor, {
      props: { modelValue: true, queueForm: form, queueEditingId: 1, saving: false },
      global: { stubs },
    })
    const labels = wrapper.findAll('label')
    const code = labels.find((item) => item.text().includes('queueConfig.fieldQueueCode'))!
    const name = labels.find((item) => item.text().includes('queueConfig.fieldQueueName'))!
    expect(code.find('input').attributes('disabled')).toBeDefined()
    await name.find('input').setValue('新名称')
    expect(form.queueName).toBe('新名称')
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'common.save')!
      .trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('日历新建可修改编码，取消时通知父页面关闭', async () => {
    const form = reactive({
      calendarCode: '',
      calendarName: '',
      timezone: 'Asia/Shanghai',
      holidayRollRule: '',
      catchUpPolicy: '',
      catchUpMaxDays: undefined,
      enabled: true,
    })
    const wrapper = mount(GovernanceCalendarEditor, {
      props: { modelValue: true, calendarForm: form, calendarEditingId: null, saving: false },
      global: { stubs },
    })
    const code = wrapper
      .findAll('label')
      .find((item) => item.text().includes('queueConfig.fieldCalendarCode'))!
    await code.find('input').setValue('calendar-a')
    expect(form.calendarCode).toBe('calendar-a')
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'common.cancel')!
      .trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
