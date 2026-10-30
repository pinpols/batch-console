// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive, provide, toRef, inject, h, ref, type Ref } from 'vue'
import { defineComponent, type PropType } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelfServiceFailedJobsTab from './SelfServiceFailedJobsTab.vue'
import SelfServiceNotifSubsTab from './SelfServiceNotifSubsTab.vue'
import SelfServiceMyAuditsTab from './SelfServiceMyAuditsTab.vue'
import SelfServiceQuotaTab from './SelfServiceQuotaTab.vue'
import SelfServiceQuotaChangeTab from './SelfServiceQuotaChangeTab.vue'
import ConfigChangeLogsTab from './ConfigChangeLogsTab.vue'
import NotificationDeliveryLogsTab from './NotificationDeliveryLogsTab.vue'

const state = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  jobs: vi.fn(),
  rules: vi.fn(),
  audits: vi.fn(),
  quota: vi.fn(),
  usage: vi.fn(),
  configLogs: vi.fn(),
  deliveryLogs: vi.fn(),
  requestQuota: vi.fn(),
  validate: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ canAccess: () => false, userInfo: { userId: 'operator' } }),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/api/queries/instances', () => ({ queryJobInstances: state.jobs }))
vi.mock('@/api/notifications', () => ({
  listNotificationRules: state.rules,
  listNotificationDeliveryLogs: state.deliveryLogs,
}))
vi.mock('@/api/observabilityQueries', () => ({ queryAuditsPage: state.audits }))
vi.mock('@/api/tenantSelfService', () => ({
  getTenantQuota: state.quota,
  getTenantUsage: state.usage,
  requestQuotaChange: state.requestQuota,
}))
vi.mock('@/api/configReleases', () => ({ listConfigChangeLogs: state.configLogs }))
vi.mock('@/composables/queries/useConsoleMeta', async () => {
  const { ref } = await import('vue')
  return { useConsoleMetaEnumsQuery: () => ({ data: ref([]) }) }
})
vi.mock('@/utils/metaEnumPick', () => ({ pickMetaEnumGroup: () => [] }))
vi.mock('@/composables/useFormValidate', async () => {
  const { ref } = await import('vue')
  return {
    useFormValidate: () => ({ formRef: ref(null), validate: state.validate }),
    rules: { required: () => ({}) },
  }
})

const stubs = {
  ProTable: defineComponent({
    props: { data: { type: Array as PropType<Record<string, unknown>[]>, default: () => [] } },
    setup(props) {
      provide('tableRows', toRef(props, 'data'))
    },
    template: '<section><pre>{{ JSON.stringify(data) }}</pre><slot /></section>',
  }),
  ElTable: {
    props: ['data'],
    template: '<section><pre>{{ JSON.stringify(data) }}</pre><slot /></section>',
  },
  JsonPreview: { props: ['data'], template: '<pre>{{ JSON.stringify(data) }}</pre>' },
  DataState: { template: '<div><slot /></div>' },
  EmptyState: true,
  ListPageQueryBar: true,
  TablePagerBar: true,
  DatetimeColumn: true,
  StatusTag: true,
  ElTableColumn: defineComponent({
    props: { prop: String },
    setup(props, { slots }) {
      const rows = inject<Ref<Record<string, unknown>[]>>('tableRows', ref([]))
      return () =>
        h(
          'span',
          rows.value.map((row) => slots.default?.({ row }) ?? String(row[props.prop ?? ''] ?? '')),
        )
    },
  }),
  ElTag: { template: '<span><slot /></span>' },
  ElAlert: true,
  RouterLink: true,
  ElButton: true,
  ElForm: { setup: () => ({ clearValidate: vi.fn() }), template: '<form><slot /></form>' },
  ElFormItem: { template: '<label><slot /></label>' },
  ElSelect: { template: '<select><slot /></select>' },
  ElOption: { props: ['label'], template: '<option>{{ label }}</option>' },
  ElInput: { template: '<input />' },
}
const cases = [
  {
    name: 'failed jobs',
    component: SelfServiceFailedJobsTab,
    api: state.jobs,
    payload: (name: string) => ({ records: [{ jobCode: name }] }),
  },
  {
    name: 'notification subscriptions',
    component: SelfServiceNotifSubsTab,
    api: state.rules,
    payload: (name: string) => [{ ruleName: name }],
  },
  {
    name: 'my audits',
    component: SelfServiceMyAuditsTab,
    api: state.audits,
    payload: (name: string) => ({ items: [{ target: name }] }),
  },
  {
    name: 'quota',
    component: SelfServiceQuotaTab,
    api: state.quota,
    payload: (name: string) => ({ items: [{ policyCode: name }] }),
  },
  {
    name: 'usage',
    component: SelfServiceQuotaTab,
    api: state.usage,
    payload: (name: string) => ({ items: [{ policyCode: name }] }),
  },
  {
    name: 'quota choices',
    component: SelfServiceQuotaChangeTab,
    api: state.quota,
    payload: (name: string) => ({ items: [{ policyCode: name }] }),
  },
  {
    name: 'configuration logs',
    component: ConfigChangeLogsTab,
    api: state.configLogs,
    payload: (name: string) => [{ summary: name }],
  },
  {
    name: 'delivery logs',
    component: NotificationDeliveryLogsTab,
    api: state.deliveryLogs,
    payload: (name: string) => [{ eventType: name }],
  },
]

