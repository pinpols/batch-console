// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import WorkflowMermaidViewer from './WorkflowMermaidViewer.vue'

vi.mock('@/api/workflow', () => ({
  workflowApi: {
    detailById: async () => ({
      workflowCode: 'test',
      nodes: [{ nodeCode: 'A', nodeName: '节点 A' }],
    }),
    mermaid: async () => ({ mermaid: 'flowchart LR\nA[节点 A]' }),
  },
}))
vi.mock('@/utils/mermaid', () => ({
  loadMermaid: async () => ({
    render: async (id: string) => ({
      svg: `<svg id="${id}"><g class="node" id="${id}-flowchart-A-0"><text>节点 A</text></g></svg>`,
    }),
  }),
}))
vi.mock('svg-pan-zoom', () => ({
  default: () => ({ destroy: vi.fn(), resize: vi.fn() }),
}))

enableAutoUnmount(afterEach)

describe('WorkflowMermaidViewer 节点详情', () => {
  it('点击带渲染前缀的节点后打开对应详情', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/workflow/:id', name: 'workflow-viewer', component: WorkflowMermaidViewer },
      ],
    })
    await router.push('/workflow/1')
    await router.isReady()
    const wrapper = mount(WorkflowMermaidViewer, {
      global: {
        plugins: [
          createPinia(),
          router,
          createI18n({
            legacy: false,
            locale: 'zh-CN',
            messages: { 'zh-CN': {} },
            missingWarn: false,
          }),
        ],
        stubs: {
          PageContainer: { template: '<main><slot /></main>' },
          PageHeader: true,
          SectionCard: { template: '<section><slot name="header" /><slot /></section>' },
          DataState: { template: '<div><slot /></div>' },
          ElButton: true,
          ElTooltip: { template: '<span><slot /></span>' },
          ElTag: { template: '<span><slot /></span>' },
          ElDescriptions: { template: '<div><slot /></div>' },
          ElDescriptionsItem: { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()
    expect(wrapper.find('.inspector-title').exists()).toBe(false)
    await wrapper.get('.workflow-mermaid-graph .node').trigger('click')
    expect(wrapper.get('.inspector-title').text()).toBe('A · 节点 A')
  })
})
