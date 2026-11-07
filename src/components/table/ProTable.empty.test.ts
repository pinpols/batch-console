// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProTable from './ProTable.vue'

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/test' }) }))

const stubs = {
  ElTable: {
    template: '<div class="table"><slot /><div class="empty"><slot name="empty" /></div></div>',
  },
  ElButton: { template: '<button><slot /></button>' },
  TableSkeleton: { template: '<div class="skeleton" />' },
  TablePagerBar: { template: '<div class="pager" />' },
  ProPagination: { template: '<div class="pager" />' },
  EmptyState: {
    props: ['description', 'variant'],
    template: '<p class="empty-state" :data-variant="variant">{{ description }}</p>',
  },
  ListEmptyState: {
    props: {
      filtered: { type: Boolean, default: false },
      filteredDescription: { type: String, default: '' },
    },
    emits: ['reset'],
    template:
      '<button type="button" class="list-empty" :data-filtered="String(filtered)" @click="$emit(\'reset\')">{{ filteredDescription }}</button>',
  },
}

function render(props: Record<string, unknown> = {}, slots?: Record<string, string>) {
  return mount(ProTable, {
    props: {
      data: [],
      total: 0,
      page: 1,
      pageSize: 15,
      ...props,
    },
    slots,
    global: { stubs },
  })
}

describe('ProTable 空态', () => {
  it('无筛选时在表内显示图标空态，文案用通用暂无数据', () => {
    const wrapper = render()
    const empty = wrapper.get('.empty-state')
    expect(empty.attributes('data-variant')).toBe('empty')
    expect(empty.text()).toBe('proTable.empty')
    expect(wrapper.find('.list-empty').exists()).toBe(false)
  })

  it('有筛选时显示筛选无结果，点重置发出 reset', async () => {
    const wrapper = render({ hasActiveFilters: true, filteredEmptyText: '没有匹配' })
    const filtered = wrapper.get('.list-empty')
    expect(filtered.attributes('data-filtered')).toBe('true')
    expect(filtered.text()).toBe('没有匹配')
    await filtered.trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
    expect(wrapper.find('.empty-state').exists()).toBe(false)
  })

  it('无筛选时使用页面空槽，不显示筛选重置', () => {
    const wrapper = render({}, { empty: '<p class="custom-empty">去新建</p>' })
    expect(wrapper.get('.custom-empty').text()).toBe('去新建')
    expect(wrapper.find('.list-empty').exists()).toBe(false)
  })
})
