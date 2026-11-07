// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import TagResourceTab from './TagResourceTab.vue'

vi.mock('@/stores/tenant', () => ({ useTenantStore: () => reactive({ tenantId: 'tenant-a' }) }))
vi.mock('@/api/tags', () => ({
  listResourceTags: vi.fn().mockResolvedValue([]),
  upsertResourceTag: vi.fn(),
  deleteResourceTag: vi.fn(),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref([]) }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const input = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
const stubs = {
  ListPageQueryBar: { template: '<div><slot /></div>' },
  MetaSelect: input,
  ElInput: input,
  ElFormItem: { template: '<div><slot /></div>' },
  ElDrawer: true,
  ElButton: true,
  ElTable: { template: '<div class="table"><slot name="empty" /></div>' },
  ElTableColumn: true,
  DataState: { template: '<div><slot /></div>' },
  EmptyState: { props: ['description'], template: '<p class="empty">{{ description }}</p>' },
}

describe('资源标签空态', () => {
  it('未选资源时空态说明先选资源类型和编码，选好后回到默认空态', async () => {
    const wrapper = mount(TagResourceTab, { global: { stubs } })
    await flushPromises()
    expect(wrapper.get('.empty').text()).toBe('tagResourceTab.emptyNeedResource')
    await wrapper.findAll('input')[0]!.setValue('JOB')
    await wrapper.findAll('input')[1]!.setValue('job-1')
    expect(wrapper.get('.empty').text()).toBe('common.noData')
  })
})
