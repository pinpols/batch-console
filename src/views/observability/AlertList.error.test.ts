// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import AlertList from './AlertList.vue'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ userInfo: { userId: 'reader' } }) }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canMutateConfig: computed(() => false) }),
}))
vi.mock('@/composables/useSavedFilters', () => ({ useSavedFilters: () => ({ sets: ref([]) }) }))
vi.mock('@/composables/useSseAutoReload', () => ({
  useSseAutoReload: () => ({
    status: ref('live'),
    lastRefreshedAt: ref(null),
    markRefreshed: vi.fn(),
  }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))
vi.mock('@/composables/useListFilterFeedback', () => ({
  useListFilterFeedback: (loading: ReturnType<typeof ref>) => ({
    filterBusy: ref(false),
    tableBlocking: loading,
    runSearch: (fn: () => Promise<void>) => fn(),
    runReset: (fn: () => Promise<void>) => fn(),
    runRefresh: (fn: () => Promise<void>) => fn(),
  }),
}))
vi.mock('@/api/alertsQuery', () => ({ queryAlertsPage: mocks.query }))

enableAutoUnmount(afterEach)

describe('AlertList 加载失败', () => {
  it('显示失败而非空结果，刷新成功后恢复空态', async () => {
    mocks.query.mockReset().mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = shallowMount(AlertList, {
      global: {
        stubs: {
          PageContainer: { template: '<main><slot /></main>' },
          PageHeader: true,
          OpsFilterToolbar: { template: '<button @click="$emit(\'refresh\')">refresh</button>' },
        },
      },
    })
    await flushPromises()
    expect(wrapper.find('el-alert-stub').attributes('title')).toBe('alertList.loadFailed')
    expect(wrapper.find('empty-state-stub').exists()).toBe(false)

    mocks.query.mockResolvedValue({ items: [], total: 0 })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('el-alert-stub').exists()).toBe(false)
    expect(wrapper.find('empty-state-stub').exists()).toBe(true)
  })
})
