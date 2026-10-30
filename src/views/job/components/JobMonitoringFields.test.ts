// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import messages from '@/locales/zh-CN'
import JobMonitoringFields from './JobMonitoringFields.vue'

enableAutoUnmount(afterEach)
const slot = defineComponent({ setup: (_, context) => () => h('div', context.slots.default?.()) })
const mode = defineComponent({
  name: 'ElRadioGroup',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup:
    (_, { emit }) =>
    () =>
      h('div', [
        h(
          'button',
          { 'data-mode': 'clock', onClick: () => emit('update:modelValue', 'clock') },
          '绝对完成钟点',
        ),
        h(
          'button',
          { 'data-mode': 'window', onClick: () => emit('update:modelValue', 'window') },
          '相对完成窗口',
        ),
      ]),
})

function render(overrides: Record<string, unknown> = {}) {
  return mount(JobMonitoringFields, {
    props: {
      scheduleType: 'MANUAL',
      softRuntimeSeconds: 0,
      softRuntimeSeverity: 'WARN',
      startGraceSeconds: 60,
      startGraceSeverity: 'WARN',
      completionDeadlineLocalTime: null,
      completionDeadlineDayOffset: 0,
      dependencyCompletionWindowSeconds: 0,
      completionDeadlineSeverity: 'WARN',
      ...overrides,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': messages } })],
      stubs: {
        ElAlert: slot,
        ElFormItem: slot,
        ElInputNumber: slot,
        ElSelect: slot,
        ElOption: slot,
        ElTimePicker: slot,
        ElRadioGroup: mode,
        ElRadioButton: slot,
      },
    },
  })
}

describe('Workflow 子作业的监控策略配置', () => {
  it('MANUAL 定义仍可配置启动和完成规则，运行时资格由服务端判断', () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('启动过晚')
    expect(wrapper.text()).toContain('完成过晚')
    expect(wrapper.find('[data-mode="window"]').exists()).toBe(true)
  })

  it('切换到绝对钟点时关闭相对完成窗口', async () => {
    const wrapper = render({ dependencyCompletionWindowSeconds: 120 })
    await wrapper.get('[data-mode="clock"]').trigger('click')
    expect(wrapper.emitted('update:dependencyCompletionWindowSeconds')).toEqual([[0]])
  })

  it('切换到相对窗口时清除绝对钟点及其日期偏移', async () => {
    const wrapper = render({ completionDeadlineLocalTime: '04:00', completionDeadlineDayOffset: 1 })
    await wrapper.get('[data-mode="window"]').trigger('click')
    expect(wrapper.emitted('update:completionDeadlineLocalTime')).toEqual([[null]])
    expect(wrapper.emitted('update:completionDeadlineDayOffset')).toEqual([[0]])
  })
})
