// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ObservabilityQueryTabs from './ObservabilityQueryTabs.vue'

const state = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: state.push, replace: state.replace }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('ObservabilityQueryTabs Trace 快速入口', () => {
  beforeEach(() => {
    state.push.mockReset().mockResolvedValue(undefined)
    state.replace.mockReset().mockResolvedValue(undefined)
  })

  it('按一次 Enter 只导航一次，按钮仍能导航', async () => {
    const wrapper = mount(ObservabilityQueryTabs, {
      global: {
        stubs: {
          PageContainer: { template: '<div><slot /></div>' },
          PageHeader: { template: '<header><slot name="actions" /></header>' },
          DeadLettersTab: true,
          RetriesTab: true,
          ExecutionLogsTab: true,
          ChannelReceiptsTab: true,
          ElTooltip: { template: '<div><slot /></div>' },
          ElInput: {
            props: ['modelValue'],
            emits: ['update:modelValue', 'input'],
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'input\', $event.target.value)" />',
          },
          ElButton: { template: '<button><slot /></button>' },
          ElTabs: true,
          ElTabPane: true,
        },
      },
    })
    const input = wrapper.get('input')
    await input.setValue('trace-123')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keyup', { key: 'Enter' })
    expect(state.push).toHaveBeenCalledExactlyOnceWith('/observability/trace?traceId=trace-123')

    state.push.mockClear()
    await wrapper.get('.obs-trace-quick > button').trigger('click')
    expect(state.push).toHaveBeenCalledExactlyOnceWith('/observability/trace?traceId=trace-123')
    wrapper.unmount()
  })
})
