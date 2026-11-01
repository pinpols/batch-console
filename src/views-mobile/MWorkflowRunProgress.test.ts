// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import MWorkflowRunProgress from './MWorkflowRunProgress.vue'

const state = vi.hoisted(() => ({ route: { params: { id: '42' } }, refresh: vi.fn() }))
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => state.route,
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/composables/useSmartBack', () => ({ useSmartBack: () => vi.fn() }))
enableAutoUnmount(afterEach)

describe('移动 Workflow 运行页', () => {
  it('运行 ID 传给执行快照面板，下拉刷新使用同一面板', async () => {
    state.route = reactive({ params: { id: '42' } })
    const wrapper = mount(MWorkflowRunProgress, {
      global: {
        stubs: {
          MPullRefresh: {
            props: ['onRefresh'],
            template:
              '<div><button data-test="refresh" @click="onRefresh">refresh</button><slot /></div>',
          },
          WorkflowExecutionPanel: {
            name: 'WorkflowExecutionPanel',
            props: ['runId'],
            methods: { refresh: state.refresh },
            template: '<div data-test="run">{{ runId }}</div>',
          },
          ElIcon: { template: '<span><slot /></span>' },
        },
      },
    })
    expect(wrapper.get('[data-test="run"]').text()).toBe('42')
    await wrapper.get('[data-test="refresh"]').trigger('click')
    expect(state.refresh).toHaveBeenCalledOnce()
    state.route.params.id = 'invalid'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="run"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('mobile.workflowViewer.invalidId')
  })
})
