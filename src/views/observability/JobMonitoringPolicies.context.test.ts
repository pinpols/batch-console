// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, inject, provide, reactive, ref, toRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import JobMonitoringPolicies from './JobMonitoringPolicies.vue'

const state = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  auth: null as unknown as { userInfo: { username: string } },
  access: null as unknown as { allowed: boolean; frozen: boolean },
  list: vi.fn(),
  update: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => state.auth }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canMutateConfig: computed(() => state.access.allowed && !state.access.frozen),
  }),
}))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({ ensureWriteAvailable: () => !state.access.frozen }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/job', () => ({
  jobApi: { listDefinitionsPaged: state.list, updateDefinition: state.update },
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, params?: { jobCode?: string }) =>
      key === 'jobMonitoringPolicy.editTitle' ? `${key} ${params?.jobCode}` : key,
    te: () => false,
  }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

enableAutoUnmount(afterEach)
const slots = { template: '<div><slot /><slot name="footer" /></div>' }
const stubs = {
  PageContainer: slots,
  PageHeader: true,
  ListPageQueryBar: true,
  EmptyState: true,
  JobMonitoringFields: true,
  ScheduledPolicySummary: true,
  PolicyValue: true,
  ElDrawer: {
    props: ['modelValue'],
    template: '<aside v-if="modelValue"><slot /><slot name="footer" /></aside>',
  },
  ElForm: { template: '<form><slot /></form>' },
  ElButton: { template: '<button><slot /></button>' },
  ElTooltip: slots,
  ElTag: slots,
  ElPagination: true,
  ElTable: defineComponent({
    props: ['data'],
    setup(props, { slots: inner }) {
      provide('rows', toRef(props, 'data'))
      return () => h('div', inner.default?.())
    },
  }),
  ElTableColumn: defineComponent({
    setup(_, { slots: inner }) {
      const rows = inject<Ref<Record<string, unknown>[]>>('rows', ref([]))
      return () =>
        h(
          'div',
          rows.value.map((row) => inner.default?.({ row })),
        )
    },
  }),
}

beforeEach(() => {
  state.tenant = reactive({ tenantId: 'tenant-a' })
  state.auth = reactive({ userInfo: { username: 'operator-a' } })
  state.access = reactive({ allowed: true, frozen: false })
  state.list.mockReset().mockImplementation(({ tenantId }) =>
    Promise.resolve({
      records: [
        {
          id: tenantId === 'tenant-a' ? 1 : 2,
          jobCode: tenantId,
          jobName: 'job',
          scheduleType: 'CRON',
        },
      ],
      total: 1,
    }),
  )
  state.update.mockReset().mockResolvedValue(undefined)
  vi.mocked(ElMessage.success).mockClear()
})

function render() {
  return mount(JobMonitoringPolicies, { global: { stubs, directives: { loading: () => {} } } })
}

async function openEditor(wrapper: ReturnType<typeof render>) {
  await wrapper.get('button[aria-label^="jobMonitoringPolicy.editTitle"]').trigger('click')
}

describe('作业监控策略编辑上下文', () => {
  it('切换租户后关闭旧表单并禁止提交旧作业', async () => {
    const wrapper = render()
    await flushPromises()
    expect(
      wrapper.find('button[aria-label="jobMonitoringPolicy.editTitle tenant-a"]').exists(),
    ).toBe(true)
    await openEditor(wrapper)
    expect(wrapper.find('aside').exists()).toBe(true)
    state.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(state.update).not.toHaveBeenCalled()
  })

  it('原保存完成后不关闭新租户的编辑表单', async () => {
    let finish!: () => void
    state.update.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await openEditor(wrapper)
    await wrapper.get('aside form').trigger('submit')
    expect(state.update).toHaveBeenCalledWith(1, expect.objectContaining({ tenantId: 'tenant-a' }))
    state.tenant.tenantId = 'tenant-b'
    await flushPromises()
    await openEditor(wrapper)
    finish()
    await flushPromises()
    expect(wrapper.find('aside').exists()).toBe(true)
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('无写权限或维护冻结时禁用编辑', async () => {
    const wrapper = render()
    await flushPromises()
    state.access.allowed = false
    await wrapper.vm.$nextTick()
    expect(
      wrapper.get('button[aria-label^="jobMonitoringPolicy.editTitle"]').attributes('disabled'),
    ).toBeDefined()
    state.access.allowed = true
    state.access.frozen = true
    await wrapper.vm.$nextTick()
    expect(
      wrapper.get('button[aria-label^="jobMonitoringPolicy.editTitle"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('编辑期间切换登录账号会关闭旧表单', async () => {
    const wrapper = render()
    await flushPromises()
    await openEditor(wrapper)
    state.auth.userInfo.username = 'operator-b'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(state.update).not.toHaveBeenCalled()
  })

  it('保存期间进入维护时不显示旧请求的成功结果', async () => {
    let finish!: () => void
    state.update.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await openEditor(wrapper)
    await wrapper.get('aside form').trigger('submit')
    state.access.frozen = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('aside').exists()).toBe(false)
    finish()
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('相同租户和权限下保存当前作业', async () => {
    const wrapper = render()
    await flushPromises()
    await openEditor(wrapper)
    await wrapper.get('aside form').trigger('submit')
    await flushPromises()
    expect(state.update).toHaveBeenCalledWith(1, expect.objectContaining({ tenantId: 'tenant-a' }))
    expect(ElMessage.success).toHaveBeenCalledWith('jobMonitoringPolicy.saveSuccess')
  })
})
