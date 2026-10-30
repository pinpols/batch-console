import { computed, onScopeDispose, ref, watch } from 'vue'
import { workflowApi, type WorkflowTriggerStatusResponse } from '@/api/workflow'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { createIdempotencyKey } from '@/utils/idempotency'
import { userErrorMessage } from '@/utils/userErrorMessage'

export const WORKFLOW_BULK_LIMIT = 50
const CONCURRENCY = 4
// 后端新增状态时由生成类型强制补齐，未知线上的响应仍拒绝解释为成功。
const REQUEST_STATES: Record<WorkflowTriggerStatusResponse['requestStatus'], true> = {
  PENDING: true, PROCESSING: true, ACCEPTED: true, WAITING: true, LAUNCHED: true,
  REJECTED: true, DUPLICATE: true, FORWARD_FAILED: true, GIVE_UP: true,
}
type ItemState = 'PENDING' | 'SENDING' | 'SUBMITTED' | 'FAILED' | 'UNKNOWN'
type ValidationError = 'selection' | 'tenant' | 'permission' | 'date' | 'draft' | 'storage' | ''

export interface WorkflowBulkTarget {
  id: number
  tenantId?: string | null
  workflowCode: string
  enabled?: boolean | null
}

export interface WorkflowBulkItem {
  workflowDefinitionId: number
  workflowCode: string
  tenantId: string
  bizDate: string
  idempotencyKey: string
  state: ItemState
  retryable: boolean
  receipt?: string
  requestStatus?: string
  error?: string
}

interface Options {
  tenantId: () => string
  canTrigger: () => boolean
  storage?: Storage
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isDraftItem(value: unknown, tenantId: string): value is WorkflowBulkItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<WorkflowBulkItem>
  return Number.isSafeInteger(item.workflowDefinitionId) && Number(item.workflowDefinitionId) > 0
    && typeof item.workflowCode === 'string' && item.tenantId === tenantId
    && typeof item.bizDate === 'string' && validDate(item.bizDate)
    && typeof item.idempotencyKey === 'string' && item.idempotencyKey.length > 0
    && item.idempotencyKey.length <= 128 && typeof item.retryable === 'boolean'
    && ['PENDING', 'SENDING', 'SUBMITTED', 'FAILED', 'UNKNOWN'].includes(item.state ?? '')
    && (item.receipt === undefined || typeof item.receipt === 'string')
    && (item.requestStatus === undefined || typeof item.requestStatus === 'string')
    && (item.error === undefined || typeof item.error === 'string')
}

