// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RunsOverview from './RunsOverview.vue'
import CopyableText from '@/components/common/CopyableText.vue'

const state = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/api/instance', () => ({
  instanceApi: {
    list: vi.fn(async () => ({
      total: 1,
      records: [
        {
          id: 7,
          jobCode: 'JOB_LONG_IDENTIFIER_0123456789',
          instanceNo: 'run-7',
          bizDate: '2026-11-02',
          instanceStatus: 'RUNNING',
        },
      ],
    })),
    workflowRuns: vi.fn(async () => ({
      total: 1,
      records: [
        { id: 8, currentNodeCode: 'NODE_LONG_IDENTIFIER_0123456789', runStatus: 'RUNNING' },
      ],
    })),
  },
}))
const slot = { template: '<div><slot /><slot name="actions" /></div>' }

describe('RunsOverview', () => {
  it('仅可筛选统计卡显示按钮语义，并支持空格键切换筛选', async () => {
    const wrapper = mount(RunsOverview, {
      global: {
        directives: { loading: () => {} },
        stubs: {
          PageContainer: slot,
          PageHeader: slot,
          StatusSegment: true,
          ElButton: { template: '<button><slot /></button>' },
          ElPopover: { template: '<span><slot name="reference" /><slot /></span>' },
          ElIcon: { template: '<span><slot /></span>' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })
    await flushPromises()
    const cards = wrapper.findAll('.ro-stat')
    expect(cards.map((card) => card.attributes('role'))).toEqual([
      'button',
      undefined,
      'button',
      undefined,
    ])
    expect(cards[1].attributes('tabindex')).toBeUndefined()
    expect(cards[3].attributes('tabindex')).toBeUndefined()
    expect(cards[0].attributes('aria-pressed')).toBe('false')
    await cards[0].trigger('keyup', { key: ' ' })
    expect(cards[0].attributes('aria-pressed')).toBe('true')
    await cards[0].trigger('keyup', { key: ' ' })
    expect(cards[0].attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })

  it('为每条运行提供键盘可达的详情链接和只读完整编码', async () => {
    state.push.mockClear()
    const wrapper = mount(RunsOverview, {
      global: {
        directives: { loading: () => {} },
        stubs: {
          PageContainer: slot,
          PageHeader: slot,
          StatusSegment: true,
          ElButton: { template: '<button><slot /></button>' },
          ElPopover: { template: '<span><slot name="reference" /><slot /></span>' },
          ElIcon: { template: '<span><slot /></span>' },
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    })
    await flushPromises()
    expect(wrapper.find('.ro-row--job a[href="/monitor/job-instances/7"]').exists()).toBe(true)
    expect(wrapper.find('.ro-row--wf a[href="/monitor/workflow-runs/8"]').exists()).toBe(true)
    const viewers = wrapper.findAllComponents(CopyableText)
    expect(viewers.map((viewer) => [viewer.props('text'), viewer.props('copyable')])).toEqual([
      ['JOB_LONG_IDENTIFIER_0123456789', false],
      ['NODE_LONG_IDENTIFIER_0123456789', false],
    ])
    await viewers[0].get('button').trigger('click')
    expect(state.push).not.toHaveBeenCalled()
    await wrapper.get('.ro-row--job').trigger('click')
    expect(state.push).toHaveBeenCalledWith('/monitor/job-instances/7')
    wrapper.unmount()
  })
})
