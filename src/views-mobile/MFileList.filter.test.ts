// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import MFileList from './MFileList.vue'
import CopyableText from '@/components/common/CopyableText.vue'

const mocks = vi.hoisted(() => ({ list: vi.fn().mockResolvedValue({ records: [], total: 0 }) }))
let provideEnums = true
vi.mock('@/api/file', () => ({ fileApi: { list: mocks.list } }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({
    data: ref(
      provideEnums
        ? {
            fileStatus: [
              { value: 'RECEIVED', label: 'Received' },
              { value: 'LOADED', label: 'Loaded' },
              { value: 'DISPATCHED', label: 'Dispatched' },
              { value: 'FAILED', label: 'Failed' },
            ],
          }
        : undefined,
    ),
  }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
const select = {
  props: ['modelValue', 'options'],
  emits: ['update:modelValue'],
  template:
    '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option><slot /></select>',
}
const option = {
  props: ['value', 'label'],
  template: '<option :value="value">{{ label }}</option>',
}

describe('移动文件状态筛选', () => {
  it('保留 Trace 摘要并可只读查看已返回的完整值，空值不显示入口', async () => {
    const traceId = 'trace-' + 'a'.repeat(80)
    mocks.list.mockResolvedValueOnce({
      records: [
        { id: 11, fileName: 'with-trace.csv', traceId },
        { id: 12, fileName: 'without-trace.csv', traceId: null },
      ],
      total: 2,
    })
    const wrapper = mount(MFileList, {
      global: {
        stubs: {
          MPullRefresh: { template: '<div><slot /></div>' },
          MSkeleton: true,
          ElSegmented: select,
          ElSelect: select,
          ElOption: option,
          ElPopover: { template: '<span><slot name="reference" /></span>' },
          ElIcon: true,
        },
      },
    })
    try {
      await flushPromises()
      const cards = wrapper.findAll('.m-card')
      expect(cards[0].text()).toContain(traceId.slice(0, 8))
      const preview = cards[0].getComponent(CopyableText)
      expect(preview.props('text')).toBe(traceId)
      expect(preview.props('copyable')).toBe(false)
      expect(cards[1].findComponent(CopyableText).exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('字典不可用时仍可按真实状态筛选', async () => {
    provideEnums = false
    const wrapper = mount(MFileList, {
      global: {
        stubs: {
          MPullRefresh: { template: '<div><slot /></div>' },
          MSkeleton: true,
          ElSegmented: select,
          ElSelect: select,
          ElOption: option,
        },
      },
    })
    try {
      await flushPromises()
      const filter = wrapper.get('select')
      expect(filter.findAll('option').map((item) => item.attributes('value'))).toContain('LOADED')
      await filter.setValue('LOADED')
      await flushPromises()
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ tenantId: 'tenant-a', fileStatus: 'LOADED' }),
      )
    } finally {
      wrapper.unmount()
      provideEnums = true
    }
  })

  it('展示服务端状态并按所选真实状态请求文件', async () => {
    const wrapper = mount(MFileList, {
      global: {
        stubs: {
          MPullRefresh: { template: '<div><slot /></div>' },
          MSkeleton: true,
          ElSegmented: select,
          ElSelect: select,
          ElOption: option,
        },
      },
    })
    await flushPromises()
    const filter = wrapper.get('select')
    const values = filter.findAll('option').map((item) => item.attributes('value'))
    expect(values).toEqual(['', 'RECEIVED', 'LOADED', 'DISPATCHED', 'FAILED'])
    await filter.setValue('LOADED')
    await flushPromises()
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', page: 1, fileStatus: 'LOADED' }),
    )
    await filter.setValue('')
    await flushPromises()
    expect(mocks.list).toHaveBeenLastCalledWith({ tenantId: 'tenant-a', page: 1, pageSize: 15 })
    wrapper.unmount()
  })

  it('按实际文件状态呈现阶段颜色，未知状态保持中性', async () => {
    mocks.list.mockResolvedValueOnce({
      records: [
        { id: 1, fileName: 'loading.csv', fileStatus: 'PARSING' },
        { id: 2, fileName: 'loaded.csv', fileStatus: 'LOADED' },
        { id: 3, fileName: 'failed.csv', fileStatus: 'FAILED' },
        { id: 4, fileName: 'future.csv', fileStatus: 'FUTURE_STATUS' },
      ],
      total: 4,
    })
    const wrapper = mount(MFileList, {
      global: {
        stubs: {
          MPullRefresh: { template: '<div><slot /></div>' },
          MSkeleton: true,
          ElSegmented: select,
          ElSelect: select,
          ElOption: option,
        },
      },
    })
    await flushPromises()
    const cards = wrapper.findAll('.m-card')
    expect(cards[0].get('.m-chip').classes()).toContain('m-chip--info')
    expect(cards[1].get('.m-chip').classes()).toContain('m-chip--success')
    expect(cards[2].get('.m-chip').classes()).toContain('m-chip--danger')
    expect(cards[3].get('.m-chip').classes()).toEqual(['m-chip'])
    wrapper.unmount()
  })
})