describe('system tenant response isolation', () => {
  beforeEach(() => {
    state.tenant = reactive({ tenantId: 'tenant-a' })
    for (const api of [
      state.jobs,
      state.rules,
      state.audits,
      state.quota,
      state.usage,
      state.configLogs,
      state.deliveryLogs,
    ])
      api.mockReset().mockResolvedValue([])
    state.validate.mockReset().mockResolvedValue(true)
    state.requestQuota.mockReset().mockResolvedValue(undefined)
  })

  it.each(cases)(
    'keeps tenant B $name after tenant A responds late',
    async ({ component, api, payload }) => {
      let resolveA!: (rows: unknown) => void
      api
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveA = resolve
          }),
        )
        .mockResolvedValueOnce(payload('TENANT_B_RESULT'))
      const wrapper = mount(component, {
        global: { stubs, directives: { loading: () => {}, 'track-click': () => {} } },
      })
      state.tenant.tenantId = 'tenant-b'
      await nextTick()
      await flushPromises()
      expect(wrapper.text()).toContain('TENANT_B_RESULT')
      resolveA(payload('TENANT_A_STALE'))
      await flushPromises()
      expect(wrapper.text()).toContain('TENANT_B_RESULT')
      expect(wrapper.text()).not.toContain('TENANT_A_STALE')
      wrapper.unmount()
    },
  )

  it('does not request a quota change for B using an A form awaiting validation', async () => {
    let resolveValidation!: (value: boolean) => void
    state.validate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveValidation = resolve
      }),
    )
    const wrapper = mount(SelfServiceQuotaChangeTab, {
      global: { stubs, directives: { 'track-click': () => {} } },
    })
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    state.tenant.tenantId = 'tenant-b'
    await nextTick()
    resolveValidation(true)
    await flushPromises()
    expect(state.requestQuota).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders subscription fields supplied by the API adapter', async () => {
    state.rules.mockResolvedValue([
      {
        ruleName: 'Daily failures',
        eventTypes: 'JOB_FAILED',
        severityFilter: 'CRITICAL',
        enabled: true,
      },
    ])
    const wrapper = mount(SelfServiceNotifSubsTab, { global: { stubs } })
    await flushPromises()
    const visibleCells = wrapper.findAll('span').map((cell) => cell.text())
    expect(visibleCells).toContain('Daily failures')
    expect(visibleCells).toContain('JOB_FAILED')
    expect(visibleCells).toContain('CRITICAL')
    wrapper.unmount()
  })

  it('renders and filters delivery records by the actual channel code', async () => {
    state.deliveryLogs.mockResolvedValue([
      {
        id: 7,
        channelCode: 'CHANNEL_A',
        eventType: 'JOB_FAILED',
        deliveryStatus: 'FAILED',
        attempt: 2,
        errorMessage: 'connection unavailable',
        payloadJson: { token: '****' },
      },
      {
        id: 8,
        channelCode: 'CHANNEL_B',
        eventType: 'JOB_SUCCESS',
        deliveryStatus: 'SUCCESS',
        attempt: 1,
      },
    ])
    const wrapper = mount(NotificationDeliveryLogsTab, {
      global: {
        stubs: {
          ...stubs,
          ProTable: defineComponent({
            props: {
              data: { type: Array as PropType<Record<string, unknown>[]>, default: () => [] },
            },
            setup(props) {
              provide('tableRows', toRef(props, 'data'))
            },
            template: '<section><slot name="query" /><slot /></section>',
          }),
          ElTableColumn: defineComponent({
            setup(_, { slots }) {
              const rows = inject<Ref<Record<string, unknown>[]>>('tableRows', ref([]))
              return () =>
                h(
                  'div',
                  rows.value.map((row) => h('span', slots.default?.({ row }))),
                )
            },
          }),
          ListPageQueryBar: {
            emits: ['search'],
            template: '<div><slot /><button @click="$emit(\'search\')">search</button></div>',
          },
          ElInput: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
        },
      },
    })
    await flushPromises()
    let cells = wrapper.findAll('span').map((cell) => cell.text())
    expect(cells).toContain('CHANNEL_A')
    expect(cells).toContain('2')
    expect(cells).toContain('connection unavailable')
    await wrapper.get('input').setValue('CHANNEL_A')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    cells = wrapper.findAll('span').map((cell) => cell.text())
    expect(cells).toContain('CHANNEL_A')
    expect(cells).not.toContain('CHANNEL_B')
    wrapper.unmount()
  })
})
