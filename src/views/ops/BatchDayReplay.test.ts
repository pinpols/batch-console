// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import zhCN from '@/locales/zh-CN'
import { batchDayReplayApi } from '@/api/batchDayReplay'
import { jobApi } from '@/api/job'
import type { ReplayOperation, ReplayOperationPreview } from '@/api/batchDayReplay'
import BatchDayReplay from './BatchDayReplay.vue'

const state = vi.hoisted(() => ({ tenant: null as unknown as { tenantId: string } }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ writesFrozen: false }) }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    userInfo: { username: 'operator', authorities: ['ROLE_ADMIN'] },
    hasPermission: (permission: string) => permission === 'ROLE_ADMIN',
  }),
}))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({ writesFrozen: ref(false), ensureWriteAvailable: () => true }),
}))
vi.mock('@/api/job', () => ({ jobApi: { listCodes: vi.fn() } }))
vi.mock('@/api/batchDayReplay', () => ({
  batchDayReplayApi: {
    list: vi.fn(), operations: vi.fn(), previewRange: vi.fn(), submitRange: vi.fn(),
    operationSessions: vi.fn(),
  },
}))
vi.mock('element-plus', async importOriginal => ({
  ...await importOriginal<typeof import('element-plus')>(),
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

enableAutoUnmount(afterEach)
const labels = zhCN.batchDayReplay
const slotsStub = { template: '<div><slot name="header" /><slot /><slot name="actions" /></div>' }
const drawerStub = {
  props: ['modelValue', 'title'],
  template: '<section v-if="modelValue" :data-title="title"><slot /><footer><slot name="footer" /></footer></section>',
}
const inputStub = defineComponent({
  props: ['modelValue', 'type'], emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h(props.type === 'textarea' ? 'textarea' : 'input', {
      value: props.modelValue,
      onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
    })
  },
})
const datePickerStub = defineComponent({
  props: ['modelValue'], emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('div', [0, 1].map(index => h('input', {
      type: 'date', value: props.modelValue?.[index],
      onInput: (event: Event) => {
        const dates = [...(props.modelValue ?? ['', ''])]
        dates[index] = (event.target as HTMLInputElement).value
        emit('update:modelValue', dates)
      },
    })))
  },
})

function renderPage() {
  return mount(BatchDayReplay, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } })],
      directives: { loading: () => {} },
      stubs: {
        PageContainer: slotsStub, PageHeader: slotsStub, SectionCard: slotsStub,
        EmptyState: true, DatetimeColumn: true, StatusSegment: true,
        ElDrawer: drawerStub, ElInput: inputStub, ElDatePicker: datePickerStub,
        ElButton: {
          props: ['disabled', 'loading'],
          template: '<button :disabled="disabled || loading"><slot /></button>',
        },
        ElAlert: { template: '<aside><slot name="title" /><slot /></aside>' },
        ElTable: { props: ['data'], template: '<pre>{{ JSON.stringify(data) }}</pre>' },
        ElTableColumn: true, ElProgress: true, ElPagination: true,
        ElForm: slotsStub, ElFormItem: slotsStub, ElDescriptions: slotsStub,
        ElDescriptionsItem: slotsStub, ElTag: slotsStub, ElCollapse: slotsStub,
        ElCollapseItem: slotsStub, ElDivider: true, ElSelect: true, ElOption: true,
        ElSegmented: true, ElRadioGroup: true, ElRadio: true, ElRadioButton: true,
        ElInputNumber: true, ElSwitch: true,
      },
    },
  })
}

function button(container: Pick<DOMWrapper<Element>, 'findAll'>, text: string) {
  const result = container.findAll('button').find(item => item.text() === text)
  if (!result) throw new Error(`Button not found: ${text}`)
  return result
}

