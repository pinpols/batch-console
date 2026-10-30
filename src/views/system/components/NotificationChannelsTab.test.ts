// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationChannelsTab from './NotificationChannelsTab.vue'
import { createNotificationChannel } from '@/api/notifications'

const state = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  validate: vi.fn<() => Promise<boolean>>(),
  confirmDanger: vi.fn<() => Promise<void>>(),
  listChannels: vi.fn(),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
  testChannel: vi.fn(),
  channelRow: null as Record<string, unknown> | null,
}))

vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/composables/useFormValidate', async () => {
  const { ref } = await import('vue')
  return {
    useFormValidate: () => ({ formRef: ref(null), validate: state.validate }),
    rules: {
      required: vi.fn(() => ({})),
      code: vi.fn(() => ({})),
      maxLength: vi.fn(() => ({})),
    },
  }
})
vi.mock('@/composables/useDirtyForm', () => ({
  useDirtyForm: () => ({ confirmDiscard: vi.fn(async () => true), markPristine: vi.fn() }),
}))
vi.mock('@/composables/useFormFocus', () => ({ useFormFocus: vi.fn() }))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: state.confirmDanger }))
vi.mock('@/composables/useListLoadState', async () => {
  const { ref } = await import('vue')
  return { useListLoadState: () => ({ loading: ref(false), error: ref(null) }) }
})
vi.mock('@/composables/useListFilterFeedback', () => ({
  useListFilterFeedback: () => ({
    filterBusy: { value: false },
    runSearch: (run: () => void) => run(),
    runReset: (run: () => void) => run(),
    runRefresh: (run: () => void) => run(),
  }),
}))
vi.mock('@/composables/queries/useConsoleMeta', async () => {
  const { ref } = await import('vue')
  return { useConsoleMetaEnumsQuery: () => ({ data: ref([]) }) }
})
vi.mock('@/utils/metaEnumPick', () => ({ pickMetaEnumGroup: () => [] }))
vi.mock('@/api/adapters', () => ({ toPageResult: (records: unknown[]) => ({ records }) }))
vi.mock('@/api/notifications', () => ({
  listNotificationChannels: state.listChannels,
  createNotificationChannel: state.createChannel,
  updateNotificationChannel: state.updateChannel,
  deleteNotificationChannel: state.deleteChannel,
  testNotificationChannel: state.testChannel,
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return { ...actual, ElMessage: { success: vi.fn(), error: vi.fn() } }
})

const stubs = {
  ProTable: {
    props: ['data'],
    template: '<section><pre data-testid="channels">{{ JSON.stringify(data) }}</pre><slot /></section>',
  },
  EmptyState: true,
  ListPageQueryBar: true,
  EnabledStatusFilter: true,
  StatusTag: true,
  DatetimeColumn: true,
  RowActions: {
    props: ['actions'],
    template: '<div><button v-for="action in actions" :key="action.key" @click="action.onClick()">{{ action.key }}</button></div>',
  },
  ElTableColumn: {
    setup: () => ({ row: state.channelRow ?? {} }),
    template: '<div><slot :row="row" /></div>',
  },
  ElDrawer: {
    props: ['modelValue'],
    template: '<aside v-if="modelValue"><slot /><slot name="footer" /></aside>',
  },
  ElForm: { template: '<form><slot /></form>' },
  ElFormItem: { template: '<label><slot /></label>' },
  ElInput: { template: '<input />' },
  ElSelect: { template: '<div><slot /></div>' },
  ElOption: true,
  ElSwitch: true,
  ElButton: {
    props: ['loading'],
    emits: ['click'],
    template: '<button :disabled="loading" @click="$emit(\'click\')"><slot /></button>',
  },
}

describe('notification channel tenant scope', () => {
  beforeEach(() => {
    state.tenant = reactive({ tenantId: 'tenant-a' })
    state.validate.mockReset().mockResolvedValue(true)
    state.confirmDanger.mockReset().mockResolvedValue(undefined)
    state.listChannels.mockReset().mockResolvedValue([])
    state.createChannel.mockReset().mockResolvedValue(undefined)
    state.updateChannel.mockReset().mockResolvedValue(undefined)
    state.deleteChannel.mockReset().mockResolvedValue(undefined)
    state.testChannel.mockReset().mockResolvedValue(undefined)
    state.channelRow = null
  })

  it('does not submit an A form when the tenant changes while validation is pending', async () => {
    let resolveValidation!: (isValid: boolean) => void
    state.validate.mockReturnValueOnce(new Promise((resolve) => { resolveValidation = resolve }))
    const wrapper = mount(NotificationChannelsTab, { global: { stubs } })
    await flushPromises()
    ;(wrapper.vm as unknown as { openChannelCreate: () => void }).openChannelCreate()
    await nextTick()

    await wrapper.findAll('button').find((button) => button.text() === 'common.save')!.trigger('click')
    state.tenant.tenantId = 'tenant-b'
    await nextTick()
    resolveValidation(true)
    await flushPromises()

    expect(createNotificationChannel).not.toHaveBeenCalled()
    expect(state.updateChannel).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('submits to the tenant captured when an unchanged form was opened', async () => {
    const wrapper = mount(NotificationChannelsTab, { global: { stubs } })
    await flushPromises()
    ;(wrapper.vm as unknown as { openChannelCreate: () => void }).openChannelCreate()
    await nextTick()

    await wrapper.findAll('button').find((button) => button.text() === 'common.save')!.trigger('click')
    await flushPromises()

    expect(createNotificationChannel).toHaveBeenCalledTimes(1)
    expect(createNotificationChannel).toHaveBeenCalledWith('tenant-a', {
      channelCode: '',
      channelName: '',
      channelType: '',
      configJson: '',
      enabled: true,
    })
    wrapper.unmount()
  })

  it('keeps only tenant B rows when tenant A responds late with the same channel code', async () => {
    let resolveTenantA!: (rows: Record<string, unknown>[]) => void
    const tenantARow = { tenantId: 'tenant-a', channelCode: 'shared', channelName: 'A channel' }
    const tenantBRow = { tenantId: 'tenant-b', channelCode: 'shared', channelName: 'B channel' }
    state.listChannels
      .mockReturnValueOnce(new Promise((resolve) => { resolveTenantA = resolve }))
      .mockResolvedValueOnce([tenantBRow])

    const wrapper = mount(NotificationChannelsTab, { global: { stubs } })
    state.tenant.tenantId = 'tenant-b'
    await nextTick()
    await flushPromises()
    expect(wrapper.get('[data-testid="channels"]').text()).toContain('B channel')

    resolveTenantA([tenantARow])
    await flushPromises()

    expect(wrapper.get('[data-testid="channels"]').text()).toContain('B channel')
    expect(wrapper.get('[data-testid="channels"]').text()).not.toContain('A channel')
    wrapper.unmount()
  })

  it('does not delete an A row when its confirmation resolves after switching to B', async () => {
    let resolveConfirmation!: () => void
    state.channelRow = {
      tenantId: 'tenant-a',
      channelCode: 'shared',
      channelName: 'A channel',
      enabled: true,
    }
    state.listChannels.mockResolvedValueOnce([state.channelRow])
    state.confirmDanger.mockReturnValueOnce(new Promise((resolve) => { resolveConfirmation = resolve }))
    const wrapper = mount(NotificationChannelsTab, { global: { stubs } })
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'delete')!.trigger('click')
    state.tenant.tenantId = 'tenant-b'
    await nextTick()
    resolveConfirmation()
    await flushPromises()

    expect(state.deleteChannel).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
