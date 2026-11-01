// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive, ref } from 'vue'
import WorkflowExecutionPanel from './WorkflowExecutionPanel.vue'

const scope = vi.hoisted(() => ({ tenant: { tenantId: '' }, progress: null as unknown }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => scope.tenant }))
vi.mock('@/composables/useWorkflowExecutionProgress', () => ({
  useWorkflowExecutionProgress: () => ({
    progress: scope.progress,
    status: ref('live'),
    error: ref(null),
    loading: ref(false),
    lastRefreshedAt: ref(null),
    refresh: vi.fn(),
  }),
}))

enableAutoUnmount(afterEach)
describe('WorkflowExecutionPanel 节点联动', () => {
  it('选择节点显示对应明细，切换租户清除选择', async () => {
    scope.tenant = reactive({ tenantId: 'tenant-a' })
    const currentProgress = ref({
      snapshotAvailable: true,
      runStatus: 'RUNNING',
      nodes: [
        { nodeCode: 'a', nodeStatus: 'RUNNING', activeSteps: [] },
        { nodeCode: 'b', nodeStatus: 'WAITING', activeSteps: [] },
      ],
      edges: [],
    })
    scope.progress = currentProgress
    const wrapper = mount(WorkflowExecutionPanel, {
      props: { runId: 1 },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'zh-CN',
            messages: {
              'zh-CN': {
                workflowProgress: {
                  selectedNode: '{node}',
                  clearSelection: 'all',
                  selectNode: '{node}',
                },
              },
            },
            missingWarn: false,
            fallbackWarn: false,
          }),
        ],
        stubs: {
          SectionCard: { template: '<div><slot name="header" /><slot /></div>' },
          DataState: { template: '<div><slot /></div>' },
          WorkflowMiniDag: {
            template:
              '<button data-test="dag" @click="$emit(\'selectNode\', \'b\')">select</button>',
            emits: ['selectNode'],
          },
          ElTable: {
            props: ['data'],
            template: '<div data-test="nodes">{{ data.map(n => n.nodeCode).join(",") }}</div>',
          },
          ElTableColumn: true,
          ElProgress: true,
          ElAlert: true,
          LiveStatusBadge: true,
          ElButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
            emits: ['click'],
          },
        },
      },
    })
    await flushPromises()
    expect(wrapper.get('[data-test="nodes"]').text()).toBe('a,b')
    const waitingShortcut = wrapper.get('.execution-attention button')
    expect(waitingShortcut.text()).toContain('b')
    await waitingShortcut.trigger('click')
    expect(wrapper.get('[data-test="nodes"]').text()).toBe('b')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'all')!
      .trigger('click')
    await wrapper.get('[data-test="dag"]').trigger('click')
    expect(wrapper.get('[data-test="nodes"]').text()).toBe('b')
    scope.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.get('[data-test="nodes"]').text()).toBe('a,b')
    currentProgress.value = { ...currentProgress.value, snapshotAvailable: false }
    await flushPromises()
    expect(wrapper.find('[data-test="dag"]').exists()).toBe(false)
    expect(wrapper.get('el-alert-stub').attributes('title')).toBe('workflowProgress.noSnapshot')
  })
})