async function openRangeForm() {
  const page = renderPage()
  await flushPromises()
  await button(page, labels.rangeSubmitBtn).trigger('click')
  const drawer = page.get(`section[data-title="${labels.rangeSubmitTitle}"]`)
  await drawer.get('textarea').setValue('reconcile late files')
  await drawer.findAll('input[type=date]')[0]!.setValue('2026-10-21')
  await drawer.findAll('input[type=date]')[1]!.setValue('2026-10-22')
  return { page, drawer }
}

function preview(overrides: Partial<ReplayOperationPreview> = {}): ReplayOperationPreview {
  return {
    tenantId: 'tenant-a', operationKey: 'operation-a', previewToken: 'token-a',
    operationType: 'BATCH_DAY_RANGE', calendarCode: 'default', scope: 'ALL_FAILED',
    fromDate: '2026-10-21', throughDate: '2026-10-22', totalCandidateCount: 2,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    days: [{ bizDate: '2026-10-21', disposition: 'READY', candidateCount: 2 }],
    ...overrides,
  }
}

function operation(overrides: Partial<ReplayOperation> = {}): ReplayOperation {
  return {
    id: 701, tenantId: 'tenant-a', operationKey: 'operation-a', operationType: 'BATCH_DAY_RANGE',
    status: 'PENDING_APPROVAL', fromDate: '2026-10-21', throughDate: '2026-10-22',
    totalCount: 2, succeededCount: 0, failedCount: 0, inFlightCount: 0,
    requestedBy: 'operator', ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}

beforeEach(() => {
  state.tenant = reactive({ tenantId: 'tenant-a' })
  vi.mocked(jobApi.listCodes).mockReset().mockResolvedValue([])
  vi.mocked(batchDayReplayApi.list).mockReset().mockResolvedValue([])
  vi.mocked(batchDayReplayApi.operations).mockReset().mockResolvedValue([])
  vi.mocked(batchDayReplayApi.previewRange).mockReset().mockResolvedValue(preview())
  vi.mocked(batchDayReplayApi.submitRange).mockReset().mockResolvedValue(operation())
  vi.mocked(batchDayReplayApi.operationSessions).mockReset().mockResolvedValue([{
    id: 801, tenantId: 'tenant-a', replayOperationId: 701, calendarCode: 'default',
    bizDate: '2026-10-21', scope: 'ALL_FAILED', executionMode: 'REPLAY',
    candidateSource: 'EXISTING_INSTANCES', status: 'PENDING_APPROVAL',
  }])
  vi.mocked(ElMessage.error).mockReset()
  vi.mocked(ElMessage.success).mockReset()
})

describe('BatchDayReplay range interaction', () => {
  it('enables submission after preview and opens the returned operation with its child session', async () => {
    const { page, drawer } = await openRangeForm()
    expect(button(drawer, labels.submitConfirm).attributes('disabled')).toBeDefined()
    await button(drawer, labels.previewBtn).trigger('click')
    await flushPromises()

    expect(drawer.get('.preview-panel').text()).toContain('2026-10-21')
    expect(button(drawer, labels.submitConfirm).attributes('disabled')).toBeUndefined()
    await button(drawer, labels.submitConfirm).trigger('click')
    await flushPromises()

    expect(batchDayReplayApi.submitRange).toHaveBeenCalledExactlyOnceWith({
      tenantId: 'tenant-a', calendarCode: 'default', fromDate: '2026-10-21', throughDate: '2026-10-22',
      scope: 'ALL_FAILED', resultPolicy: 'CREATE_NEW_VERSION', configVersionPolicy: 'USE_ORIGINAL_CONFIG',
      reason: 'reconcile late files', requestedBy: 'operator', autoApprove: false,
      executionMode: 'REPLAY', candidateSource: 'EXISTING_INSTANCES',
      operationKey: 'operation-a', previewToken: 'token-a',
    })
    const detail = page.get(`section[data-title="${labels.operationDetailTitle}"]`)
    expect(detail.text()).toContain('701')
    expect(detail.text()).toContain('PENDING_APPROVAL')
    expect(detail.text()).toContain('801')
    expect(batchDayReplayApi.operationSessions).toHaveBeenCalledExactlyOnceWith(701, 'tenant-a')
  })

  it.each(['date', 'tenant'] as const)('invalidates a successful preview after changing %s', async change => {
    const { drawer } = await openRangeForm()
    await button(drawer, labels.previewBtn).trigger('click')
    await flushPromises()
    expect(button(drawer, labels.submitConfirm).attributes('disabled')).toBeUndefined()

    if (change === 'date') await drawer.findAll('input[type=date]')[1]!.setValue('2026-10-23')
    else { state.tenant.tenantId = 'tenant-b'; await nextTick() }

    expect(drawer.find('.preview-panel').exists()).toBe(false)
    expect(button(drawer, labels.submitConfirm).attributes('disabled')).toBeDefined()
    await button(drawer, labels.submitConfirm).trigger('click')
    expect(batchDayReplayApi.submitRange).not.toHaveBeenCalled()
  })

  it.each([
    ['date', 'before'], ['date', 'after'], ['tenant', 'before'], ['tenant', 'after'],
  ] as const)('keeps the current %s target when an older preview resolves %s it', async (change, order) => {
    const old = deferred<ReplayOperationPreview>()
    const current = deferred<ReplayOperationPreview>()
    vi.mocked(batchDayReplayApi.previewRange).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const { drawer } = await openRangeForm()
    await button(drawer, labels.previewBtn).trigger('click')
    if (change === 'date') await drawer.findAll('input[type=date]')[1]!.setValue('2026-10-23')
    else { state.tenant.tenantId = 'tenant-b'; await nextTick() }
    await button(drawer, labels.previewBtn).trigger('click')

    const currentPreview = preview({
      tenantId: change === 'tenant' ? 'tenant-b' : 'tenant-a',
      throughDate: change === 'date' ? '2026-10-23' : '2026-10-22',
      operationKey: 'current-operation', previewToken: 'current-token', totalCandidateCount: 7,
      days: [{ bizDate: '2026-10-22', disposition: 'READY', candidateCount: 7 }],
    })
    vi.mocked(batchDayReplayApi.submitRange).mockResolvedValueOnce(operation({
      tenantId: currentPreview.tenantId, throughDate: currentPreview.throughDate,
      operationKey: 'current-operation',
    }))
    if (order === 'before') {
      old.resolve(preview()); await flushPromises()
      expect(drawer.find('.preview-panel').exists()).toBe(false)
      expect(button(drawer, labels.previewBtn).attributes('disabled')).toBeDefined()
    }
    current.resolve(currentPreview); await flushPromises()
    if (order === 'after') { old.resolve(preview()); await flushPromises() }

    expect(drawer.get('.preview-panel').text()).toContain('2026-10-22')
    expect(drawer.get('.preview-panel').text()).not.toContain('2026-10-21')
    expect(button(drawer, labels.submitConfirm).attributes('disabled')).toBeUndefined()
    await button(drawer, labels.submitConfirm).trigger('click')
    await flushPromises()
    expect(batchDayReplayApi.submitRange).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      tenantId: currentPreview.tenantId, throughDate: currentPreview.throughDate,
      operationKey: 'current-operation', previewToken: 'current-token',
    }))
  })

  it('ignores a former target preview error after the current preview succeeds', async () => {
    const old = deferred<ReplayOperationPreview>()
    vi.mocked(batchDayReplayApi.previewRange).mockReturnValueOnce(old.promise)
    const { drawer } = await openRangeForm()
    await button(drawer, labels.previewBtn).trigger('click')
    state.tenant.tenantId = 'tenant-b'; await nextTick()
    vi.mocked(batchDayReplayApi.previewRange).mockResolvedValueOnce(preview({ tenantId: 'tenant-b' }))
    await button(drawer, labels.previewBtn).trigger('click'); await flushPromises()
    old.reject(new Error('former tenant preview failed')); await flushPromises()

    expect(ElMessage.error).not.toHaveBeenCalled()
    expect(drawer.find('.preview-panel').exists()).toBe(true)
    expect(button(drawer, labels.submitConfirm).attributes('disabled')).toBeUndefined()
  })

  it('does not open an old operation when the tenant changes during submission', async () => {
    const pending = deferred<ReplayOperation>()
    vi.mocked(batchDayReplayApi.submitRange).mockReturnValueOnce(pending.promise)
    const { page, drawer } = await openRangeForm()
    await button(drawer, labels.previewBtn).trigger('click'); await flushPromises()
    await button(drawer, labels.submitConfirm).trigger('click')
    expect(batchDayReplayApi.submitRange).toHaveBeenCalledOnce()
    state.tenant.tenantId = 'tenant-b'; await nextTick(); await flushPromises()
    pending.resolve(operation()); await flushPromises()

    expect(page.find(`section[data-title="${labels.operationDetailTitle}"]`).exists()).toBe(false)
    expect(batchDayReplayApi.operationSessions).not.toHaveBeenCalled()
    expect(drawer.find('.preview-panel').exists()).toBe(false)
    expect(button(drawer, labels.submitConfirm).attributes('disabled')).toBeDefined()
  })

  it('keeps the new tenant operation when former child sessions arrive late', async () => {
    const oldChildren = deferred<Awaited<ReturnType<typeof batchDayReplayApi.operationSessions>>>()
    vi.mocked(batchDayReplayApi.operationSessions).mockReturnValueOnce(oldChildren.promise)
    const { page, drawer } = await openRangeForm()
    await button(drawer, labels.previewBtn).trigger('click'); await flushPromises()
    await button(drawer, labels.submitConfirm).trigger('click'); await flushPromises()
    expect(batchDayReplayApi.operationSessions).toHaveBeenCalledWith(701, 'tenant-a')

    state.tenant.tenantId = 'tenant-b'; await nextTick(); await flushPromises()
    await button(page, labels.rangeSubmitBtn).trigger('click')
    const newDrawer = page.get(`section[data-title="${labels.rangeSubmitTitle}"]`)
    await newDrawer.findAll('input[type=date]')[0]!.setValue('2026-10-23')
    await newDrawer.findAll('input[type=date]')[1]!.setValue('2026-10-24')
    vi.mocked(batchDayReplayApi.previewRange).mockResolvedValueOnce(preview({
      tenantId: 'tenant-b', fromDate: '2026-10-23', throughDate: '2026-10-24',
    }))
    vi.mocked(batchDayReplayApi.submitRange).mockResolvedValueOnce(operation({
      id: 702, tenantId: 'tenant-b', fromDate: '2026-10-23', throughDate: '2026-10-24',
    }))
    vi.mocked(batchDayReplayApi.operationSessions).mockResolvedValueOnce([{
      id: 802, tenantId: 'tenant-b', replayOperationId: 702, calendarCode: 'default',
      bizDate: '2026-10-23', scope: 'ALL_FAILED', executionMode: 'REPLAY',
      candidateSource: 'EXISTING_INSTANCES', status: 'RUNNING',
    }])
    await button(newDrawer, labels.previewBtn).trigger('click'); await flushPromises()
    await button(newDrawer, labels.submitConfirm).trigger('click'); await flushPromises()
    oldChildren.resolve([{
      id: 801, tenantId: 'tenant-a', replayOperationId: 701, calendarCode: 'default',
      bizDate: '2026-10-21', scope: 'ALL_FAILED', executionMode: 'REPLAY',
      candidateSource: 'EXISTING_INSTANCES', status: 'PENDING_APPROVAL',
    }])
    await flushPromises()

    const detail = page.get(`section[data-title="${labels.operationDetailTitle}"]`)
    expect(detail.text()).toContain('702')
    expect(detail.text()).toContain('802')
    expect(detail.text()).not.toContain('801')
    expect(ElMessage.success).toHaveBeenCalledOnce()
  })
})
