// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, inject, provide, ref } from 'vue'
import type { ComputedRef, InjectionKey, PropType } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const {
  queryBatchDayWindow,
  catchUpScheduledOccurrence,
  tenantStore,
  launchBatchDayCatchUp,
  getBatchDayCatchUpRequestStatus,
  reconcileBatchDayCatchUpRequest,
  continueBatchDayCatchUpRequest,
  abandonUnpreparedBatchDayCatchUp,
  canManage,
} = vi.hoisted(() => ({
  queryBatchDayWindow: vi.fn(),
  launchBatchDayCatchUp: vi.fn(),
  getBatchDayCatchUpRequestStatus: vi.fn(),
  reconcileBatchDayCatchUpRequest: vi.fn(),
  continueBatchDayCatchUpRequest: vi.fn(),
  abandonUnpreparedBatchDayCatchUp: vi.fn(),
  canManage: { value: false },
  catchUpScheduledOccurrence: vi.fn(),
  tenantStore: { tenantId: 'tenant-a' },
}))

vi.mock('@/api/batchDays', () => ({
  launchBatchDayCatchUp,
  getBatchDayCatchUpRequestStatus,
  reconcileBatchDayCatchUpRequest,
  continueBatchDayCatchUpRequest,
  abandonUnpreparedBatchDayCatchUp,
  queryBatchDayWindow,
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { bizDate: '2026-10-15' }, query: { calendarCode: 'CALENDAR' } }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ userInfo: { username: 'admin' } }) }))
vi.mock('@/stores/tenant', async () => {
  const { reactive } = await import('vue')
  const state = reactive(tenantStore)
  return { useTenantStore: () => state }
})
vi.mock('@/api/workflow', () => ({ workflowApi: { catchUpScheduledOccurrence } }))
vi.mock('@/composables/useTenantReload', () => ({
  useTenantReload: (load: () => void | Promise<void>) => load(),
}))
vi.mock('@/composables/useRefreshAction', () => ({
  useRefreshAction: () => ({
    loading: ref(false),
    run: (load: () => void | Promise<void>) => load(),
  }),
}))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canManageSystem: computed(() => canManage.value),
    canMutateConfig: ref(true),
    hasPermission: () => false,
  }),
}))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({ writesFrozen: ref(false) }),
}))
vi.mock('@/composables/useListFilterFeedback', () => ({
  useListFilterFeedback: () => ({
    filterBusy: ref(false),
    runSearch: vi.fn(),
    runReset: vi.fn(),
    runRefresh: vi.fn(),
  }),
}))
vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn(), success: vi.fn() },
  ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') },
  ElButton: { name: 'ElButton' },
  ElDatePicker: { name: 'ElDatePicker' },
  ElSelect: { name: 'ElSelect' },
  ElOption: { name: 'ElOption' },
  ElDescriptions: { name: 'ElDescriptions' },
  ElDescriptionsItem: { name: 'ElDescriptionsItem' },
  ElTable: { name: 'ElTable' },
  ElTableColumn: { name: 'ElTableColumn' },
  ElTag: { name: 'ElTag' },
  ElForm: { name: 'ElForm' },
  ElFormItem: { name: 'ElFormItem' },
  ElInput: { name: 'ElInput' },
  ElDrawer: { name: 'ElDrawer' },
  ElDialog: { name: 'ElDialog' },
}))

import { ElMessage } from 'element-plus'
import { useTenantStore } from '@/stores/tenant'
import BatchDayWindow from './BatchDayWindow.vue'

