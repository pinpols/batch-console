// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import FileList from './FileList.vue'

const mocks = vi.hoisted(() => ({
  tenant: { tenantId: 'tenant-a' },
  list: vi.fn(),
  summary: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/api/file', () => ({ fileApi: { list: mocks.list, summary: mocks.summary } }))
vi.mock('@/api/meta', () => ({ getMetaBizTypes: vi.fn().mockResolvedValue([]) }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canMutateConfig: ref(false) }),
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.list.mockReset().mockResolvedValue({ items: [], total: 0, hasMore: false })
  mocks.summary.mockReset().mockResolvedValue({})
})
describe('文件列表今日到达筛选', () => {
  it('点击今日到达后使用到达日，再次点击恢复业务日期范围', async () => {
    const wrapper = shallowMount(FileList, {
      global: {
        stubs: {
          PageContainer: { template: '<div><slot /></div>' },
          SectionCard: { template: '<div><slot /></div>' },
          ProTable: { template: '<div><slot name="query" /></div>' },
          ListPageQueryBar: { name: 'ListPageQueryBar', template: '<div><slot /></div>' },
          ElFormItem: { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()
    const cards = wrapper.findComponent({ name: 'FileSummaryCards' })
    cards.vm.$emit('today')
    await flushPromises()
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ arrivalToday: true, startDate: '', endDate: '' }),
    )
    expect(cards.props('activeSummaryKey')).toBe('today')
    cards.vm.$emit('today')
    await flushPromises()
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        arrivalToday: false,
        startDate: expect.any(String),
        endDate: expect.any(String),
      }),
    )
    expect(cards.props('activeSummaryKey')).toBe('')
    cards.vm.$emit('today')
    await flushPromises()
    wrapper
      .findComponent({ name: 'DateRangePresetPicker' })
      .vm.$emit('update:modelValue', ['2026-01-02', '2026-01-03'])
    await flushPromises()
    wrapper.findComponent({ name: 'ListPageQueryBar' }).vm.$emit('search')
    await flushPromises()
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        arrivalToday: false,
        startDate: '2026-01-02',
        endDate: '2026-01-03',
      }),
    )
  })
})
