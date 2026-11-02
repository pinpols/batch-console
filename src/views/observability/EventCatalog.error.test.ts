// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import EventCatalog from './EventCatalog.vue'

const mocks = vi.hoisted(() => ({ types: vi.fn(), topics: vi.fn(), message: vi.fn() }))
vi.mock('@/api/eventCatalog', () => ({
  listEventTypes: mocks.types,
  listKafkaTopics: mocks.topics,
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: mocks.message,
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
const slot = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const empty = defineComponent({
  props: ['variant', 'title'],
  setup:
    (props, { slots }) =>
    () =>
      h('div', { 'data-empty': props.variant || 'empty' }, [props.title, slots.action?.()]),
})
const button = defineComponent({
  emits: ['click'],
  setup:
    (_, { slots, emit }) =>
    () =>
      h('button', { onClick: () => emit('click') }, slots.default?.()),
})
const tabs = defineComponent({
  emits: ['update:modelValue'],
  setup:
    (_, { slots, emit }) =>
    () =>
      h('div', [
        h(
          'button',
          { 'data-tab': 'topics', onClick: () => emit('update:modelValue', 'topics') },
          'topics',
        ),
        slots.default?.(),
      ]),
})

function renderCatalog() {
  return mount(EventCatalog, {
    global: {
      stubs: {
        PageContainer: slot,
        PageHeader: slot,
        ListPageQueryBar: slot,
        EmptyState: empty,
        ElTabs: tabs,
        ElTabPane: true,
        ElSegmented: true,
        ElAlert: true,
        ElFormItem: slot,
        ElInput: true,
        ElTag: slot,
        ElButton: button,
        ProTable: true,
        DetailDrawer: true,
        JsonPreview: true,
        ElDescriptions: slot,
        ElDescriptionsItem: slot,
      },
      directives: { loading: () => {} },
    },
  })
}

describe('事件目录错误状态', () => {
  it('默认视图显示请求失败并可重试，成功后恢复目录', async () => {
    mocks.message.mockReset()
    mocks.types
      .mockReset()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce([
        { eventType: 'JOB_SUCCESS', category: 'JOB', description: 'Job completed', schema: '' },
      ])
    mocks.topics.mockReset().mockResolvedValue([])
    const wrapper = renderCatalog()
    await flushPromises()
    expect(wrapper.find('[data-empty="error"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('observability.eventCatalogEmptyTitle')
    await wrapper.get('[data-empty="error"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-empty="error"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('JOB_SUCCESS')
    await vi.waitFor(() => expect(mocks.message).toHaveBeenCalledTimes(1))
    wrapper.unmount()
  })

  it('重试再次失败时保留错误状态，不显示刷新成功', async () => {
    vi.useFakeTimers()
    mocks.message.mockReset()
    mocks.types.mockReset().mockRejectedValue(new Error('unavailable'))
    mocks.topics.mockReset().mockResolvedValue([])
    const wrapper = renderCatalog()
    try {
      await vi.advanceTimersByTimeAsync(0)
      await wrapper.get('[data-empty="error"] button').trigger('click')
      await vi.advanceTimersByTimeAsync(300)
      expect(wrapper.find('[data-empty="error"]').exists()).toBe(true)
      expect(mocks.message).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('切换至主题页时独立展示主题加载错误并可重试', async () => {
    mocks.message.mockReset()
    mocks.types.mockReset().mockResolvedValue([])
    mocks.topics
      .mockReset()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce([
        { topic: 'batch.events', description: '', partitions: '1', replicationFactor: '1' },
      ])
    const wrapper = renderCatalog()
    await flushPromises()
    expect(wrapper.find('[data-empty="error"]').exists()).toBe(false)
    await wrapper.get('[data-tab="topics"]').trigger('click')
    expect(wrapper.find('[data-empty="error"]').exists()).toBe(true)
    await wrapper.get('[data-empty="error"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-empty="error"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('batch.events')
    await vi.waitFor(() => expect(mocks.message).toHaveBeenCalledTimes(1))
    wrapper.unmount()
  })
})
