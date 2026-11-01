// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { BatchDayReplayEntry, BatchDayReplaySession, ReplayOperation } from '@/api/batchDayReplay'
import { useBatchDayReplay } from './useBatchDayReplay'

const mocks = vi.hoisted(() => ({
  context: null as unknown as { tenantId: string; username: string; loggedIn: boolean; profileLoaded: boolean; admin: boolean; frozen: boolean; session: number },
  confirm: vi.fn(), approveOperation: vi.fn(), cancelOperation: vi.fn(), approve: vi.fn(), cancel: vi.fn(),
  operations: vi.fn(), success: vi.fn(), error: vi.fn(),
  prompt: vi.fn(), retry: vi.fn(), detail: vi.fn(), entries: vi.fn(), list: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.context }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({
  get userInfo() { return { username: mocks.context.username, permissions: mocks.context.admin ? ['ROLE_ADMIN'] : [] } },
  get isLoggedIn() { return mocks.context.loggedIn },
  get profileLoaded() { return mocks.context.profileLoaded },
  hasPermission: (permission: string) => permission === 'ROLE_ADMIN' && mocks.context.admin,
}) }))
vi.mock('@/api/authSession', () => ({ currentAuthSession: () => mocks.context.session, isSharedAuthRevisionCurrent: () => true }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: () => {} }))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('@/composables/useWriteAvailability', () => ({ useWriteAvailability: () => ({
  writesFrozen: { get value() { return mocks.context.frozen } },
  ensureWriteAvailable: () => !mocks.context.frozen,
}) }))
vi.mock('vue-i18n', async (original) => ({ ...(await original<typeof import('vue-i18n')>()), useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('element-plus', async (original) => ({ ...(await original<typeof import('element-plus')>()), ElMessage: { success: mocks.success, warning: vi.fn(), error: mocks.error }, ElMessageBox: { prompt: mocks.prompt } }))
vi.mock('@/api/job', () => ({ jobApi: { listCodes: vi.fn() } }))
vi.mock('@/api/batchDayReplay', () => ({ batchDayReplayApi: {
  approveOperation: mocks.approveOperation, cancelOperation: mocks.cancelOperation,
  approve: mocks.approve, cancel: mocks.cancel, operations: mocks.operations,
  retryFailedSubmission: mocks.retry, detail: mocks.detail, entries: mocks.entries, list: mocks.list,
} }))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.context = reactive({ tenantId: 'tenant-a', username: 'admin', loggedIn: true, profileLoaded: true, admin: true, frozen: false, session: 1 })
  for (const mock of [mocks.confirm, mocks.approveOperation, mocks.cancelOperation, mocks.approve, mocks.cancel, mocks.operations, mocks.success, mocks.error, mocks.prompt, mocks.retry, mocks.detail, mocks.entries, mocks.list]) mock.mockReset()
  mocks.confirm.mockResolvedValue(undefined)
  mocks.operations.mockResolvedValue([])
  mocks.prompt.mockResolvedValue({ value: 'reason' })
  mocks.detail.mockResolvedValue(session(1))
  mocks.entries.mockResolvedValue([])
  mocks.list.mockResolvedValue([])
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
function operation(id = 1): ReplayOperation {
  return { id, tenantId: 'tenant-a', operationKey: `op-${id}`, operationType: 'BATCH_DAY_RANGE', status: 'PENDING_APPROVAL', totalCount: 1, succeededCount: 0, failedCount: 0, inFlightCount: 0, requestedBy: 'requester', fromDate: '2026-10-20', throughDate: '2026-10-21' }
}
function session(id = 1): BatchDayReplaySession {
  return { id, tenantId: 'tenant-a', calendarCode: 'CAL', bizDate: '2026-10-20', scope: 'ALL', executionMode: 'REPLAY', candidateSource: 'EXISTING_INSTANCES', status: 'PENDING_APPROVAL', requestedBy: 'requester' }
}
function entry(): BatchDayReplayEntry {
  return { id: 7, sessionId: 1, tenantId: 'tenant-a', status: 'FAILED', rerunInstanceId: null }
}
type ReplayModel = ReturnType<typeof useBatchDayReplay>
function setup() {
  let model!: ReplayModel
  mount(defineComponent({ setup() { model = useBatchDayReplay(); return () => h('div') } }))
  return model
}
const actions = ['approveOperation', 'cancelOperation', 'doApprove', 'doCancel'] as const
type Action = (typeof actions)[number]
function open(model: ReplayModel, action: Action, id: number) {
  if (action === 'approveOperation' || action === 'cancelOperation') {
    model.currentOperation.value = operation(id)
    model.operationDrawerOpen.value = true
  } else {
    model.currentSession.value = session(id)
    model.detailDrawerOpen.value = true
  }
}
function apiMock(action: Action) {
  return action === 'doApprove' ? mocks.approve : action === 'doCancel' ? mocks.cancel : mocks[action]
}

describe('replay confirmation context', () => {
  it('keeps operations current if maintenance changes during loading', async () => {
    const response = deferred<ReplayOperation[]>()
    mocks.operations.mockReturnValueOnce(response.promise)
    mocks.approveOperation.mockResolvedValueOnce({ ...operation(1), status: 'RUNNING' })
    const model = setup()
    open(model, 'approveOperation', 1)
    const pending = model.approveOperation()
    await flushPromises()
    expect(mocks.operations).toHaveBeenCalledTimes(1)
    mocks.context.frozen = true
    mocks.context.frozen = false
    response.resolve([operation(2)])
    await pending
    await flushPromises()
    expect(model.operations.value.map((item) => item.id)).toEqual([2])
  })

  it('reloads operations after the new tenant profile is ready', async () => {
    const model = setup()
    model.operations.value = [operation()]
    mocks.context.profileLoaded = false
    mocks.context.tenantId = 'tenant-b'
    expect(model.operations.value).toEqual([])
    mocks.operations.mockResolvedValueOnce([{ ...operation(2), tenantId: 'tenant-b' }])
    mocks.context.profileLoaded = true
    await flushPromises()
    expect(mocks.operations).toHaveBeenCalledWith({ tenantId: 'tenant-b', limit: 50 })
    expect(model.operations.value.map((item) => item.id)).toEqual([2])
  })

  it.each(['tenant', 'target'] as const)('does not retry after %s changes while entering a reason', async (changed) => {
    const prompt = deferred<{ value: string }>()
    mocks.prompt.mockReturnValueOnce(prompt.promise)
    const model = setup()
    open(model, 'doCancel', 1)
    const failed = entry()
    model.entries.value = [failed]
    const pending = model.retryFailedSubmission(failed)
    if (changed === 'tenant') mocks.context.tenantId = 'tenant-b'
    else open(model, 'doCancel', 2)
    prompt.resolve({ value: 'reason' })
    await pending
    expect(mocks.retry).not.toHaveBeenCalled()
  })

  it('rejects retry for an unprivileged role and hides the action', async () => {
    mocks.context.admin = false
    const model = setup()
    open(model, 'doCancel', 1)
    const failed = entry()
    model.entries.value = [failed]
    expect(model.canRetryEntry(failed)).toBe(false)
    await model.retryFailedSubmission(failed)
    expect(mocks.prompt).not.toHaveBeenCalled()
    expect(mocks.retry).not.toHaveBeenCalled()
  })

  it('retries the selected failed entry as an administrator and refreshes its real data', async () => {
    const model = setup()
    open(model, 'doCancel', 1)
    const failed = entry()
    model.entries.value = [failed]
    mocks.retry.mockResolvedValueOnce({ ...session(1), status: 'RUNNING' })
    mocks.entries.mockResolvedValueOnce([{ ...failed, status: 'PENDING' }])
    expect(model.canRetryEntry(failed)).toBe(true)
    await model.retryFailedSubmission(failed)
    const pattern = mocks.prompt.mock.calls[0]![2].inputPattern as RegExp
    expect(pattern.test('reason')).toBe(true)
    expect(pattern.test('   ')).toBe(false)
    expect(mocks.retry).toHaveBeenCalledExactlyOnceWith(1, 7, 'tenant-a', 'reason')
    expect(model.currentSession.value?.status).toBe('RUNNING')
    expect(model.entries.value[0]?.status).toBe('PENDING')
    expect(mocks.success).toHaveBeenCalledTimes(1)
  })

  it('ignores a late retry response after the selected session changes', async () => {
    const response = deferred<BatchDayReplaySession>()
    mocks.retry.mockReturnValueOnce(response.promise)
    const model = setup()
    open(model, 'doCancel', 1)
    const failed = entry()
    model.entries.value = [failed]
    const pending = model.retryFailedSubmission(failed)
    await flushPromises()
    expect(mocks.retry).toHaveBeenCalledWith(1, 7, 'tenant-a', 'reason')
    open(model, 'doCancel', 2)
    response.resolve(session(1))
    await pending
    expect(model.currentSession.value?.id).toBe(2)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.detail).not.toHaveBeenCalled()
  })

  it.each(actions)('%s sends the confirmed target and current authenticated context', async (action) => {
    const target = action === 'approveOperation' || action === 'cancelOperation' ? operation(1) : session(1)
    apiMock(action).mockResolvedValueOnce({ ...target, status: action === 'approveOperation' || action === 'doApprove' ? 'RUNNING' : 'CANCELLED' })
    const model = setup()
    open(model, action, 1)
    await model[action]()
    expect(apiMock(action)).toHaveBeenCalledExactlyOnceWith(...(action === 'approveOperation' || action === 'doApprove' ? [1, 'admin', 'tenant-a'] : [1, 'tenant-a']))
    expect(mocks.success).toHaveBeenCalledTimes(1)
  })

  it.each(actions)('%s does not act on a different selected target after confirmation opens', async (action) => {
    const confirmation = deferred<void>()
    mocks.confirm.mockReturnValueOnce(confirmation.promise)
    const model = setup()
    open(model, action, 1)
    const pending = model[action]()
    open(model, action, 2)
    confirmation.resolve()
    await pending
    expect(apiMock(action)).not.toHaveBeenCalled()
  })

  it.each(actions)('%s discards a late response after a tenant and target change', async (action) => {
    const response = deferred<ReplayOperation | BatchDayReplaySession>()
    apiMock(action).mockReturnValueOnce(response.promise)
    const model = setup()
    open(model, action, 1)
    const pending = model[action]()
    await flushPromises()
    expect(apiMock(action)).toHaveBeenCalledTimes(1)
    mocks.context.tenantId = 'tenant-b'
    open(model, action, 2)
    response.resolve(action === 'approveOperation' || action === 'cancelOperation' ? operation(1) : session(1))
    await pending
    expect(action === 'approveOperation' || action === 'cancelOperation' ? model.currentOperation.value?.id : model.currentSession.value?.id).toBe(2)
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it.each(['tenant', 'actor', 'session', 'permission', 'maintenance'] as const)('does not approve after %s changes while confirmation is open', async (changed) => {
    const confirmation = deferred<void>()
    mocks.confirm.mockReturnValueOnce(confirmation.promise)
    const model = setup()
    open(model, 'approveOperation', 1)
    const pending = model.approveOperation()
    if (changed === 'tenant') mocks.context.tenantId = 'tenant-b'
    if (changed === 'actor') mocks.context.username = 'someone-else'
    if (changed === 'session') mocks.context.session++
    if (changed === 'permission') mocks.context.admin = false
    if (changed === 'maintenance') mocks.context.frozen = true
    confirmation.resolve()
    await pending
    expect(mocks.approveOperation).not.toHaveBeenCalled()
  })
})