const tableRows: InjectionKey<ComputedRef<Record<string, unknown>[]>> = Symbol('tableRows')
const ElTableStub = defineComponent({
  props: {
    data: { type: Array as PropType<Record<string, unknown>[]>, default: () => [] },
    emptyText: String,
  },
  setup(props, { slots }) {
    provide(
      tableRows,
      computed(() => props.data ?? []),
    )
    return () => h('div', { class: 'test-table' }, slots.default?.())
  },
})
const ElTableColumnStub = defineComponent({
  props: ['prop', 'label'],
  setup(props, { slots }) {
    const rows = inject(tableRows)
    return () =>
      h('div', { class: 'test-column' }, [
        h('span', props.label),
        ...(rows?.value ?? []).map((row: Record<string, unknown>) =>
          h('span', slots.default ? slots.default({ row }) : String(row[props.prop] ?? '')),
        ),
      ])
  },
})
const ElButtonStub = defineComponent({
  props: ['disabled'],
  setup(props, { attrs, slots }) {
    return () => h('button', { ...attrs, disabled: props.disabled }, slots.default?.())
  },
})
const ElInputStub = defineComponent({
  props: ['modelValue', 'disabled', 'type'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(props.type === 'textarea' ? 'textarea' : 'input', {
        value: props.modelValue,
        disabled: props.disabled,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLInputElement).value),
      })
  },
})
const ElDialogStub = defineComponent({
  props: ['modelValue'],
  setup(props, { slots }) {
    return () => (props.modelValue ? h('div', [slots.default?.(), slots.footer?.()]) : null)
  },
})

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      common: { noData: '无数据', cancel: '取消' },
      batchDayWindow: {
        description: '窗口',
        refresh: '刷新',
        catchUp: '补跑',
        dialogSubmit: '提交',
        recoveryNotFound: '尚未查到',
        recoveryAcknowledge: '已核对完成',
        recoveryAbandon: '放弃未建档请求',
        recoveryReconcile: '核对审批',
        recoveryVerifyTrigger: '核对触发',
        recoveryContinue: '继续提交',
        recoveryStorageError: '无法保存',
        submitSuccess: '提交 {n}',
        windowStatus: '窗口状态',
        bizDate: '业务日',
        dayStatus: '日状态',
        currentTime: '当前时间',
        cutoff: '截止时间',
        slaCutoff: 'SLA 截止',
        secondsToCutoff: '距截止',
        lateWindowClosed: '迟到窗口关闭',
        jobSummary: 'Job 汇总',
        scheduledOccurrences: '定时触发记录',
        noScheduledOccurrences: '没有定时触发记录',
        colWorkflow: 'Workflow',
        colScheduleVersion: '计划版本',
        colScheduledFire: '计划触发时间',
        colOccurrenceStatus: '触发状态',
        colRequestId: '请求 ID',
        colRejectionReason: '拒绝原因',
        occurrenceAction: '处置',
        occurrenceCatchUp: '补跑此触发',
        occurrenceCatchUpTitle: '补跑单次计划触发',
        occurrenceCatchUpReason: '补跑原因',
        occurrenceCatchUpConfirm: '确认补跑',
        occurrenceApprovalRequired: '需按策略审批',
        occurrenceStatuses: { CLOSED_DAY_REJECTED: '结算后触发已拒绝' },
        selectCalendarTitle: '选日历',
        selectCalendarDescription: '选日历',
        emptyDescription: '无数据',
        titleWithDate: '批次日 {date}',
      },
    },
  },
})

