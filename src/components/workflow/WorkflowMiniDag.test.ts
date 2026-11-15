// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WorkflowMiniDag from './WorkflowMiniDag.vue'

vi.mock('@/utils/mermaid', () => ({
  loadMermaid: async () => ({
    render: async (id: string) => ({
      svg: `<svg><g class="node" id="${id}-flowchart-n0-0"><text>A</text></g><g class="node" id="${id}-flowchart-n1-1"><text>B</text></g><g class="node" id="other-flowchart-n1-2"><text>unrelated</text></g><path class="flowchart-link" id="${id}-edge0"/><path class="flowchart-link" id="${id}-edge1"/><g class="edgeLabel"><text>成功后</text></g><g class="edgeLabel"><text>失败后</text></g></svg>`,
    }),
  }),
}))

enableAutoUnmount(afterEach)

describe('WorkflowMiniDag 节点选择', () => {
  it('允许鼠标和键盘选择冻结图节点，并标记当前选择', async () => {
    const wrapper = mount(WorkflowMiniDag, {
      props: {
        mermaidText: 'flowchart LR\nn0-->n1',
        nodeOptions: [
          { code: 'job-a', label: 'A' },
          { code: 'job-b', label: 'B' },
        ],
        selectedNode: 'job-a',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': {} } })],
        stubs: { DataState: { template: '<div><slot /></div>' }, ElButton: true },
      },
    })
    await flushPromises()
    const nodes = wrapper.findAll('.node')
    expect(nodes[0].attributes('aria-pressed')).toBe('true')
    expect(nodes[2].attributes('role')).toBeUndefined()
    await nodes[2].trigger('click')
    expect(wrapper.emitted('selectNode')).toBeUndefined()
    await nodes[1].trigger('click')
    expect(wrapper.emitted('selectNode')?.[0]).toEqual(['job-b'])
    await nodes[0].trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('selectNode')?.[1]).toEqual(['job-a'])
  })

  it('按 edgeType 给连线与标签添加颜色类', async () => {
    const wrapper = mount(WorkflowMiniDag, {
      props: {
        mermaidText: 'flowchart LR\nn0-->|成功后| n1',
        edgeTypes: ['SUCCESS', 'FAILURE'],
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': {} } })],
        stubs: { DataState: { template: '<div><slot /></div>' }, ElButton: true },
      },
    })
    await flushPromises()
    const paths = wrapper.findAll('path.flowchart-link')
    expect(paths[0].classes()).toContain('edge-type--success')
    expect(paths[1].classes()).toContain('edge-type--failure')
    const labels = wrapper.findAll('.edgeLabel')
    expect(labels[0].classes()).toContain('edge-label--success')
    expect(labels[1].classes()).toContain('edge-label--failure')
  })
})
