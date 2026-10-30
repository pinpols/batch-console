// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import messages from '@/locales/zh-CN'
import Drawer from './BatchDayGovernanceDrawer.vue'

const api = vi.hoisted(() => ({
  preview: vi.fn(),
  window: vi.fn(),
  gaps: vi.fn(),
  operate: vi.fn(),
  control: vi.fn(),
}))
const tenant = reactive({ tenantId: 'tenant-a' })
const role = reactive({ admin: true })
vi.mock('@/api/batchDays', () => ({
  previewBatchDayCatchup: api.preview,
  queryBatchDayWindow: api.window,
  queryHistoricalBatchDayGaps: api.gaps,
  operateBatchDay: api.operate,
  controlBatchDayCatchup: api.control,
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ userInfo: { username: 'admin-a' } }) }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => tenant }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canManageSystem: computed(() => role.admin),
    canWriteSystem: computed(() => role.admin),
    hasPermission: (permission: string) =>
      role.admin ? permission === 'ROLE_ADMIN' : permission === 'ROLE_AUDITOR',
  }),
}))
vi.mock('element-plus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn() },
}))
function preview(date: string) {
  return {
    currentBizDate: date,
    lastScannedBizDate: date,
    cursorSource: 'PERSISTED_CURSOR',
    remainingRawDateCount: 0,
    nextScanRawBizDates: [],
    catchupPaused: false,
  }
}
const PassThrough = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.())
  },
})
function render() {
  return mount(Drawer, {
    props: { modelValue: true, calendarCode: 'CAL', bizDate: '2026-10-25' },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': messages } })],
      stubs: Object.fromEntries(
        [
          'ElDrawer',
          'ElAlert',
          'ElButton',
          'ElDescriptions',
          'ElDescriptionsItem',
          'DataState',
          'SectionCard',
          'ElForm',
          'ElFormItem',
          'ElDatePicker',
          'ElDialog',
          'ElSpace',
          'ElInput',
        ].map((name) => [name, PassThrough]),
      ),
    },
  })
}
describe('治理抽屉范围隔离', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    tenant.tenantId = 'tenant-a'
    role.admin = true
    api.window.mockResolvedValue({ dayStatus: 'OPEN', frozen: false })
  })
  it('切租户后迟到的旧响应不得覆盖新快照，清空租户立即清空旧数据', async () => {
    let resolveOld!: (value: unknown) => void
    api.preview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    api.preview.mockResolvedValue(preview('2026-10-26'))
    const wrapper = render()
    await flushPromises()
    tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.text()).toContain('2026-10-26')
    resolveOld(preview('2026-10-01'))
    await flushPromises()
    expect(wrapper.text()).toContain('2026-10-26')
    expect(wrapper.text()).not.toContain('2026-10-01')
    const calls = api.preview.mock.calls.length
    tenant.tenantId = ''
    await flushPromises()
    expect(wrapper.text()).not.toContain('2026-10-26')
    expect(api.preview).toHaveBeenCalledTimes(calls)
    wrapper.unmount()
  })
  it('审计员可读预览而不呈现治理写按钮', async () => {
    role.admin = false
    api.preview.mockResolvedValue(preview('2026-10-26'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('2026-10-26')
    expect(wrapper.text()).not.toContain(messages.batchDayGovernance.pause)
    expect(wrapper.text()).not.toContain(messages.batchDayGovernance.actions.FREEZE)
    expect(api.operate).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