describe('BatchDayWindow', () => {
  beforeEach(() => {
    localStorage.clear()
    canManage.value = false
    launchBatchDayCatchUp.mockReset()
    getBatchDayCatchUpRequestStatus.mockReset()
    reconcileBatchDayCatchUpRequest.mockReset()
    continueBatchDayCatchUpRequest.mockReset()
    abandonUnpreparedBatchDayCatchUp.mockReset()
    tenantStore.tenantId = 'tenant-a'
    queryBatchDayWindow.mockReset()
    catchUpScheduledOccurrence.mockReset()
  })

  it('retains the original catch-up key after a lost response and restores status on reload', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    launchBatchDayCatchUp.mockRejectedValue(new Error('response lost'))
    getBatchDayCatchUpRequestStatus.mockResolvedValue({
      found: false,
      tenantId: 'tenant-a',
      items: [],
    })
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    await flushPromises()
    expect(launchBatchDayCatchUp).toHaveBeenCalledOnce()
    const key = launchBatchDayCatchUp.mock.calls[0][2]
    expect(key).toEqual(expect.any(String))
    expect(getBatchDayCatchUpRequestStatus).toHaveBeenCalledWith('tenant-a', key)
    expect(wrapper.text()).toContain('尚未查到')
    wrapper.unmount()
    const restored = mountBatchDayWindow()
    await flushPromises()
    expect(getBatchDayCatchUpRequestStatus).toHaveBeenLastCalledWith('tenant-a', key)
    expect(restored.text()).toContain('尚未查到')
    expect(
      restored
        .findAll('button')
        .find((button) => button.text() === '补跑')!
        .attributes('disabled'),
    ).toBeDefined()
    expect(launchBatchDayCatchUp).toHaveBeenCalledOnce()
    restored.unmount()
  })

  it('keeps the catch-up scope blocked when a rejected request was never prepared', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    launchBatchDayCatchUp.mockRejectedValue({
      response: { status: 404, data: { code: 'NOT_FOUND', data: null } },
    })
    getBatchDayCatchUpRequestStatus.mockResolvedValue({
      found: false,
      tenantId: 'tenant-a',
      items: [],
    })
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    await flushPromises()
    expect(getBatchDayCatchUpRequestStatus).toHaveBeenCalledWith(
      'tenant-a',
      launchBatchDayCatchUp.mock.calls[0][2],
    )
    expect(wrapper.text()).toContain('尚未查到')
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '补跑')!
        .attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.findAll('button').some((button) => button.text() === '已核对完成')).toBe(false)
    wrapper.unmount()
  })

  it('releases a missing request only after the server confirms its fence', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    launchBatchDayCatchUp.mockRejectedValue(new Error('request rejected'))
    getBatchDayCatchUpRequestStatus
      .mockResolvedValueOnce({ found: false, tenantId: 'tenant-a', items: [] })
      .mockResolvedValueOnce({
        found: true,
        tenantId: 'tenant-a',
        bizDate: '2026-10-15',
        calendarCode: 'CALENDAR',
        operationStatus: 'ABANDONED',
        items: [],
      })
    abandonUnpreparedBatchDayCatchUp.mockResolvedValue({})
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    await flushPromises()
    const originalKey = launchBatchDayCatchUp.mock.calls[0][2]
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '放弃未建档请求')!
      .trigger('click')
    await flushPromises()
    expect(abandonUnpreparedBatchDayCatchUp).toHaveBeenCalledWith(
      'tenant-a',
      originalKey,
      '2026-10-15',
      'CALENDAR',
    )
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '已核对完成')!
      .trigger('click')
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '补跑')!
        .attributes('disabled'),
    ).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps the original key if the fence fails or an existing batch wins', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    launchBatchDayCatchUp.mockRejectedValue(new Error('request rejected'))
    getBatchDayCatchUpRequestStatus
      .mockResolvedValueOnce({ found: false, tenantId: 'tenant-a', items: [] })
      .mockResolvedValueOnce({ found: false, tenantId: 'tenant-a', items: [] })
      .mockResolvedValueOnce({
        found: true,
        tenantId: 'tenant-a',
        bizDate: '2026-10-15',
        calendarCode: 'CALENDAR',
        operationStatus: 'RUNNING',
        items: [],
      })
    abandonUnpreparedBatchDayCatchUp
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({})
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '放弃未建档请求')!
      .trigger('click')
    await flushPromises()
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '补跑')!
        .attributes('disabled'),
    ).toBeDefined()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '放弃未建档请求')!
      .trigger('click')
    await flushPromises()
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '补跑')!
        .attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.findAll('button').some((button) => button.text() === '已核对完成')).toBe(false)
    expect(abandonUnpreparedBatchDayCatchUp).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('does not apply a completed catch-up response to a different tenant', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    getBatchDayCatchUpRequestStatus.mockResolvedValue({
      found: false,
      tenantId: 'tenant-a',
      items: [],
    })
    let finish!: (value: { items: never[] }) => void
    launchBatchDayCatchUp.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    vi.mocked(ElMessage.success).mockClear()
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    useTenantStore().tenantId = 'tenant-b'
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    expect(wrapper.findAll('button').some((button) => button.text() === '提交')).toBe(true)
    finish({ items: [] })
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(wrapper.findAll('button').some((button) => button.text() === '提交')).toBe(true)
    expect(getBatchDayCatchUpRequestStatus).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('ignores a response after switching away and back to the original tenant', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    getBatchDayCatchUpRequestStatus.mockResolvedValue({
      found: false,
      tenantId: 'tenant-a',
      items: [],
    })
    let finish!: (value: { items: never[] }) => void
    launchBatchDayCatchUp.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    vi.mocked(ElMessage.success).mockClear()
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    useTenantStore().tenantId = 'tenant-b'
    await flushPromises()
    useTenantStore().tenantId = 'tenant-a'
    await flushPromises()
    expect(getBatchDayCatchUpRequestStatus).toHaveBeenCalledOnce()
    finish({ items: [] })
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(getBatchDayCatchUpRequestStatus).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('requires acknowledging a confirmed complete request before another submission', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    launchBatchDayCatchUp.mockResolvedValue({ items: [] })
    getBatchDayCatchUpRequestStatus.mockResolvedValue({
      found: true,
      tenantId: 'tenant-a',
      bizDate: '2026-10-15',
      calendarCode: 'CALENDAR',
      operationStatus: 'COMPLETE',
      items: [],
    })
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    await flushPromises()
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '补跑')!
        .attributes('disabled'),
    ).toBeDefined()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '已核对完成')!
      .trigger('click')
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '补跑')!
        .attributes('disabled'),
    ).toBeUndefined()
    wrapper.unmount()
  })

  it('does not submit if the original key cannot be stored', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    expect(launchBatchDayCatchUp).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('无法保存')
    failure.mockRestore()
    wrapper.unmount()
  })

  it('reconciles an unknown manual approval using its original request key', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    launchBatchDayCatchUp.mockRejectedValue(new Error('response lost'))
    getBatchDayCatchUpRequestStatus.mockResolvedValue({
      found: true,
      tenantId: 'tenant-a',
      bizDate: '2026-10-15',
      calendarCode: 'CALENDAR',
      catchUpPolicy: 'MANUAL_APPROVAL',
      operationStatus: 'UNKNOWN',
      items: [{ jobCode: 'JOB_A', status: 'UNKNOWN' }],
    })
    reconcileBatchDayCatchUpRequest.mockResolvedValue({})
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    await flushPromises()
    const originalKey = launchBatchDayCatchUp.mock.calls[0][2]
    expect(wrapper.findAll('button').some((button) => button.text() === '继续提交')).toBe(false)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '核对审批')!
      .trigger('click')
    await flushPromises()
    expect(reconcileBatchDayCatchUpRequest).toHaveBeenCalledWith('tenant-a', originalKey, 'JOB_A')
    expect(launchBatchDayCatchUp).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('checks an unknown auto trigger using the original request key', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    launchBatchDayCatchUp.mockRejectedValue(new Error('response lost'))
    getBatchDayCatchUpRequestStatus.mockResolvedValue({
      found: true,
      tenantId: 'tenant-a',
      bizDate: '2026-10-15',
      calendarCode: 'CALENDAR',
      catchUpPolicy: 'AUTO',
      operationStatus: 'UNKNOWN',
      items: [{ jobCode: 'JOB_A', status: 'UNKNOWN' }],
    })
    reconcileBatchDayCatchUpRequest.mockResolvedValue({})
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    await flushPromises()
    const originalKey = launchBatchDayCatchUp.mock.calls[0][2]
    expect(wrapper.findAll('button').some((button) => button.text() === '继续提交')).toBe(false)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '核对触发')!
      .trigger('click')
    await flushPromises()
    expect(reconcileBatchDayCatchUpRequest).toHaveBeenCalledWith('tenant-a', originalKey, 'JOB_A')
    expect(launchBatchDayCatchUp).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('checks an in-flight receipt without offering continuation', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    launchBatchDayCatchUp.mockRejectedValue(new Error('response lost'))
    getBatchDayCatchUpRequestStatus.mockResolvedValue({
      found: true,
      tenantId: 'tenant-a',
      bizDate: '2026-10-15',
      calendarCode: 'CALENDAR',
      catchUpPolicy: 'AUTO',
      operationStatus: 'RUNNING',
      items: [{ jobCode: 'JOB_A', status: 'IN_FLIGHT' }],
    })
    reconcileBatchDayCatchUpRequest.mockResolvedValue({})
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.findAll('button').some((button) => button.text() === '继续提交')).toBe(false)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '核对触发')!
      .trigger('click')
    await flushPromises()
    expect(reconcileBatchDayCatchUpRequest).toHaveBeenCalledWith(
      'tenant-a',
      launchBatchDayCatchUp.mock.calls[0][2],
      'JOB_A',
    )
    expect(launchBatchDayCatchUp).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('continues only a resolved batch using the original request key', async () => {
    canManage.value = true
    queryBatchDayWindow.mockResolvedValue({ jobs: [], scheduledOccurrences: [] })
    launchBatchDayCatchUp.mockRejectedValue(new Error('response lost'))
    getBatchDayCatchUpRequestStatus.mockResolvedValue({
      found: true,
      tenantId: 'tenant-a',
      bizDate: '2026-10-15',
      calendarCode: 'CALENDAR',
      catchUpPolicy: 'MANUAL_APPROVAL',
      operationStatus: 'RUNNING',
      items: [
        { jobCode: 'JOB_A', status: 'ACCEPTED', referenceNo: 'apr-a' },
        { jobCode: 'JOB_B', status: 'PENDING' },
      ],
    })
    continueBatchDayCatchUpRequest.mockResolvedValue({})
    const wrapper = mountBatchDayWindow()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '补跑')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '提交')!
      .trigger('click')
    await flushPromises()
    const originalKey = launchBatchDayCatchUp.mock.calls[0][2]
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '继续提交')!
      .trigger('click')
    await flushPromises()
    expect(continueBatchDayCatchUpRequest).toHaveBeenCalledWith('tenant-a', originalKey)
    expect(launchBatchDayCatchUp).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('shows closed-day rejected scheduled fires with the durable reason and request link state', async () => {
    queryBatchDayWindow.mockResolvedValue({
      bizDate: '2026-10-15',
      dayStatus: 'SETTLED',
      currentSystemTime: '2026-10-15T03:00:00Z',
      jobs: [],
      scheduledOccurrences: [
        {
          workflowDefinitionId: 42,
          workflowCode: 'daily-settlement',
          scheduleVersion: 3,
          scheduledFireTime: '2026-10-15T02:00:00Z',
          bizDate: '2026-10-15',
          occurrenceStatus: 'CLOSED_DAY_REJECTED',
          requestId: null,
          lastRejectionReason: 'explicit CATCH_UP or RERUN request required',
          catchUpPolicy: 'MANUAL_APPROVAL',
        },
      ],
    })

    const wrapper = mountBatchDayWindow()
    await flushPromises()

    expect(wrapper.text()).toContain('定时触发记录')
    expect(wrapper.text()).toContain('daily-settlement')
    expect(wrapper.text()).toContain('结算后触发已拒绝')
    expect(wrapper.text()).toContain('explicit CATCH_UP or RERUN request required')
    expect(wrapper.text()).toContain('请求 ID')
    expect(wrapper.text()).toContain('补跑此触发')
  })

  it('does not submit an occurrence selected under a different tenant context', async () => {
    queryBatchDayWindow.mockResolvedValue({
      bizDate: '2026-10-15',
      dayStatus: 'SETTLED',
      currentSystemTime: '2026-10-15T03:00:00Z',
      jobs: [],
      scheduledOccurrences: [
        {
          workflowDefinitionId: 42,
          workflowCode: 'daily-settlement',
          scheduleVersion: 3,
          scheduledFireTime: '2026-10-15T02:00:00Z',
          bizDate: '2026-10-15',
          occurrenceStatus: 'CLOSED_DAY_REJECTED',
          requestId: null,
          lastRejectionReason: 'explicit CATCH_UP or RERUN request required',
          catchUpPolicy: 'MANUAL_APPROVAL',
        },
      ],
    })
    const wrapper = mountBatchDayWindow()
    await flushPromises()

    const openAction = wrapper.findAll('button').find((button) => button.text() === '补跑此触发')
    expect(openAction).toBeDefined()
    await openAction!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('textarea').length).toBeGreaterThan(1)

    tenantStore.tenantId = 'tenant-b'
    await wrapper.findAll('textarea').at(-1)!.setValue('reconcile this fire')
    const confirm = wrapper.findAll('button').find((button) => button.text() === '确认补跑')
    expect(confirm).toBeDefined()
    await confirm!.trigger('click')

    expect(catchUpScheduledOccurrence).not.toHaveBeenCalled()
  })

  it('submits the exact selected Workflow fire and business date with an audit reason', async () => {
    queryBatchDayWindow.mockResolvedValue({
      bizDate: '2026-10-15',
      dayStatus: 'SETTLED',
      currentSystemTime: '2026-10-15T03:00:00Z',
      jobs: [],
      scheduledOccurrences: [
        {
          workflowDefinitionId: 42,
          workflowCode: 'daily-settlement',
          scheduleVersion: 3,
          scheduledFireTime: '2026-10-15T02:00:00Z',
          bizDate: '2026-10-15',
          occurrenceStatus: 'CLOSED_DAY_REJECTED',
          requestId: null,
          lastRejectionReason: 'explicit CATCH_UP or RERUN request required',
          catchUpPolicy: 'AUTO',
        },
      ],
    })
    catchUpScheduledOccurrence.mockResolvedValue({
      requestId: 'catch-up-request-1',
      status: 'PENDING_APPROVAL',
      approvalId: 'approval-1',
    })
    const wrapper = mountBatchDayWindow()
    await flushPromises()

    const openAction = wrapper.findAll('button').find((button) => button.text() === '补跑此触发')
    await openAction!.trigger('click')
    await wrapper.findAll('textarea').at(-1)!.setValue('recover the missed scheduled fire')
    expect(wrapper.findAllComponents(ElInputStub).at(-1)?.props('modelValue')).toBe(
      'recover the missed scheduled fire',
    )
    const confirm = wrapper.findAll('button').find((button) => button.text() === '确认补跑')
    expect((wrapper.findAll('textarea').at(-1)!.element as HTMLTextAreaElement).value).toBe(
      'recover the missed scheduled fire',
    )
    await confirm!.trigger('click')
    await flushPromises()

    expect(catchUpScheduledOccurrence).toHaveBeenCalledWith(42, {
      tenantId: 'tenant-a',
      scheduledFireTime: '2026-10-15T02:00:00Z',
      bizDate: '2026-10-15',
      reason: 'recover the missed scheduled fire',
    })
  })
})

