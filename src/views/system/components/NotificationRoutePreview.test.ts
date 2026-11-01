// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationRoutePreview from './NotificationRoutePreview.vue'

const state = vi.hoisted(() => ({ preview: vi.fn(), catalog: vi.fn(), tenant: { tenantId: 'a' } }))
vi.mock('@/api/notifications', () => ({ previewNotificationRoute: state.preview }))
vi.mock('@/api/eventCatalog', () => ({ listEventTypes: state.catalog }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({
    data: ref({
      severity: [
        { value: 'INFO', label: 'INFO' },
        { value: 'WARN', label: 'WARN' },
        { value: 'ERROR', label: 'ERROR' },
        { value: 'CRITICAL', label: 'CRITICAL' },
      ],
    }),
  }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const slot = { template: '<div><slot /></div>' }
const stubs = {
  ElAlert: { props: ['title'], template: '<div>{{ title }}</div>' },
  ElForm: { template: '<form><slot /></form>' },
  ElFormItem: slot,
  ElSelect: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
  },
  ElOption: { props: ['label', 'value'], template: '<option :value="value">{{ label }}</option>' },
  ElInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  ElButton: { template: '<button type="submit"><slot /></button>' },
  ElEmpty: { props: ['description'], template: '<div>{{ description }}</div>' },
  ElTable: { props: ['data'], template: '<div>{{ JSON.stringify(data) }}<slot /></div>' },
  ElTableColumn: true,
}

describe('notification route preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.tenant = reactive({ tenantId: 'a' })
    state.catalog.mockResolvedValue([{ eventType: 'JOB_FAILED', description: 'failed' }])
  })

  it('shows both matched routes and clears the result when input changes', async () => {
    state.preview.mockResolvedValue({
      rules: [{ id: 1, name: 'failure', channelCode: 'mail', channelType: 'EMAIL' }],
      webhooks: [{ id: 2, name: 'webhook' }],
    })
    const wrapper = mount(NotificationRoutePreview, { global: { stubs } })
    await flushPromises()
    await wrapper.find('select').setValue('JOB_FAILED')
    await wrapper.find('input').setValue('JOB_A')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(state.preview).toHaveBeenCalledWith('a', 'JOB_FAILED', '', 'JOB_A')
    expect(wrapper.text()).toContain('failure')
    expect(wrapper.text()).toContain('webhook')
    await wrapper.find('input').setValue('JOB_B')
    expect(wrapper.text()).not.toContain('failure')
    wrapper.unmount()
  })

  it('ignores an old tenant response after switching tenants', async () => {
    let resolve!: (value: unknown) => void
    state.preview.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = mount(NotificationRoutePreview, { global: { stubs } })
    await flushPromises()
    await wrapper.find('select').setValue('JOB_FAILED')
    await wrapper.find('input').setValue('JOB_A')
    await wrapper.find('form').trigger('submit')
    state.tenant.tenantId = 'b'
    resolve({ rules: [{ id: 1, name: 'old tenant' }], webhooks: [] })
    await flushPromises()
    expect(wrapper.text()).not.toContain('old tenant')
    wrapper.unmount()
  })

  it('requires the job code and only exposes fields present in the event', async () => {
    state.catalog.mockResolvedValue([
      { eventType: 'JOB_FAILED', description: 'job' },
      { eventType: 'WORKFLOW_FAILED', description: 'workflow' },
      { eventType: 'ALERT_ESCALATED', description: 'alert' },
      { eventType: 'UNSUPPORTED', description: 'unsupported' },
    ])
    const wrapper = mount(NotificationRoutePreview, { global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('unsupported')
    await wrapper.find('select').setValue('JOB_FAILED')
    await wrapper.find('form').trigger('submit')
    expect(state.preview).not.toHaveBeenCalled()
    expect(wrapper.findAll('input')).toHaveLength(1)
    await wrapper.find('select').setValue('WORKFLOW_FAILED')
    expect(wrapper.findAll('input')).toHaveLength(0)
    await wrapper.find('select').setValue('ALERT_ESCALATED')
    expect(wrapper.findAll('input')).toHaveLength(0)
    const severity = wrapper.findAll('select')[1]
    expect(severity.findAll('option').map((option) => option.attributes('value'))).toEqual([
      'INFO',
      'WARN',
      'ERROR',
      'CRITICAL',
    ])
    await wrapper.find('form').trigger('submit')
    expect(state.preview).not.toHaveBeenCalled()
    await severity.setValue('CRITICAL')
    state.preview.mockResolvedValue({ rules: [], webhooks: [] })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(state.preview).toHaveBeenCalledWith('a', 'ALERT_ESCALATED', 'CRITICAL', '')
    wrapper.unmount()
  })
})
