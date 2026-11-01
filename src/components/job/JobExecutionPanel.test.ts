// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import JobExecutionPanel from './JobExecutionPanel.vue'

const state = vi.hoisted(() => ({ progress: null as unknown }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useJobExecutionProgress', () => ({
  useJobExecutionProgress: () => ({
    progress: state.progress,
    status: ref('live'),
    error: ref(null),
    loading: ref(false),
    lastRefreshedAt: ref(null),
  }),
}))
enableAutoUnmount(afterEach)
describe('Job 阶段快捷选择', () => {
  it('从失败阶段定位到对应明细，其他阶段仍可恢复查看', async () => {
    state.progress = ref({
      instanceStatus: 'RUNNING',
      stageGraphAvailable: true,
      stages: [
        { stageCode: 'IMPORT', stageStatus: 'FAILED' },
        { stageCode: 'EXPORT', stageStatus: 'WAITING' },
        { stageCode: 'UNKNOWN', stageStatus: 'FUTURE_STATE' },
      ],
      counts: [],
    })
    const wrapper = mount(JobExecutionPanel, {
      props: { jobId: 123 },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'zh-CN',
            messages: {
              'zh-CN': {
                workflowProgress: {
                  attentionTitle: '关注节点',
                  clearSelection: 'all',
                  selectedNode: '{node}',
                  selectNode: '{node}',
                  states: { FAILED: '失败', WAITING: '等待' },
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
          ElTable: {
            props: ['data'],
            template: '<div data-test="stages">{{ data.map(s => s.stageCode).join(",") }}</div>',
          },
          ElButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
            emits: ['click'],
          },
          ElTableColumn: true,
          ElProgress: true,
          ElAlert: true,
          LiveStatusBadge: true,
          WorkflowMiniDag: true,
          WorkflowExecutionPanel: true,
        },
      },
    })
    await flushPromises()
    expect(wrapper.get('[data-test="stages"]').text()).toBe('IMPORT,EXPORT,UNKNOWN')
    const buttons = wrapper.findAll('.execution-attention button')
    expect(buttons).toHaveLength(2)
    await buttons[0].trigger('click')
    expect(wrapper.get('[data-test="stages"]').text()).toBe('IMPORT')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'all')!
      .trigger('click')
    expect(wrapper.get('[data-test="stages"]').text()).toBe('IMPORT,EXPORT,UNKNOWN')
  })
})