/** 每项独立发起；持久化同一标签页的原键，刷新后先核对在途项。 */
export function useWorkflowBulkTrigger(options: Options) {
  const entries = ref<WorkflowBulkItem[]>([])
  const running = ref(false)
  const validationError = ref<ValidationError>('')
  let generation = 0
  let storageReadFailed = false
  const hasUnknown = computed(() => entries.value.some((item) => item.state === 'UNKNOWN'))
  const hasRetryable = computed(() => entries.value.some((item) => item.state === 'FAILED' && item.retryable))

  function draftKey(tenantId: string): string {
    return STORAGE_KEYS.workflowBulkTriggerDraftPrefix + encodeURIComponent(tenantId)
  }

  function storage(): Storage {
    return options.storage ?? window.sessionStorage
  }

  function persist(items = entries.value): boolean {
    try {
      const tenantId = options.tenantId()
      const key = draftKey(tenantId)
      const draft = JSON.stringify(items)
      storage().setItem(key, draft)
      return true
    } catch {
      validationError.value = 'storage'
      return false
    }
  }

  function restore() {
    generation++
    running.value = false
    entries.value = []
    validationError.value = ''
    storageReadFailed = false
    const tenantId = options.tenantId()
    if (!tenantId) return
    try {
      const raw = storage().getItem(draftKey(tenantId))
      if (!raw) return
      const items: unknown = JSON.parse(raw)
      const validItems = Array.isArray(items) && items.length <= WORKFLOW_BULK_LIMIT
        && items.every((item) => isDraftItem(item, tenantId))
      if (!validItems) {
        validationError.value = 'draft'
        return
      }
      const ids = new Set(items.map((item: WorkflowBulkItem) => item.workflowDefinitionId))
      const keys = new Set(items.map((item: WorkflowBulkItem) => item.idempotencyKey))
      if (ids.size !== items.length || keys.size !== items.length) {
        validationError.value = 'draft'
        return
      }
      entries.value = items.map((item: WorkflowBulkItem) => ({
        ...item, state: item.state === 'SENDING' ? 'UNKNOWN' : item.state,
      }))
      persist()
    } catch (error) {
      storageReadFailed = !(error instanceof SyntaxError)
      validationError.value = storageReadFailed ? 'storage' : 'draft'
    }
  }

  function prepare(targets: WorkflowBulkTarget[], bizDate: string): boolean {
    if (storageReadFailed) {
      restore()
      if (storageReadFailed) return false
    }
    const bulkPreparationIsBlocked =
      running.value || entries.value.length || validationError.value === 'draft'
    if (bulkPreparationIsBlocked) return false
    validationError.value = ''
    if (!options.canTrigger()) validationError.value = 'permission'
    else if (!validDate(bizDate)) validationError.value = 'date'
    else {
      const bulkSelectionIsInvalid =
        !targets.length || targets.length > WORKFLOW_BULK_LIMIT
        || new Set(targets.map((item) => item.id)).size !== targets.length
        || targets.some((item) => !Number.isSafeInteger(item.id) || item.id <= 0 || item.enabled !== true)
      if (bulkSelectionIsInvalid) {
        validationError.value = 'selection'
      } else if (!options.tenantId() || targets.some((item) => item.tenantId !== options.tenantId())) {
        validationError.value = 'tenant'
      }
    }
    if (validationError.value) return false
    const prepared: WorkflowBulkItem[] = targets.map((item) => ({
      workflowDefinitionId: item.id, workflowCode: item.workflowCode, tenantId: options.tenantId(),
      bizDate, idempotencyKey: createIdempotencyKey(), state: 'PENDING', retryable: false,
    }))
    if (!persist(prepared)) return false
    entries.value = prepared
    return true
  }

  function admitted(): boolean {
    if (storageReadFailed) {
      restore()
      if (storageReadFailed) return false
    }
    if (!options.canTrigger()) {
      validationError.value = 'permission'
      return false
    }
    if (validationError.value === 'storage') {
      if (!persist()) return false
      validationError.value = ''
    }
    return entries.value.every((item) => item.tenantId === options.tenantId())
      && validationError.value !== 'draft'
  }

  async function submitItem(item: WorkflowBulkItem, current: number) {
    const previousState = item.state
    item.state = 'SENDING'
    item.error = undefined
    item.retryable = false
    if (!persist()) {
      item.state = previousState
      return
    }
    try {
      const receipt = await workflowApi.trigger(item.workflowDefinitionId, {
        tenantId: item.tenantId, bizDate: item.bizDate, triggerType: 'MANUAL',
      }, item.idempotencyKey)
      if (generation !== current) return
      if (typeof receipt !== 'string' || !receipt.trim()) {
        item.state = 'UNKNOWN'
      } else {
        item.receipt = receipt
        item.state = 'SUBMITTED'
      }
    } catch (error) {
      if (generation !== current) return
      const status = (error as { response?: { status?: number } })?.response?.status
      // 仅请求明确被拒的状态允许重试；冲突、超时和服务端错误都先核对原台账。
      const rejected = status !== undefined && [400, 401, 403, 404, 422, 429].includes(status)
      item.state = rejected ? 'FAILED' : 'UNKNOWN'
      item.retryable = rejected
      item.error = userErrorMessage(error)
    }
    if (generation === current) persist()
  }

  async function reconcileItem(item: WorkflowBulkItem, current: number) {
    try {
      const receipt = await workflowApi.triggerStatus(item.workflowDefinitionId, item.tenantId, item.idempotencyKey)
      if (generation !== current) return
      if (!receipt || typeof receipt !== 'object') return
      const sameIdentity = receipt.tenantId === item.tenantId
        && receipt.workflowDefinitionId === item.workflowDefinitionId && receipt.bizDate === item.bizDate
      if (!sameIdentity || !receipt.requestId || !Object.hasOwn(REQUEST_STATES, receipt.requestStatus)) return
      item.receipt = receipt.requestId
      item.requestStatus = receipt.requestStatus
      item.state = ['REJECTED', 'GIVE_UP'].includes(receipt.requestStatus) ? 'FAILED' : 'SUBMITTED'
      item.retryable = false
      item.error = undefined
    } catch (error) {
      if (generation !== current) return
      // 404 也可能发生在原请求提交前；不能由一次查无结果推出可以重新发起。
      item.error = userErrorMessage(error)
    }
    if (generation === current) persist()
  }

  async function run(mode: 'pending' | 'failed' | 'unknown') {
    if (running.value || !admitted()) return
    const current = generation
    const candidates = entries.value.filter((item) => mode === 'pending' ? item.state === 'PENDING'
      : mode === 'failed' ? item.state === 'FAILED' && item.retryable : item.state === 'UNKNOWN')
    if (!candidates.length) return
    running.value = true
    let cursor = 0
    async function worker() {
      while (generation === current && admitted() && cursor < candidates.length) {
        const item = candidates[cursor++]
        if (mode === 'unknown') await reconcileItem(item, current)
        else await submitItem(item, current)
      }
    }
    try {
      const workerCount = Math.min(CONCURRENCY, candidates.length)
      const workers = Array.from({ length: workerCount }, worker)
      await Promise.all(workers)
    } finally {
      if (generation === current) running.value = false
    }
  }

  function clear(): boolean {
    if (running.value || hasUnknown.value) return false
    try {
      const tenantId = options.tenantId()
      const key = draftKey(tenantId)
      storage().removeItem(key)
      generation++
      entries.value = []
      validationError.value = ''
      return true
    } catch {
      validationError.value = 'storage'
      return false
    }
  }

  watch(options.tenantId, restore, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { generation++ })
  return { entries, running, validationError, hasUnknown, hasRetryable, prepare, clear,
    submit: () => run('pending'), retryFailed: () => run('failed'), reconcile: () => run('unknown') }
}
