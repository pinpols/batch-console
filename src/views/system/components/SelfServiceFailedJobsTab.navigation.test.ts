// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, inject, provide, toRef, type PropType, type Ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelfServiceFailedJobsTab from './SelfServiceFailedJobsTab.vue'

const state = vi.hoisted(() => ({ copy: vi.fn(), jobs: vi.fn() }))
vi.mock('@/composables/useCopy', () => ({ useCopy: () => ({ copy: state.copy }) }))
vi.mock('@/api/queries/instances', () => ({ queryJobInstances: state.jobs }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const ProTableStub = defineComponent({
  props: { data: { type: Array as PropType<Record<string, unknown>[]>, default: () => [] } },
  setup(props, { slots }) {
    provide('rows', toRef(props, 'data'))
    return () => h('section', slots.default?.())
  },
})
const TableColumnStub = defineComponent({
  setup(_props, { slots }) {
    const rows = inject<Ref<Record<string, unknown>[]>>('rows')
    return () =>
      h(
        'div',
        rows?.value.map((row) => slots.default?.({ row })),
      )
  },
})
const PopoverStub = defineComponent({
  setup(_props, { slots }) {
    return () => h('div', [slots.reference?.(), slots.default?.()])
  },
})

describe('SelfServiceFailedJobsTab 实例链接', () => {
  beforeEach(() => {
    state.copy.mockReset()
    state.jobs.mockReset().mockResolvedValue({
      records: [{ id: 123, instanceNo: 'instance-001', jobCode: 'job-a' }],
    })
  })

  it('打开实例详情时不写剪贴板，完整值预览仍可显式复制', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/monitor/job-instances/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(SelfServiceFailedJobsTab, {
      global: {
        plugins: [router],
        stubs: {
          ProTable: ProTableStub,
          ElTableColumn: TableColumnStub,
          ElPopover: PopoverStub,
          ElIcon: true,
          ElButton: { template: '<button><slot /></button>' },
          EmptyState: true,
        },
      },
    })
    await flushPromises()

    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('/monitor/job-instances/123')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/monitor/job-instances/123')
    expect(state.copy).not.toHaveBeenCalled()

    const preview = wrapper.get('.copyable-text__details')
    await preview.get('button').trigger('click')
    expect(state.copy).toHaveBeenCalledExactlyOnceWith('instance-001')
    wrapper.unmount()
  })
})
