// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import QueueConfig from './QueueConfig.vue'
import GovernanceQueueEditor from './GovernanceQueueEditor.vue'

const mocks = vi.hoisted(() => ({
  warning: vi.fn(),
  createQueue: vi.fn(),
  createBatchWindow: vi.fn(),
  createCalendar: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/governance/windows', query: {}, meta: { mode: 'windows' } }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, values?: { label?: string }) => (values ? `${key}|${values.label}` : key),
  }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: vi.fn() }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canAccess: () => true, canWriteSystem: ref(true) }),
}))
vi.mock('@/api/governance', () => ({
  governanceApi: {
    createQueue: mocks.createQueue,
    createBatchWindow: mocks.createBatchWindow,
    createCalendar: mocks.createCalendar,
  },
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: mocks.warning, error: vi.fn() },
}))

const slot = { template: '<div><slot /></div>' }
describe('治理表单校验文案', () => {
  beforeEach(() => {
    mocks.warning.mockReset()
    mocks.createQueue.mockReset()
    mocks.createBatchWindow.mockReset()
    mocks.createCalendar.mockReset()
  })
  it('队列必填错误保留在字段旁，修正输入后清除', async () => {
    const wrapper = shallowMount(QueueConfig, {
      global: { stubs: { PageContainer: slot, ElDrawer: slot, ElForm: slot, ElFormItem: slot } },
    })
    const vm = wrapper.vm as unknown as {
      openQueueCreate: () => void
      saveQueue: () => Promise<void>
      queueForm: { queueCode: string; queueType: string }
      queueValidationErrors: { queueCode: string; queueType: string }
    }
    vm.openQueueCreate()
    await vm.saveQueue()
    expect(vm.queueValidationErrors.queueCode).toBe(
      'queueConfig.requiredField|queueConfig.fieldQueueCode',
    )
    expect(wrapper.findComponent(GovernanceQueueEditor).props('errors')).toEqual(
      vm.queueValidationErrors,
    )
    expect(mocks.createQueue).not.toHaveBeenCalled()
    vm.queueForm.queueCode = 'queue-a'
    expect(vm.queueValidationErrors.queueCode).toBe('')
    vm.queueForm.queueType = ''
    expect(vm.queueValidationErrors.queueType).toBe(
      'queueConfig.requiredField|queueConfig.fieldQueueType',
    )
    vm.openQueueCreate()
    expect(vm.queueValidationErrors).toEqual({ queueCode: '', queueType: '' })
    wrapper.unmount()
  })
  it.each([
    ['openQueueCreate', 'saveQueue', 'fieldQueueCode', 'createQueue'],
    ['openWindowCreate', 'saveWindow', 'fieldWindowCode', 'createBatchWindow'],
    ['openCalendarCreate', 'saveCalendar', 'fieldCalendarCode', 'createCalendar'],
  ] as const)('缺少必填内容时展示表单字段名称', async (open, save, label, api) => {
    const wrapper = shallowMount(QueueConfig, {
      global: { stubs: { PageContainer: slot, ElDrawer: slot, ElForm: slot, ElFormItem: slot } },
    })
    const vm = wrapper.vm as unknown as Record<string, () => Promise<void> | void>
    vm[open]()
    await vm[save]()
    expect(mocks.warning).toHaveBeenCalledWith(`queueConfig.requiredField|queueConfig.${label}`)
    expect(mocks[api]).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
