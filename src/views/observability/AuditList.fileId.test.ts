// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import AuditList from './AuditList.vue'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/api/observabilityQueries', () => ({ queryAuditsPage: mocks.query }))
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

enableAutoUnmount(afterEach)

describe('审计日志文件 ID 筛选', () => {
  beforeEach(() => mocks.query.mockReset().mockResolvedValue({ items: [], total: 0 }))

  it.each(['9223372036854775807', 'abc', '0'])('保留输入 %s 供服务端筛选或校验', async (fileId) => {
    const wrapper = shallowMount(AuditList, {
      global: {
        stubs: {
          PageContainer: { template: '<main><slot /></main>' },
          PageHeader: true,
          SectionCard: { template: '<section><slot /></section>' },
          ProTable: { template: '<div><slot name="query" /></div>' },
          ListPageQueryBar: {
            template: '<div><slot /><button @click="$emit(\'search\')">search</button></div>',
          },
          ElFormItem: { template: '<div><slot /></div>' },
          ElInput: {
            props: ['modelValue', 'placeholder'],
            template:
              '<input :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
        },
      },
    })
    await flushPromises()
    await wrapper.get('input[placeholder="auditList.fileIdPlaceholder"]').setValue(` ${fileId} `)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.query).toHaveBeenLastCalledWith(
      'tenant-a',
      1,
      15,
      expect.objectContaining({ fileId }),
    )
  })
})
