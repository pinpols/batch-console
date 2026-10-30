// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, nextTick, watch } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationTerminalDeliveriesTab from './NotificationTerminalDeliveriesTab.vue'
import { listTerminalDeliveries, retryTerminalDelivery } from '@/api/terminalNotifications'

const state = vi.hoisted(() => ({ tenant: null as unknown as { tenantId: string }, admin: true }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => state.admin }) }))
vi.mock('vue-i18n', async importOriginal => ({ ...(await importOriginal<typeof import('vue-i18n')>()), useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('element-plus', async importOriginal => ({ ...(await importOriginal<typeof import('element-plus')>()), ElMessage: { success: vi.fn() } }))
vi.mock('@/api/terminalNotifications', () => ({ listTerminalDeliveries: vi.fn(), retryTerminalDelivery: vi.fn() }))
vi.mock('@/composables/useTenantReload', () => ({
  useTenantReload: (fn: () => void) => watch(() => state.tenant.tenantId, fn, { immediate: true }),
}))

const failed = { source: 'RULE' as const, id: 17, terminalEventKey: 'ta:workflow:901:terminal',
  eventType: 'WORKFLOW_FAILED', deliveryStatus: 'EXHAUSTED', attempt: 1, createdAt: '2026-10-20T00:00:00Z' }
const stubs = {
  ProTable: { props: ['data'], template: '<div><pre>{{ JSON.stringify(data) }}</pre><slot /><slot name="toolbar" /></div>' },
  ElTableColumn: { setup: () => ({ row: failed }), template: '<div><slot :row="row" /></div>' },
  DatetimeColumn: true,
  RouterLink: { template: '<a><slot /></a>' },
  ElButton: { props: ['disabled', 'loading'], emits: ['click'], template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>' },
  ElDialog: { props: ['modelValue'], template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>' },
  ElForm: { template: '<form><slot /></form>' },
  ElFormItem: { template: '<label><slot /></label>' },
  ElInput: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
  ElCheckbox: { props: ['modelValue'], emits: ['update:modelValue'], template: '<label><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" /><slot /></label>' },
  ElAlert: true,
}

function render() { return mount(NotificationTerminalDeliveriesTab, { global: { stubs } }) }

describe('terminal notification recovery dialog', () => {
  beforeEach(() => {
    state.tenant = reactive({ tenantId: 'ta' })
    state.admin = true
    vi.mocked(listTerminalDeliveries).mockReset().mockResolvedValue([failed])
    vi.mocked(retryTerminalDelivery).mockReset().mockResolvedValue(undefined)
  })

  it('requires reconciliation and keeps the request identity after a lost response', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === 'terminalNotifications.reconcileRetry')!.trigger('click')
    const submit = () => wrapper.findAll('button').find(b => b.text() === 'terminalNotifications.queueRetry')!
    expect(submit().attributes('disabled')).toBeDefined()
    await wrapper.findAll('input:not([type=checkbox])')[0]!.setValue('verified receiver')
    await wrapper.findAll('input:not([type=checkbox])')[1]!.setValue('ticket-123')
    await wrapper.find('input[type=checkbox]').setValue(true)
    vi.mocked(retryTerminalDelivery).mockRejectedValueOnce(new Error('response lost'))
    await submit().trigger('click'); await flushPromises()
    await submit().trigger('click'); await flushPromises()
    const calls = vi.mocked(retryTerminalDelivery).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0]).toEqual(calls[1])
    expect(calls[0]).toMatchObject(['ta', 'RULE', 17, { expectedAttempt: 1, reason: 'verified receiver', reconciliationReference: 'ticket-123', confirmedNotDelivered: true }])
    expect(calls[0]![3].requestId).toMatch(/^[0-9a-f-]{36}$/)
    wrapper.unmount()
  })

  it('closes the target on tenant change and hides mutation for read-only roles', async () => {
    const wrapper = render(); await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === 'terminalNotifications.reconcileRetry')!.trigger('click')
    state.tenant.tenantId = 'tb'; await nextTick(); await flushPromises()
    expect(wrapper.find('section').exists()).toBe(false)
    expect(retryTerminalDelivery).not.toHaveBeenCalled()
    wrapper.unmount()
    state.admin = false
    const readonly = render(); await flushPromises()
    expect(readonly.findAll('button').some(b => b.text() === 'terminalNotifications.reconcileRetry')).toBe(false)
    readonly.unmount()
  })

  it('does not display a former tenant response after switching tenants', async () => {
    let oldResponse!: (rows: typeof failed[]) => void
    vi.mocked(listTerminalDeliveries).mockReturnValueOnce(new Promise(resolve => { oldResponse = resolve }))
      .mockResolvedValueOnce([])
    const wrapper = render()
    state.tenant.tenantId = 'tb'; await nextTick(); await flushPromises()
    oldResponse([failed]); await flushPromises()
    expect(wrapper.find('pre').text()).toBe('[]')
    wrapper.unmount()
  })
})
