// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, inject, provide, reactive, ref, watch } from 'vue'
import type { ComputedRef, InjectionKey, PropType } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN'
import { listConfigSyncLogs, reconcileConfigSyncLog } from '@/api/configReleases'
import { ElMessage } from 'element-plus'
import ConfigSyncLogsTab from './ConfigSyncLogsTab.vue'

const state = vi.hoisted(() => ({
  tenant: { tenantId: 'tenant-a' },
  admin: true,
  writesFrozen: false,
}))
state.tenant = reactive(state.tenant)
vi.mock('@/api/configReleases', () => ({
  listConfigSyncLogs: vi.fn(),
  reconcileConfigSyncLog: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => state.admin }) }))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({
    writesFrozen: computed(() => state.writesFrozen),
    ensureWriteAvailable: () => !state.writesFrozen,
  }),
}))
vi.mock('element-plus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))
vi.mock('@/composables/useTenantReload', () => ({
  useTenantReload: (load: () => void | Promise<void>) =>
    watch(() => state.tenant.tenantId, load, { immediate: true }),
}))
vi.mock('@/composables/useListFilterFeedback', () => ({
  useListFilterFeedback: () => ({
    filterBusy: ref(false),
    runRefresh: (load: () => unknown) => load(),
  }),
}))

enableAutoUnmount(afterEach)
const rowsKey: InjectionKey<ComputedRef<Record<string, unknown>[]>> = Symbol('syncLogs')
const TableStub = defineComponent({
  props: { data: { type: Array as PropType<Record<string, unknown>[]>, default: () => [] } },
  setup(props, { slots }) {
    provide(
      rowsKey,
      computed(() => props.data),
    )
    return () => h('div', slots.default?.())
  },
})
const ColumnStub = defineComponent({
  setup(_, { slots }) {
    const rows = inject(rowsKey)
    return () =>
      h(
        'div',
        (rows?.value ?? []).map((row) => slots.default?.({ row })),
      )
  },
})

beforeEach(() => {
  vi.mocked(listConfigSyncLogs).mockReset()
  vi.mocked(reconcileConfigSyncLog).mockReset()
  vi.mocked(ElMessage.success).mockClear()
  vi.mocked(ElMessage.warning).mockClear()
  vi.mocked(ElMessage.error).mockClear()
  state.tenant.tenantId = 'tenant-a'
  state.admin = true
  state.writesFrozen = false
})

describe('ConfigSyncLogsTab', () => {
  it.each([0, 3])('最终结果未确认时不把暂存计数%s展示成成功或失败统计', async (successItems) => {
    const wrapper = await renderLogs('RUNNING', successItems)

    expect(wrapper.text()).toContain('结果尚未确认')
    expect(wrapper.find('.sync-metrics').exists()).toBe(false)
    expect(listConfigSyncLogs).toHaveBeenCalledWith('tenant-a', 1, 15)
  })

  it('管理员核对原审计并显示回执结果，重复点击只发送一次', async () => {
    let complete!: (value: Awaited<ReturnType<typeof reconcileConfigSyncLog>>) => void
    vi.mocked(reconcileConfigSyncLog).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const wrapper = await renderLogs('RUNNING', 0)
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    await button.trigger('click')
    await button.trigger('click')
    expect(reconcileConfigSyncLog).toHaveBeenCalledExactlyOnceWith('tenant-a', 7)
    complete({
      id: 7,
      tenantId: 'tenant-a',
      syncDirection: 'IMPORT',
      syncStatus: 'SUCCESS',
      totalItems: 6,
      successItems: 6,
      failedItems: 0,
      skippedItems: 0,
    })
    await flushPromises()
    expect(wrapper.text()).not.toContain('结果尚未确认')
    expect(wrapper.findAll('.sync-metrics strong').map((metric) => metric.text())).toEqual([
      '6',
      '6',
      '0',
      '0',
    ])
  })

  it('核对期间暂停刷新和翻页，避免旧列表响应覆盖核对结果', async () => {
    let complete!: (value: Awaited<ReturnType<typeof reconcileConfigSyncLog>>) => void
    vi.mocked(reconcileConfigSyncLog).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const wrapper = await renderLogs('RUNNING', 0)
    await wrapper.find('button').trigger('click')
    const queryBar = wrapper.findComponent({ name: 'ListPageQueryBar' })
    const pager = wrapper.findComponent({ name: 'TablePagerBar' })
    expect(queryBar.props('disabled')).toBe(true)
    expect(pager.props('disabled')).toBe(true)
    queryBar.vm.$emit('refresh')
    await flushPromises()
    expect(listConfigSyncLogs).toHaveBeenCalledTimes(1)
    complete({
      id: 7,
      tenantId: 'tenant-a',
      syncDirection: 'IMPORT',
      syncStatus: 'SUCCESS',
      totalItems: 6,
      successItems: 6,
      failedItems: 0,
      skippedItems: 0,
    })
    await flushPromises()
    expect(queryBar.props('disabled')).toBe(false)
    expect(wrapper.text()).not.toContain('结果尚未确认')
  })

  it('非管理员看不到核对写入口', async () => {
    state.admin = false
    const wrapper = await renderLogs('RUNNING', 0)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('全局写冻结时禁用核对并由处理函数阻止请求', async () => {
    state.writesFrozen = true
    const wrapper = await renderLogs('RUNNING', 0)
    const button = wrapper.find('button')

    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(reconcileConfigSyncLog).not.toHaveBeenCalled()
  })

  it('结果仍未知时保留待确认状态并提示，不显示成功', async () => {
    vi.mocked(reconcileConfigSyncLog).mockResolvedValue({
      id: 7,
      tenantId: 'tenant-a',
      syncDirection: 'IMPORT',
      syncStatus: 'RUNNING',
      totalItems: 6,
      successItems: 0,
      failedItems: 0,
      skippedItems: 0,
    })
    const wrapper = await renderLogs('RUNNING', 0)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('结果尚未确认')
    expect(ElMessage.warning).toHaveBeenCalledOnce()
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('租户切换后忽略旧核对响应和提示', async () => {
    let complete!: (value: Awaited<ReturnType<typeof reconcileConfigSyncLog>>) => void
    vi.mocked(reconcileConfigSyncLog).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const wrapper = await renderLogs('RUNNING', 0)
    await wrapper.find('button').trigger('click')
    vi.mocked(listConfigSyncLogs).mockResolvedValue({
      total: 0,
      items: [],
      pageNo: 1,
      pageSize: 15,
    })
    state.tenant.tenantId = 'tenant-b'
    await flushPromises()
    complete({
      id: 7,
      tenantId: 'tenant-a',
      syncDirection: 'IMPORT',
      syncStatus: 'SUCCESS',
      totalItems: 6,
      successItems: 6,
      failedItems: 0,
      skippedItems: 0,
    })
    await flushPromises()
    expect(wrapper.find('.sync-metrics').exists()).toBe(false)
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('租户清空后立即清除旧同步审计', async () => {
    const wrapper = await renderLogs('SUCCESS', 6)
    expect(wrapper.find('.sync-metrics').exists()).toBe(true)
    state.tenant.tenantId = ''
    await flushPromises()
    expect(wrapper.find('.sync-metrics').exists()).toBe(false)
  })

  it('A→B→A 同步切换后旧列表响应不得恢复', async () => {
    let complete!: (value: Awaited<ReturnType<typeof listConfigSyncLogs>>) => void
    vi.mocked(listConfigSyncLogs).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const wrapper = await renderLogs('SUCCESS', 6)
    state.tenant.tenantId = 'tenant-b'
    state.tenant.tenantId = 'tenant-a'
    complete({
      total: 1,
      pageNo: 1,
      pageSize: 15,
      items: [
        {
          id: 41,
          tenantId: 'tenant-a',
          syncDirection: 'IMPORT',
          syncStatus: 'SUCCESS',
          totalItems: 6,
          successItems: 6,
          failedItems: 0,
          skippedItems: 0,
        },
      ],
    })
    await flushPromises()
    expect(wrapper.find('.sync-metrics').exists()).toBe(false)
  })

  it('A→B→A 同步切换后旧核对结果不修改界面或提示成功', async () => {
    let complete!: (value: Awaited<ReturnType<typeof reconcileConfigSyncLog>>) => void
    vi.mocked(reconcileConfigSyncLog).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const wrapper = await renderLogs('RUNNING', 0)
    await wrapper.find('button').trigger('click')
    state.tenant.tenantId = 'tenant-b'
    state.tenant.tenantId = 'tenant-a'
    complete({
      id: 7,
      tenantId: 'tenant-a',
      syncDirection: 'IMPORT',
      syncStatus: 'SUCCESS',
      totalItems: 6,
      successItems: 6,
      failedItems: 0,
      skippedItems: 0,
    })
    await flushPromises()
    expect(wrapper.find('.sync-metrics').exists()).toBe(false)
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('最终结果已确认时继续显示实际成功失败及跳过数', async () => {
    const wrapper = await renderLogs('SUCCESS', 6)

    expect(wrapper.text()).not.toContain('结果尚未确认')
    expect(wrapper.findAll('.sync-metrics strong').map((metric) => metric.text())).toEqual([
      '6',
      '6',
      '0',
      '0',
    ])
  })
})

async function renderLogs(syncStatus: string, successItems: number) {
  vi.mocked(listConfigSyncLogs).mockResolvedValue({
    total: 1,
    pageNo: 1,
    pageSize: 15,
    items: [
      {
        id: 7,
        tenantId: 'tenant-a',
        syncDirection: 'IMPORT',
        syncStatus,
        totalItems: 6,
        successItems,
        failedItems: 0,
        skippedItems: 0,
      },
    ],
  })
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } })
  const wrapper = mount(ConfigSyncLogsTab, {
    global: {
      plugins: [i18n],
      directives: { loading: () => {} },
      stubs: {
        ElTable: TableStub,
        ElTableColumn: ColumnStub,
        ElTag: { template: '<span><slot /></span>' },
        ElButton: {
          props: ['disabled', 'loading'],
          template: '<button :disabled="disabled || loading"><slot /></button>',
        },
        DataState: { template: '<div><slot /></div>' },
        ListPageQueryBar: true,
        TablePagerBar: true,
        DatetimeColumn: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}