function mountBatchDayWindow() {
  return mount(BatchDayWindow, {
    global: {
      plugins: [i18n],
      stubs: {
        ElTable: ElTableStub,
        ElTableColumn: ElTableColumnStub,
        ElButton: ElButtonStub,
        ElTag: { template: '<span><slot /></span>' },
        ElDescriptions: { template: '<div><slot /></div>' },
        ElDescriptionsItem: { template: '<div><slot /></div>' },
        ElForm: { template: '<form><slot /></form>' },
        ElFormItem: { template: '<div><slot /></div>' },
        ElInput: ElInputStub,
        ElDrawer: { template: '<div><slot /><slot name="footer" /></div>' },
        ElDialog: ElDialogStub,
        DatetimeText: { props: ['value'], template: '<span>{{ value }}</span>' },
        PageContainer: { template: '<main><slot /></main>' },
        PageHeader: { template: '<header><slot /><slot name="actions" /></header>' },
        SectionCard: { template: '<section><slot name="header" /><slot /></section>' },
        ListPageQueryBar: { template: '<div><slot /></div>' },
        EmptyState: { template: '<div><slot /></div>' },
        'el-descriptions': { template: '<div><slot /></div>' },
        'el-descriptions-item': { template: '<div><slot /></div>' },
        'el-button': ElButtonStub,
        'el-date-picker': true,
        'el-select': true,
        'el-option': true,
        'el-form': { template: '<form><slot /></form>' },
        'el-form-item': { template: '<div><slot /></div>' },
        'el-input': ElInputStub,
        'el-drawer': { template: '<div><slot /><slot name="footer" /></div>' },
        'el-dialog': ElDialogStub,
        'el-tag': { template: '<span><slot /></span>' },
        'router-link': { template: '<a><slot /></a>' },
      },
    },
  })
}
