// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import messages from '@/locales/zh-CN'
import Graph from './WaitRelationshipGraph.vue'

const api = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/api/dependencyWaits', () => ({ listWaitRelationships: api.list }))
const PassThrough = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.())
  },
})
const AlertStub = defineComponent({
  props: { title: String },
  setup(props) {
    return () => h('div', props.title)
  },
})
const wait = (id: string, subjectCode: string) => ({
  id,
  waitType: 'JOB',
  tenantId: 'tenant-a',
  subjectCode,
  bizDate: '2026-11-01',
  waitStatus: 'WAITING',
  dependencySnapshotValid: true,
  dependencySnapshot: '[{"upstreamJobCode":"UPSTREAM"}]',
  updatedAt: '2026-11-01T00:00:00Z',
})
function render() {
  return mount(Graph, {
    props: { tenantId: 'tenant-a' },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': messages } })],
      stubs: {
        ...Object.fromEntries(
          [
            'ElForm',
            'ElFormItem',
            'ElSelect',
            'ElOption',
            'ElButton',
            'ElAlert',
            'ElTag',
            'ElEmpty',
            'ElPagination',
          ].map((name) => [name, PassThrough]),
        ),
        ElAlert: AlertStub,
        WorkflowMiniDag: defineComponent({
          props: { mermaidText: String },
          setup(props) {
            return () => h('pre', { 'data-testid': 'topology' }, props.mermaidText)
          },
        }),
      },
    },
  })
}
describe('等待关系图', () => {
  beforeEach(() => api.list.mockReset())
  it('traverses every cursor page instead of stopping at 200', async () => {
    api.list
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, i) => wait(String(i + 1), 'A')),
        hasMore: true,
        nextCursorType: 'JOB',
        nextCursorId: '100',
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, i) => wait(String(i + 101), 'B')),
        hasMore: true,
        nextCursorType: 'JOB',
        nextCursorId: '200',
      })
      .mockResolvedValueOnce({ items: [wait('201', 'C')], hasMore: false })
    const wrapper = render()
    await flushPromises()
    expect(api.list).toHaveBeenCalledTimes(3)
    expect(api.list.mock.calls[2][0]).toMatchObject({ cursorType: 'JOB', cursorId: '200' })
    expect(wrapper.text()).toContain('201 条等待记录')
    wrapper.unmount()
  })
  it('draws connected chains from all pages while preserving per-record details', async () => {
    const first = {
      ...wait('1', 'B'),
      dependencySnapshot: '[{"upstreamJobCode":"A","bizDateAlignment":"SAME_DAY"}]',
    }
    const second = {
      ...wait('2', 'C'),
      dependencySnapshot: '[{"upstreamJobCode":"B","bizDateAlignment":"SAME_DAY"}]',
    }
    api.list
      .mockResolvedValueOnce({
        items: [first],
        hasMore: true,
        nextCursorType: 'JOB',
        nextCursorId: '1',
      })
      .mockResolvedValueOnce({ items: [second], hasMore: false })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-testid="topology"]').text()).toContain('n1 --> n0')
    expect(wrapper.get('[data-testid="topology"]').text()).toContain('n0 --> n2')
    expect(wrapper.text()).toContain('逐条等待明细')
    wrapper.unmount()
  })
  it('never displays recognizable text from an explicitly invalid snapshot', async () => {
    api.list.mockResolvedValue({
      items: [
        {
          ...wait('1', 'A'),
          dependencySnapshotValid: false,
          dependencySnapshot: '[{"upstreamJobCode":"secret-data"}]',
        },
      ],
      hasMore: false,
    })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).not.toContain('secret-data')
    expect(wrapper.text()).toContain('整体拓扑存在缺失')
    wrapper.unmount()
  })
  it('shows distinct actual statuses on the node and marks upstream status unprovided', async () => {
    const waiting = {
      ...wait('1', 'B'),
      dependencySnapshot: '[{"upstreamJobCode":"A","bizDateAlignment":"SAME_DAY"}]',
    }
    api.list.mockResolvedValue({
      items: [waiting, { ...waiting, id: '2', waitStatus: 'RELEASED' }, { ...waiting, id: '3' }],
      hasMore: false,
    })
    const wrapper = render()
    await flushPromises()
    const text = wrapper.get('[data-testid="topology"]').text()
    expect(text).toContain('状态：等待中, 已满足')
    expect(text).toContain('状态：未提供')
    wrapper.unmount()
  })
  it('suppresses an oversized topology and keeps the paginated details', async () => {
    const capacity = (id: string) => ({
      ...wait(id, 'WF'),
      waitType: 'CAPACITY_ADMISSION',
      dependencySnapshot: null,
    })
    api.list
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, i) => capacity(String(i + 1))),
        hasMore: true,
        nextCursorType: 'CAPACITY_ADMISSION',
        nextCursorId: '100',
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 51 }, (_, i) => capacity(String(i + 101))),
        hasMore: false,
      })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('关系过多，无法安全绘制整体拓扑')
    expect(wrapper.text()).toContain('逐条等待明细')
    expect(wrapper.find('[data-testid="topology"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('does not draw a partial topology if cursor traversal fails', async () => {
    api.list
      .mockResolvedValueOnce({
        items: [wait('1', 'A')],
        hasMore: true,
        nextCursorType: 'JOB',
        nextCursorId: '1',
      })
      .mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('读取中断，当前结果不完整')
    expect(wrapper.find('[data-testid="topology"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('discards late results after the tenant changes', async () => {
    let resolveOld!: (value: unknown) => void
    api.list
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve
          }),
      )
      .mockResolvedValueOnce({ items: [wait('2', 'NEW')], hasMore: false })
    const wrapper = render()
    await wrapper.setProps({ tenantId: 'tenant-b' })
    await flushPromises()
    resolveOld({ items: [wait('1', 'OLD')], hasMore: false })
    await flushPromises()
    expect(wrapper.text()).toContain('NEW')
    expect(wrapper.text()).not.toContain('OLD')
    wrapper.unmount()
  })
  it('marks invalid cursor results as incomplete', async () => {
    api.list.mockResolvedValue({ items: [wait('1', 'A')], hasMore: true })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('读取中断，当前结果不完整')
    expect(wrapper.text()).toContain('1 条等待记录')
    expect(api.list).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('stops when a server cursor repeats after another page', async () => {
    api.list
      .mockResolvedValueOnce({
        items: [wait('1', 'A')],
        hasMore: true,
        nextCursorType: 'JOB',
        nextCursorId: '1',
      })
      .mockResolvedValueOnce({
        items: [wait('2', 'B')],
        hasMore: true,
        nextCursorType: 'JOB',
        nextCursorId: '2',
      })
      .mockResolvedValueOnce({
        items: [wait('1', 'A')],
        hasMore: true,
        nextCursorType: 'JOB',
        nextCursorId: '1',
      })
    const wrapper = render()
    await flushPromises()
    expect(api.list).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).toContain('读取中断，当前结果不完整')
    expect(wrapper.find('[data-testid="topology"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('warns about an invalid snapshot without displaying its contents', async () => {
    api.list.mockResolvedValue({
      items: [
        { ...wait('1', 'A'), dependencySnapshotValid: false, dependencySnapshot: 'secret-data' },
      ],
      hasMore: false,
    })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('部分依赖无法解析')
    expect(wrapper.text()).not.toContain('secret-data')
    wrapper.unmount()
  })
})
