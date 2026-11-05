// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ListEmptyState from './ListEmptyState.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const stubs = {
  EmptyState: {
    props: ['variant', 'title'],
    template: '<div :data-variant="variant">{{ title }}<slot name="action" /></div>',
  },
  ElButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
}
function render(props: Record<string, unknown>) {
  return mount(ListEmptyState, { props: { filtered: false, ...props }, global: { stubs } })
}

describe('列表空态', () => {
  it('有筛选时显示筛选无结果，点重置发出 reset，不显示新建引导', async () => {
    const wrapper = render({ filtered: true, actionText: '去定义作业', actionTo: '/jobs' })
    expect(wrapper.get('[data-variant]').attributes('data-variant')).toBe('filter-empty')
    expect(wrapper.text()).not.toContain('去定义作业')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('没有筛选时显示租户无数据和下一步按钮', async () => {
    const wrapper = render({ title: '还没有作业运行', actionText: '去定义作业', actionTo: '/jobs' })
    expect(wrapper.get('[data-variant]').attributes('data-variant')).toBe('tenant-empty')
    await wrapper.get('button').trigger('click')
    expect(push).toHaveBeenCalledWith('/jobs')
  })

  it('没有下一步时不渲染按钮', () => {
    expect(render({ title: '暂无' }).find('button').exists()).toBe(false)
  })
})
