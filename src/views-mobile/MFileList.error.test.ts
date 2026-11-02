// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MFileList from './MFileList.vue'

const mocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/api/file', () => ({ fileApi: { list: mocks.list } }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref(undefined) }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

function mountList() {
  return mount(MFileList, {
    global: {
      stubs: {
        MPullRefresh: { template: '<div><slot /></div>' },
        MSkeleton: true,
        ElSelect: true,
        ElOption: true,
      },
    },
  })
}

describe('移动文件列表加载失败', () => {
  beforeEach(() => mocks.list.mockReset())

  it('首屏失败显示重试而不是空列表，重试后恢复文件', async () => {
    mocks.list.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      records: [{ id: 1, fileName: 'report.csv' }],
      total: 1,
    })
    const wrapper = mountList()
    try {
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text()).toContain('mobile.common.loadFail')
      expect(wrapper.text()).not.toContain('empty.default')
      await wrapper.get('[role="alert"] button').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('report.csv')
      expect(mocks.list.mock.calls.map(([query]) => query.page)).toEqual([1, 1])
    } finally {
      wrapper.unmount()
    }
  })

  it('后续页失败保留已加载文件并重试失败页', async () => {
    mocks.list
      .mockResolvedValueOnce({ records: [{ id: 1, fileName: 'first.csv' }], total: 2 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ records: [{ id: 2, fileName: 'second.csv' }], total: 2 })
    const wrapper = mountList()
    try {
      await flushPromises()
      await wrapper.get('.m-sentinel button').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('first.csv')
      expect(wrapper.get('[role="alert"]').text()).toContain('mobile.common.loadFail')
      await wrapper.get('[role="alert"] button').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('second.csv')
      expect(mocks.list.mock.calls.map(([query]) => query.page)).toEqual([1, 2, 2])
    } finally {
      wrapper.unmount()
    }
  })
})
