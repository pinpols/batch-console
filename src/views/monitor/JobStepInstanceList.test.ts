// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import JobStepInstanceList from './JobStepInstanceList.vue'

const mocks = vi.hoisted(() => ({ query: vi.fn(), routeQuery: {} as Record<string, string> }))
vi.mock('@/api/jobStepInstances', () => ({ queryJobStepInstancePage: mocks.query }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/composables/useTenantReload', () => ({
  useTenantReload: (load: () => Promise<void>) => void load().catch(() => {}),
}))
vi.mock('@/composables/queries/useConsoleMeta', async () => {
  const { ref } = await import('vue')
  return { useConsoleMetaEnumsQuery: () => ({ data: ref({}) }) }
})
vi.mock('@/composables/useListFilterFeedback', async () => {
  const { ref } = await import('vue')
  return {
    useListFilterFeedback: () => ({
      filterBusy: ref(false),
      runSearch: (fn: () => Promise<void>) => fn().catch(() => {}),
      runReset: (fn: () => Promise<void>) => fn().catch(() => {}),
      runRefresh: (fn: () => Promise<void>) => fn().catch(() => {}),
    }),
  }
})
const pass = { template: '<section><slot /></section>' }
const stubs = {
  PageContainer: pass,
  PageHeader: true,
  ProTable: {
    name: 'ProTable',
    props: ['error'],
    emits: ['change', 'update:page', 'update:pageSize'],
    template:
      '<section><slot name="query" /><span v-if="error" class="error">{{ error.message }}</span></section>',
  },
  ListPageQueryBar: {
    template:
      '<div><slot /><button class="search" @click="$emit(\'search\')">Search</button><button class="reset" @click="$emit(\'reset\')">Reset</button><button class="refresh" @click="$emit(\'refresh\')">Refresh</button></div>',
  },
  ElFormItem: pass,
  ElAlert: { props: ['title'], template: '<p class="validation">{{ title }}</p>' },
  RouterLink: true,
  ElInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}

describe('作业步骤实例编号筛选', () => {
  beforeEach(() => {
    mocks.routeQuery = {}
    mocks.query.mockReset().mockResolvedValue({ items: [], total: 0 })
  })

  it.each([['instanceId'], ['jobInstanceId']])(
    '从作业运行深链带入 %s 时只查询该实例的步骤',
    async (key) => {
      mocks.routeQuery = { [key]: '614' }
      shallowMount(JobStepInstanceList, { global: { stubs } })
      await flushPromises()
      expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ jobInstanceId: '614' }))
    },
  )

  it.each(['abc', '12.5', '0', '-1', '9223372036854775808'])(
    '拒绝非法编号 %s 并允许清空后恢复查询',
    async (value) => {
      const wrapper = shallowMount(JobStepInstanceList, { global: { stubs } })
      await flushPromises()
      mocks.query.mockClear()
      await wrapper.get('input').setValue(value)
      await wrapper.get('.search').trigger('click')
      await flushPromises()
      expect(mocks.query).not.toHaveBeenCalled()
      expect(wrapper.get('.validation').text()).toBe('monitor.stepInvalidInstanceId')
      await wrapper.get('.refresh').trigger('click')
      wrapper.getComponent({ name: 'ProTable' }).vm.$emit('change')
      await flushPromises()
      expect(mocks.query).not.toHaveBeenCalled()
      await wrapper.get('input').setValue('')
      await wrapper.get('.search').trigger('click')
      await flushPromises()
      expect(mocks.query).toHaveBeenCalled()
      expect(mocks.query).toHaveBeenLastCalledWith(
        expect.objectContaining({ jobInstanceId: undefined }),
      )
      expect(wrapper.find('.validation').exists()).toBe(false)
    },
  )

  it.each(['9007199254740993', '9223372036854775807'])(
    '按原值传递有效 Long 编号 %s',
    async (value) => {
      const wrapper = shallowMount(JobStepInstanceList, { global: { stubs } })
      await flushPromises()
      await wrapper.get('input').setValue(value)
      await wrapper.get('.search').trigger('click')
      await flushPromises()
      expect(mocks.query).toHaveBeenLastCalledWith(
        expect.objectContaining({ jobInstanceId: value }),
      )
      mocks.query.mockClear()
      wrapper.getComponent({ name: 'ProTable' }).vm.$emit('change')
      await flushPromises()
      expect(mocks.query).toHaveBeenLastCalledWith(
        expect.objectContaining({ jobInstanceId: value }),
      )
      await wrapper.get('.reset').trigger('click')
      await flushPromises()
      expect(mocks.query).toHaveBeenLastCalledWith(
        expect.objectContaining({ jobInstanceId: undefined }),
      )
    },
  )
})
