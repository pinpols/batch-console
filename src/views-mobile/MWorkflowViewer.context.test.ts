// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import MWorkflowViewer from './MWorkflowViewer.vue'

const mocks = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  route: null as unknown as { params: { id: string } },
  detail: vi.fn(),
  mermaid: vi.fn(),
  render: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('vue-router', () => ({ useRoute: () => mocks.route }))
vi.mock('vue-i18n', async (original) => ({ ...(await original<typeof import('vue-i18n')>()), useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/api/workflow', () => ({ workflowApi: { detailById: mocks.detail, mermaid: mocks.mermaid } }))
vi.mock('@/composables/useSmartBack', () => ({ useSmartBack: () => vi.fn() }))
vi.mock('@/utils/mermaid', () => ({ loadMermaid: async () => ({ render: mocks.render }) }))


enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.route = reactive({ params: { id: '1' } })
  mocks.detail.mockReset()
  mocks.mermaid.mockReset()
  mocks.render.mockReset().mockImplementation(async (_id: string, text: string) => ({ svg: text }))
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
function setup() {
  return shallowMount(MWorkflowViewer, { global: { stubs: { MPullRefresh: { template: '<div><slot /></div>' } } } })
}
function detail(name: string) { return { workflowCode: name, workflowName: name, nodes: [] } }

describe('mobile workflow definition context', () => {
  it('keeps the new tenant loading until its result and ignores the late old tenant', async () => {
    const oldDetail = deferred<ReturnType<typeof detail>>()
    const oldGraph = deferred<{ mermaid: string }>()
    const newDetail = deferred<ReturnType<typeof detail>>()
    const newGraph = deferred<{ mermaid: string }>()
    mocks.detail.mockReturnValueOnce(oldDetail.promise).mockReturnValueOnce(newDetail.promise)
    mocks.mermaid.mockReturnValueOnce(oldGraph.promise).mockReturnValueOnce(newGraph.promise)
    const wrapper = setup()
    mocks.tenant.tenantId = 'tenant-b'
    await wrapper.vm.$nextTick()
    expect(mocks.detail).toHaveBeenNthCalledWith(2, 1, 'tenant-b')
    oldDetail.resolve(detail('OLD'))
    oldGraph.resolve({ mermaid: 'old-graph' })
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.common.loading')
    expect(wrapper.text()).not.toContain('OLD')
    newDetail.resolve(detail('NEW'))
    newGraph.resolve({ mermaid: 'new-graph' })
    await flushPromises()
    expect(wrapper.text()).toContain('NEW')
    expect(wrapper.text()).toContain('new-graph')
    expect(wrapper.text()).not.toContain('OLD')
  })

  it('clears the previous definition immediately and ignores a late render after navigating', async () => {
    const oldRender = deferred<{ svg: string }>()
    mocks.detail.mockResolvedValueOnce(detail('OLD')).mockResolvedValueOnce(detail('NEW'))
    mocks.mermaid.mockResolvedValueOnce({ mermaid: 'old-graph' }).mockResolvedValueOnce({ mermaid: 'new-graph' })
    mocks.render.mockReturnValueOnce(oldRender.promise).mockResolvedValueOnce({ svg: 'new-graph' })
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.text()).toContain('OLD')
    mocks.route.params.id = '2'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('OLD')
    await flushPromises()
    expect(wrapper.text()).toContain('NEW')
    expect(wrapper.text()).toContain('new-graph')
    oldRender.resolve({ svg: 'old-graph' })
    await flushPromises()
    expect(wrapper.text()).toContain('new-graph')
    expect(wrapper.text()).not.toContain('old-graph')
  })

  it('keeps a completed new tenant result when the previous tenant finishes later', async () => {
    const oldDetail = deferred<ReturnType<typeof detail>>()
    const oldGraph = deferred<{ mermaid: string }>()
    mocks.detail.mockReturnValueOnce(oldDetail.promise).mockResolvedValueOnce(detail('NEW'))
    mocks.mermaid.mockReturnValueOnce(oldGraph.promise).mockResolvedValueOnce({ mermaid: 'new-graph' })
    const wrapper = setup()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.text()).toContain('NEW')
    oldDetail.resolve(detail('OLD'))
    oldGraph.resolve({ mermaid: 'old-graph' })
    await flushPromises()
    expect(wrapper.text()).toContain('NEW')
    expect(wrapper.text()).toContain('new-graph')
    expect(wrapper.text()).not.toContain('OLD')
    expect(wrapper.text()).not.toContain('old-graph')
  })

  it('opens the matching node sheet for the current Mermaid render only', async () => {
    mocks.detail.mockResolvedValue({
      workflowCode: 'WF',
      nodes: [{ nodeCode: 'task-A', nodeName: 'Current Task' }, { nodeCode: 'task-B', nodeName: 'Other Task' }],
    })
    mocks.mermaid.mockResolvedValue({ mermaid: 'graph' })
    mocks.render.mockImplementation(async (id: string) => ({
      svg: `<svg xmlns="http://www.w3.org/2000/svg"><g class="node" id="${id}-flowchart-task_A-0"/><g class="node" id="other-flowchart-task_B-1"/></svg>`,
    }))
    const wrapper = setup()
    await flushPromises()
    const nodes = wrapper.findAll('g.node')
    expect(nodes).toHaveLength(2)
    await nodes[1].trigger('click')
    expect(wrapper.find('.m-sheet').exists()).toBe(false)
    await nodes[0].trigger('click')
    expect(wrapper.get('.m-sheet').text()).toContain('Current Task')
  })

  it('clears the previous definition when the target id becomes invalid', async () => {
    mocks.detail.mockResolvedValue(detail('OLD'))
    mocks.mermaid.mockResolvedValue({ mermaid: 'old-graph' })
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.text()).toContain('OLD')
    mocks.route.params.id = 'invalid'
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.workflowViewer.invalidId')
    expect(wrapper.text()).not.toContain('OLD')
    expect(wrapper.text()).not.toContain('old-graph')
    expect(mocks.detail).toHaveBeenCalledTimes(1)
  })

  it('does not restore old tenant data if a new tenant request fails', async () => {
    const oldDetail = deferred<ReturnType<typeof detail>>()
    const oldGraph = deferred<{ mermaid: string }>()
    mocks.detail.mockReturnValueOnce(oldDetail.promise).mockRejectedValueOnce(new Error('new failed'))
    mocks.mermaid.mockReturnValueOnce(oldGraph.promise).mockResolvedValueOnce({ mermaid: 'new-graph' })
    const wrapper = setup()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    oldDetail.resolve(detail('OLD'))
    oldGraph.resolve({ mermaid: 'old-graph' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('OLD')
    expect(wrapper.text()).not.toContain('old-graph')
    expect(wrapper.find('.m-empty').exists()).toBe(true)
  })
})
