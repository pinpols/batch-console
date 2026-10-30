// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { ElMessage } from 'element-plus'
import OutboxList from './OutboxList.vue'

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  republish: vi.fn(),
  confirm: vi.fn(),
  state: null as unknown as { tenantId: string; writer: boolean; writesFrozen: boolean },
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.state }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.state }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    userInfo: { username: 'operator' },
    hasPermission: (role: string) => mocks.state.writer && role === 'ROLE_TENANT_ADMIN',
  }),
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))
vi.mock('@/composables/useSseAutoReload', () => ({
  useSseAutoReload: () => ({
    status: ref('live'),
    lastRefreshedAt: ref(null),
    markRefreshed: vi.fn(),
  }),
}))
vi.mock('@/api/observabilityQueries', () => ({
  queryOutboxRetriesPage: mocks.page,
  queryOutboxRetries: vi.fn().mockResolvedValue([]),
  queryOutboxDeliveriesPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  queryOutboxDeliveries: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/ops', () => ({
  getOutboxStats: vi.fn().mockResolvedValue({ statusBreakdown: [] }),
  republishOutbox: mocks.republish,
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))
enableAutoUnmount(afterEach)
const table = defineComponent({
  name: 'ProTable',
  props: ['data'],
  emits: ['selection-change'],
  setup(props, { emit, slots }) {
    return () =>
      h('section', [
        h(
          'button',
          { class: 'select-rows', onClick: () => emit('selection-change', props.data) },
          '选择当前页',
        ),
        slots.toolbar?.(),
      ])
  },
})
function row(id: number, status = 'FAILED') {
  return { outboxEventId: id, retryStatus: status, eventKey: 'event-' + id }
}
function render() {
  return shallowMount(OutboxList, {
    global: {
      stubs: {
        PageContainer: { template: '<main><slot /></main>' },
        ProTable: table,
        BulkActionBar: { template: '<div><slot :running="false" /></div>' },
        ElButton: { template: '<button><slot /></button>' },
      },
    },
  })
}
async function selectAndSubmit(wrapper: ReturnType<typeof render>) {
  await wrapper.find('.select-rows').trigger('click')
  const button = wrapper
    .findAll('button')
    .find((b) => b.text() === 'observability.outboxBulkRepublish')!
  await button.trigger('click')
}

describe('Outbox 租户上下文与实际重投结果', () => {
  beforeEach(() => {
    mocks.state = reactive({ tenantId: 'tenant-a', writer: true, writesFrozen: false })
    mocks.page.mockReset().mockResolvedValue({ items: [row(41)], total: 1 })
    mocks.republish
      .mockReset()
      .mockResolvedValue({ tenantId: 'tenant-a', requestedCount: 1, resetCount: 1 })
    mocks.confirm.mockReset().mockResolvedValue(undefined)
    vi.mocked(ElMessage.success).mockClear()
    vi.mocked(ElMessage.error).mockClear()
  })

  it('危险确认期间切租户，不向新租户提交旧事件', async () => {
    let confirm!: () => void
    mocks.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper)
    mocks.state.tenantId = 'tenant-b'
    confirm()
    await flushPromises()
    expect(mocks.republish).not.toHaveBeenCalled()
  })

  it('批量在途时切租户，尚未发出的项停止，已发出的目标始终是原租户', async () => {
    mocks.page.mockResolvedValue({
      items: Array.from({ length: 6 }, (_, i) => row(i + 1)),
      total: 6,
    })
    let finish!: (value: unknown) => void
    const pending = new Promise((resolve) => {
      finish = resolve
    })
    mocks.republish.mockReturnValue(pending)
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper)
    await flushPromises()
    expect(mocks.republish).toHaveBeenCalledTimes(4)
    mocks.state.tenantId = 'tenant-b'
    finish({ tenantId: 'tenant-a', requestedCount: 1, resetCount: 1 })
    await flushPromises()
    expect(mocks.republish).toHaveBeenCalledTimes(4)
    expect(mocks.republish.mock.calls.every(([tenant]) => tenant === 'tenant-a')).toBe(true)
  })

  it('旧租户页面响应晚到，不能覆盖新租户结果', async () => {
    let finishOld!: (value: unknown) => void
    mocks.page.mockImplementation((tenant: string) =>
      tenant === 'tenant-a'
        ? new Promise((resolve) => {
            finishOld = resolve
          })
        : Promise.resolve({ items: [row(52)], total: 1 }),
    )
    const wrapper = render()
    await flushPromises()
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    finishOld({ items: [row(41)], total: 1 })
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([row(52)])
  })

  it.each([0, 1])('EXHAUSTED 可手动重投，成功数依实际 resetCount=%s 判断', async (resetCount) => {
    mocks.page.mockResolvedValue({ items: [row(41, 'EXHAUSTED')], total: 1 })
    mocks.republish.mockResolvedValue({ tenantId: 'tenant-a', requestedCount: 1, resetCount })
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper)
    await flushPromises()
    expect(mocks.republish).toHaveBeenCalledWith('tenant-a', [41])
    expect(ElMessage.success).toHaveBeenCalledTimes(resetCount)
    expect(ElMessage.error).toHaveBeenCalledTimes(1 - resetCount)
  })

  it('EXHAUSTED 重试日志可按关联事件尝试重投', async () => {
    mocks.page.mockResolvedValue({ items: [row(41, 'EXHAUSTED')], total: 1 })
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper)
    await flushPromises()
    expect(mocks.republish).toHaveBeenCalledWith('tenant-a', [41])
  })

  it.each(['writer', 'writesFrozen'] as const)(
    '危险确认后复核写权限和维护状态：%s',
    async (field) => {
      let confirm!: () => void
      mocks.confirm.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          confirm = resolve
        }),
      )
      const wrapper = render()
      await flushPromises()
      await selectAndSubmit(wrapper)
      mocks.state[field] = field === 'writesFrozen'
      confirm()
      await flushPromises()
      expect(mocks.republish).not.toHaveBeenCalled()
    },
  )

  it('FAILED 已被并发发布时返回零重置，不能显示重投成功', async () => {
    mocks.republish.mockResolvedValue({ tenantId: 'tenant-a', requestedCount: 1, resetCount: 0 })
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper)
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledOnce()
  })

  it('NEW 状态不作为人工重投目标', async () => {
    mocks.page.mockResolvedValue({ items: [row(41, 'NEW')], total: 1 })
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper)
    await flushPromises()
    expect(mocks.republish).not.toHaveBeenCalled()
  })
})
