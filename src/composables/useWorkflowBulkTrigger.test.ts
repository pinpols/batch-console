// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'
import { workflowApi } from '@/api/workflow'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { useWorkflowBulkTrigger } from './useWorkflowBulkTrigger'

vi.mock('@/api/workflow', () => ({ workflowApi: { trigger: vi.fn(), triggerStatus: vi.fn() } }))
vi.mock('@/utils/userErrorMessage', () => ({ userErrorMessage: () => '请求未完成' }))

const trigger = vi.mocked(workflowApi.trigger)
const lookup = vi.mocked(workflowApi.triggerStatus)
const scopes: EffectScope[] = []
const target = (id: number) => ({ id, tenantId: 'ta', workflowCode: `WF_${id}`, enabled: true })
const date = '2026-10-24'

function model() {
  const tenant = ref('ta')
  const permission = ref(true)
  const scope = effectScope()
  scopes.push(scope)
  const bulk = scope.run(() => useWorkflowBulkTrigger({
    tenantId: () => tenant.value, canTrigger: () => permission.value,
  }))!
  return { bulk, tenant, permission, scope }
}

describe('useWorkflowBulkTrigger', () => {
  beforeEach(() => {
    sessionStorage.clear()
    trigger.mockReset()
    lookup.mockReset()
    trigger.mockResolvedValue('801')
  })
  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop()
    vi.restoreAllMocks()
  })

  it('逐项独立发起并保留部分成功，只重试明确拒绝的项目且原键不变', async () => {
    const { bulk } = model()
    trigger.mockResolvedValueOnce('801').mockRejectedValueOnce({ response: { status: 400 } })
    expect(bulk.prepare([target(1), target(2)], date)).toBe(true)
    const keys = bulk.entries.value.map((item) => item.idempotencyKey)
    await bulk.submit()
    expect(bulk.entries.value.map((item) => item.state)).toEqual(['SUBMITTED', 'FAILED'])
    expect(bulk.entries.value[0].receipt).toBe('801')

    await bulk.retryFailed()

    expect(trigger).toHaveBeenCalledTimes(3)
    expect(trigger.mock.calls[2]).toEqual([2, { tenantId: 'ta', bizDate: date, triggerType: 'MANUAL' }, keys[1]])
    expect(bulk.entries.value.map((item) => item.idempotencyKey)).toEqual(keys)
  })

  it('双击提交只发起一次，并发最多四项', async () => {
    const { bulk } = model()
    const complete: Array<(value: string) => void> = []
    trigger.mockImplementation(() => new Promise((resolve) => complete.push(resolve)))
    bulk.prepare(Array.from({ length: 9 }, (_, index) => target(index + 1)), date)
    const first = bulk.submit()
    await bulk.submit()
    expect(trigger).toHaveBeenCalledTimes(4)
    complete.splice(0).forEach((resolve) => resolve('801'))
    await vi.waitFor(() => expect(trigger).toHaveBeenCalledTimes(8))
    complete.splice(0).forEach((resolve) => resolve('802'))
    await vi.waitFor(() => expect(trigger).toHaveBeenCalledTimes(9))
    complete.splice(0).forEach((resolve) => resolve('803'))
    await first
    expect(bulk.entries.value.every((item) => item.state === 'SUBMITTED')).toBe(true)
  })

  it.each([undefined, 408, 409, 500, 502, 503, 504])('超时或不确定响应 %s 保持未知，重试和重建批次均被阻止', async (status) => {
    const { bulk } = model()
    trigger.mockRejectedValue({ response: status ? { status } : undefined })
    bulk.prepare([target(1)], date)
    await bulk.submit()
    expect(bulk.entries.value[0].state).toBe('UNKNOWN')
    await bulk.retryFailed()
    expect(bulk.clear()).toBe(false)
    expect(bulk.prepare([target(1)], date)).toBe(false)
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it('核对存在的原请求后只记录服务端状态，不再次发起，也不声称运行已完成', async () => {
    const { bulk } = model()
    trigger.mockRejectedValue(new Error('connection lost'))
    bulk.prepare([target(1)], date)
    const key = bulk.entries.value[0].idempotencyKey
    await bulk.submit()
    lookup.mockResolvedValue({ tenantId: 'ta', workflowDefinitionId: 1, bizDate: date,
      requestId: 'req-1', traceId: 'trace-1', requestStatus: 'WAITING', updatedAt: '2026-10-24T00:00:00Z' })
    await bulk.reconcile()
    expect(lookup).toHaveBeenCalledWith(1, 'ta', key)
    expect(bulk.entries.value[0]).toMatchObject({ state: 'SUBMITTED', requestStatus: 'WAITING', receipt: 'req-1' })
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it('查询404和错误身份回执都保持未知，不以查无结果证明未执行', async () => {
    const { bulk } = model()
    trigger.mockRejectedValue(new Error('timeout'))
    bulk.prepare([target(1)], date)
    await bulk.submit()
    lookup.mockRejectedValueOnce({ response: { status: 404 } })
    await bulk.reconcile()
    lookup.mockResolvedValue({ tenantId: 'tb', workflowDefinitionId: 1, bizDate: date,
      requestId: 'req-1', requestStatus: 'LAUNCHED', updatedAt: '2026-10-24T00:00:00Z' })
    await bulk.reconcile()
    expect(bulk.entries.value[0].state).toBe('UNKNOWN')
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it('台账已拒绝的请求显示拒绝，不提供相同键的无效重发', async () => {
    const { bulk } = model()
    trigger.mockRejectedValue(new Error('timeout'))
    bulk.prepare([target(1)], date)
    await bulk.submit()
    lookup.mockResolvedValue({ tenantId: 'ta', workflowDefinitionId: 1, bizDate: date,
      requestId: 'req-1', requestStatus: 'REJECTED', updatedAt: '2026-10-24T00:00:00Z' })
    await bulk.reconcile()
    expect(bulk.entries.value[0]).toMatchObject({ state: 'FAILED', requestStatus: 'REJECTED', retryable: false })
    await bulk.retryFailed()
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it('刷新后恢复原键，在途发送变为未知，只读核对后再决定后续动作', async () => {
    const first = model()
    trigger.mockImplementation(() => new Promise(() => {}))
    first.bulk.prepare([target(1)], date)
    void first.bulk.submit()
    const key = first.bulk.entries.value[0].idempotencyKey
    first.scope.stop()

    const second = model()
    expect(second.bulk.entries.value[0]).toMatchObject({ idempotencyKey: key, state: 'UNKNOWN' })
    await second.bulk.submit()
    await second.bulk.retryFailed()
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it('切租户立即停止剩余排队，旧响应不写入新租户状态，回切保留原在途键', async () => {
    const { bulk, tenant } = model()
    const complete: Array<(value: string) => void> = []
    trigger.mockImplementation(() => new Promise((resolve) => complete.push(resolve)))
    bulk.prepare(Array.from({ length: 6 }, (_, index) => target(index + 1)), date)
    const running = bulk.submit()
    tenant.value = 'tb'
    expect(bulk.entries.value).toEqual([])
    complete.forEach((resolve) => resolve('old-receipt'))
    await running
    expect(trigger).toHaveBeenCalledTimes(4)
    expect(bulk.entries.value).toEqual([])
    tenant.value = 'ta'
    expect(bulk.entries.value.filter((item) => item.state === 'UNKNOWN')).toHaveLength(4)
    expect(bulk.entries.value.filter((item) => item.state === 'PENDING')).toHaveLength(2)
  })

  it('拒绝停用、跨租户、重复目标、超过50项和非法日期，均零发送', () => {
    const { bulk } = model()
    expect(bulk.prepare([{ ...target(1), enabled: false }], date)).toBe(false)
    expect(bulk.prepare([{ ...target(1), tenantId: 'tb' }], date)).toBe(false)
    expect(bulk.prepare([target(1), target(1)], date)).toBe(false)
    expect(bulk.prepare(Array.from({ length: 51 }, (_, index) => target(index + 1)), date)).toBe(false)
    expect(bulk.prepare([target(1)], '2026-02-30')).toBe(false)
    expect(trigger).not.toHaveBeenCalled()
  })

  it('权限撤回后不能继续发起或重试', async () => {
    const { bulk, permission } = model()
    bulk.prepare([target(1)], date)
    permission.value = false
    await bulk.submit()
    expect(trigger).not.toHaveBeenCalled()
    expect(bulk.validationError.value).toBe('permission')
  })

  it('冻结日期和目标不随原选择排序或对象修改变化', async () => {
    const { bulk } = model()
    const targets = [target(1), target(2)]
    bulk.prepare(targets, date)
    targets.reverse()
    targets[0].id = 99
    await bulk.submit()
    expect(trigger.mock.calls.map((call) => call[0])).toEqual([1, 2])
  })

  it('无法先持久化身份时失败关闭，不向服务端发起', async () => {
    const { bulk } = model()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(bulk.prepare([target(1)], date)).toBe(false)
    await bulk.submit()
    expect(trigger).not.toHaveBeenCalled()
    expect(bulk.validationError.value).toBe('storage')
  })

  it('损坏草稿不会自动创建新的幂等身份', async () => {
    sessionStorage.setItem(STORAGE_KEYS.workflowBulkTriggerDraftPrefix + 'ta', '[{"state":"SENDING"}]')
    const { bulk } = model()
    expect(bulk.validationError.value).toBe('draft')
    expect(bulk.prepare([target(1)], date)).toBe(false)
    await bulk.submit()
    expect(trigger).not.toHaveBeenCalled()
  })

  it('发送前存储故障保持原待发项，恢复存储后沿用原键继续', async () => {
    const { bulk } = model()
    bulk.prepare([target(1)], date)
    const key = bulk.entries.value[0].idempotencyKey
    const store = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await bulk.submit()
    expect(trigger).not.toHaveBeenCalled()
    expect(bulk.entries.value[0].state).toBe('PENDING')
    store.mockRestore()
    await bulk.submit()
    expect(trigger.mock.calls[0][2]).toBe(key)
    expect(bulk.entries.value[0].state).toBe('SUBMITTED')
  })

  it('最多50项恰好允许且每项身份独立', () => {
    const { bulk } = model()
    expect(bulk.prepare(Array.from({ length: 50 }, (_, index) => target(index + 1)), date)).toBe(true)
    expect(new Set(bulk.entries.value.map((item) => item.idempotencyKey)).size).toBe(50)
  })

  it('语法损坏的草稿保持损坏状态，不覆盖原记录或生成新键', () => {
    const key = STORAGE_KEYS.workflowBulkTriggerDraftPrefix + 'ta'
    sessionStorage.setItem(key, '{broken')
    const { bulk } = model()
    expect(bulk.validationError.value).toBe('draft')
    expect(bulk.prepare([target(1)], date)).toBe(false)
    expect(sessionStorage.getItem(key)).toBe('{broken')
    expect(trigger).not.toHaveBeenCalled()
  })

  it('读取草稿暂时失败时不覆盖身份，恢复读取后先恢复原在途项', () => {
    const first = model()
    trigger.mockImplementation(() => new Promise(() => {}))
    first.bulk.prepare([target(1)], date)
    void first.bulk.submit()
    const originalKey = first.bulk.entries.value[0].idempotencyKey
    first.scope.stop()
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const { bulk } = model()
    expect(bulk.prepare([target(1)], date)).toBe(false)
    read.mockRestore()
    expect(bulk.prepare([target(1)], date)).toBe(false)
    expect(bulk.entries.value[0]).toMatchObject({ idempotencyKey: originalKey, state: 'UNKNOWN' })
    expect(trigger).toHaveBeenCalledTimes(1)
  })
})
