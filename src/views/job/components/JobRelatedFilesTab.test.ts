// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import JobRelatedFilesTab from './JobRelatedFilesTab.vue'

const mocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/api/file', () => ({ fileApi: { listRelatedToJob: mocks.list } }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
enableAutoUnmount(afterEach)

describe('作业关联文件请求隔离', () => {
  it('切换作业后旧请求的迟到结果不能覆盖当前作业', async () => {
    let resolveFirst!: (value: unknown) => void
    mocks.list
      .mockReset()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
      )
      .mockResolvedValueOnce({ items: [{ id: 2, fileName: 'current.csv' }], total: 1 })
    const wrapper = shallowMount(JobRelatedFilesTab, {
      props: { tenantId: 'tenant-a', jobCode: 'old' },
    })
    await wrapper.setProps({ jobCode: 'new' })
    await flushPromises()
    resolveFirst({ items: [{ id: 1, fileName: 'stale.csv' }], total: 1 })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElTable' }).props('data')).toEqual([
      { id: 2, fileName: 'current.csv' },
    ])
  })
  it('租户清空时失效在途请求并清空列表', async () => {
    let resolveFirst!: (value: unknown) => void
    mocks.list.mockReset().mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve
      }),
    )
    const wrapper = shallowMount(JobRelatedFilesTab, {
      props: { tenantId: 'tenant-a', jobCode: 'old' },
    })
    await wrapper.setProps({ tenantId: '' })
    resolveFirst({ items: [{ id: 1, fileName: 'stale.csv' }], total: 1 })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElTable' }).props('data')).toEqual([])
    expect(wrapper.findComponent({ name: 'ElButton' }).props('loading')).toBe(false)
    expect(wrapper.text()).not.toContain('jobRelatedFiles.empty')
  })
  it('查询失败显示错误而非无关联文件，重试成功后恢复', async () => {
    mocks.list
      .mockReset()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ items: [{ id: 2, fileName: 'recovered.csv' }], total: 1 })
    const wrapper = shallowMount(JobRelatedFilesTab, {
      props: { tenantId: 'tenant-a', jobCode: 'job' },
    })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElAlert' }).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('jobRelatedFiles.empty')
    wrapper.findComponent({ name: 'ElButton' }).vm.$emit('click')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElAlert' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'ElTable' }).props('data')).toEqual([
      { id: 2, fileName: 'recovered.csv' },
    ])
  })
  it('旧作业请求失败不会覆盖当前作业的结果和错误状态', async () => {
    let rejectFirst!: (error: Error) => void
    mocks.list
      .mockReset()
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectFirst = reject
        }),
      )
      .mockResolvedValueOnce({ items: [{ id: 2, fileName: 'current.csv' }], total: 1 })
    const wrapper = shallowMount(JobRelatedFilesTab, {
      props: { tenantId: 'tenant-a', jobCode: 'old' },
    })
    await wrapper.setProps({ jobCode: 'new' })
    await flushPromises()
    rejectFirst(new Error('old request failed'))
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElAlert' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'ElTable' }).props('data')).toEqual([
      { id: 2, fileName: 'current.csv' },
    ])
  })
})
