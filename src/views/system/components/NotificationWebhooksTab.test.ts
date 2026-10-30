// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationWebhooksTab from './NotificationWebhooksTab.vue'
import { createWebhook } from '@/api/webhooks'

const state = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  validate: vi.fn<() => Promise<boolean>>(),
  confirmDanger: vi.fn<() => Promise<void>>(),
  listChannels: vi.fn(),
  listRules: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  testRule: vi.fn(),
  ruleRow: null as Record<string, unknown> | null,
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
      pattern: vi.fn(() => ({})),
    },
  }
})
vi.mock('@/composables/useDirtyForm', () => ({
  useDirtyForm: () => ({ confirmDiscard: vi.fn(async () => true), markPristine: vi.fn() }),
}))
vi.mock('@/composables/useFormFocus', () => ({ useFormFocus: vi.fn() }))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: state.confirmDanger }))
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
vi.mock('@/api/webhooks', () => ({
  unusedChannels: state.listChannels,
  listWebhooks: state.listRules,
  createWebhook: state.createRule,
  updateWebhook: state.updateRule,
  deleteWebhook: state.deleteRule,
  listWebhookDeliveryLogs: state.testRule,
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
    template:
      '<section><pre data-testid="rules">{{ JSON.stringify(data) }}</pre><slot /></section>',
  },
  EmptyState: true,
  ListPageQueryBar: true,
  EnabledStatusFilter: true,
  StatusTag: true,
  DatetimeColumn: true,
  RowActions: {
    props: ['actions'],
    template:
      '<div><button v-for="action in actions" :key="action.key" @click="action.onClick()">{{ action.key }}</button></div>',
  },
  ElTableColumn: {
    setup: () => ({ row: state.ruleRow ?? {} }),
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

describe('webhook tenant scope', () => {
  beforeEach(() => {
    state.tenant = reactive({ tenantId: 'tenant-a' })
    state.validate.mockReset().mockResolvedValue(true)
    state.confirmDanger.mockReset().mockResolvedValue(undefined)
    state.listChannels.mockReset().mockResolvedValue([])
    state.listRules.mockReset().mockResolvedValue([])
    state.createRule.mockReset().mockResolvedValue(undefined)
    state.updateRule.mockReset().mockResolvedValue(undefined)
    state.deleteRule.mockReset().mockResolvedValue(undefined)
    state.testRule.mockReset().mockResolvedValue(undefined)
    state.ruleRow = null
  })

  it('does not submit an A form when the tenant changes while validation is pending', async () => {
    let resolveValidation!: (isValid: boolean) => void
    state.validate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveValidation = resolve
      }),
    )
    const wrapper = mount(NotificationWebhooksTab, { global: { stubs } })
    await flushPromises()
    ;(wrapper.vm as unknown as { openWebhookCreate: () => void }).openWebhookCreate()
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'common.save')!
      .trigger('click')
    state.tenant.tenantId = 'tenant-b'
    await nextTick()
    resolveValidation(true)
    await flushPromises()

    expect(createWebhook).not.toHaveBeenCalled()
    expect(state.updateRule).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('submits to the tenant captured when an unchanged form was opened', async () => {
    const wrapper = mount(NotificationWebhooksTab, { global: { stubs } })
    await flushPromises()
    ;(wrapper.vm as unknown as { openWebhookCreate: () => void }).openWebhookCreate()
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'common.save')!
      .trigger('click')
    await flushPromises()

    expect(createWebhook).toHaveBeenCalledTimes(1)
    expect(createWebhook).toHaveBeenCalledWith('tenant-a', {
      name: '',
      eventTypes: [],
      callbackUrl: '',
      secret: undefined,
      enabled: true,
    })
    wrapper.unmount()
  })

  it('keeps only tenant B rows when tenant A responds late with the same rule identifier', async () => {
    let resolveTenantA!: (rows: Record<string, unknown>[]) => void
    const tenantARow = { tenantId: 'tenant-a', id: 1, name: 'A rule' }
    const tenantBRow = { tenantId: 'tenant-b', id: 2, name: 'B rule' }
    state.listRules
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveTenantA = resolve
        }),
      )
      .mockResolvedValueOnce([tenantBRow])

    const wrapper = mount(NotificationWebhooksTab, { global: { stubs } })
    state.tenant.tenantId = 'tenant-b'
    await nextTick()
    await flushPromises()
    expect(wrapper.get('[data-testid="rules"]').text()).toContain('B rule')

    resolveTenantA([tenantARow])
    await flushPromises()

    expect(wrapper.get('[data-testid="rules"]').text()).toContain('B rule')
    expect(wrapper.get('[data-testid="rules"]').text()).not.toContain('A rule')
    wrapper.unmount()
  })

  it('does not delete an A row when its confirmation resolves after switching to B', async () => {
    let resolveConfirmation!: () => void
    state.ruleRow = {
      tenantId: 'tenant-a',
      id: 1,
      name: 'A rule',
      enabled: true,
    }
    state.listRules.mockResolvedValueOnce([state.ruleRow])
    state.confirmDanger.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveConfirmation = resolve
      }),
    )
    const wrapper = mount(NotificationWebhooksTab, { global: { stubs } })
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'delete')!
      .trigger('click')
    state.tenant.tenantId = 'tenant-b'
    await nextTick()
    resolveConfirmation()
    await flushPromises()

    expect(state.deleteRule).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
