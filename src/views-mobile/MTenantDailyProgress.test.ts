// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { ref } from 'vue'
import MTenantDailyProgress from './MTenantDailyProgress.vue'

const state = vi.hoisted(() => ({ progress: null as unknown, refresh: vi.fn() }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useDailyProgress', () => ({
  useDailyProgress: () => ({
    progress: state.progress,
    status: ref('live'),
    loading: ref(false),
    error: ref(null),
    lastRefreshedAt: ref(null),
    refresh: state.refresh,
  }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
enableAutoUnmount(afterEach)

describe('移动租户每日进度', () => {
  it('计划覆盖不全时不展示计划百分比，其他层按自身分母展示', () => {
    state.progress = ref({
      coverage: { scheduledDefinitions: 2, uncoveredDefinitions: 1 },
      counts: [
        { scope: 'SCHEDULED_OCCURRENCE', status: 'SUCCESS', count: 2 },
        { scope: 'JOB_TASK', status: 'SUCCESS', count: 3 },
        { scope: 'JOB_TASK', status: 'RUNNING', count: 1 },
      ],
    })
    const wrapper = mount(MTenantDailyProgress, {
      global: {
        stubs: {
          LiveStatusBadge: true,
          ElProgress: {
            props: ['percentage'],
            template: '<div class="progress-bar">{{ percentage }}%</div>',
          },
        },
      },
    })
    const planned = wrapper.get('[data-scope="SCHEDULED_OCCURRENCE"]')
    expect(planned.text()).toContain('dailyProgress.unknown')
    expect(planned.find('.progress-bar').exists()).toBe(false)
    expect(wrapper.get('[data-scope="JOB_TASK"] .progress-bar').text()).toBe('75%')
    expect(wrapper.text()).toContain('dailyProgress.incomplete')
  })
})
