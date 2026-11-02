// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import MJobInstances from './MJobInstances.vue'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  copy: vi.fn(),
  push: vi.fn(),
  tenant: null as unknown as { tenantId: string },
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/api/instance', () => ({ instanceApi: { list: mocks.list } }))
vi.mock('@/composables/useCopy', () => ({ useCopy: () => ({ copy: mocks.copy }) }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/m/jobs', query: {} }),
  useRouter: () => ({ replace: vi.fn(), push: mocks.push }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.copy.mockReset()
  mocks.push.mockReset()
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.list.mockReset().mockResolvedValue({
    records: [{ id: 42, jobCode: 'JOB_A', instanceNo: 'INSTANCE_42', instanceStatus: 'COMPLETED' }],
    total: 1,
    hasMore: false,
  })
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('移动作业卡片的键盘入口', () => {
  it('复制实例号不触发详情，详情按钮及卡片均只打开一次', async () => {
    const wrapper = shallowMount(MJobInstances, {
      attachTo: document.body,
      global: { stubs: { MPullRefresh: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()

    const copy = wrapper.get('.m-copy-text')
    expect(copy.element.tagName).toBe('BUTTON')
    expect(copy.attributes('type')).toBe('button')
    expect(copy.attributes('aria-label')).toContain('INSTANCE_42')
    ;(copy.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(copy.element)
    await copy.trigger('click')
    expect(mocks.copy).toHaveBeenCalledExactlyOnceWith('INSTANCE_42', 'instanceNo')
    expect(mocks.push).not.toHaveBeenCalled()

    const detail = wrapper.get('.m-job-card__detail')
    expect(detail.element.tagName).toBe('BUTTON')
    expect(detail.attributes('type')).toBe('button')
    expect(detail.attributes('aria-label')).toContain('JOB_A')
    ;(detail.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(detail.element)
    await detail.trigger('click')
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/m/jobs/42')
    await wrapper.get('.m-card--clickable').trigger('click')
    expect(mocks.push).toHaveBeenCalledTimes(2)
  })
})
