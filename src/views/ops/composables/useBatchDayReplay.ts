import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { confirmDanger } from '@/composables/useDangerConfirm'
import { userErrorMessage } from '@/utils/userErrorMessage'
import type { StatusSegmentItem } from '@/components/table/StatusSegment.vue'
import { todayBusinessDate } from '@/utils/datetime'
import {
  batchDayReplayRangeRequestKey,
  batchDayReplayRequestKey,
  isReplayPreviewCurrent,
  isReplayRangePreviewCurrent,
} from '@/utils/batchDayReplayForm'
import {
  batchDayReplayApi,
  type BatchDayReplaySession,
  type BatchDayReplayEntry,
  type BatchDayReplaySubmitRequest,
  type BatchDayReplayPreview,
  type BatchDayReplayRangeRequest,
  type ReplayOperation,
  type ReplayOperationPreview,
} from '@/api/batchDayReplay'
import { useTenantStore } from '@/stores/tenant'
import { useTenantReload } from '@/composables/useTenantReload'
import { useAuthStore } from '@/stores/auth'
import { useWriteAvailability } from '@/composables/useWriteAvailability'
import { buildBatchDayReplayRequest } from '@/utils/batchDayReplayForm'
import { jobApi } from '@/api/job'

/** 批次日重放的页面状态与请求生命周期；由页面setup持有并随页面卸载释放watch。 */
export function useBatchDayReplay() {
  const { t } = useI18n({ useScope: 'global' })
  const isPreviewExpired = (expiresAt: string): boolean => {
    const expirationTime = Date.parse(expiresAt)
    const currentTime = Date.now()
    return expirationTime <= currentTime
  }
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const { writesFrozen, ensureWriteAvailable } = useWriteAvailability()

  const sessions = ref<BatchDayReplaySession[]>([])
  const operations = ref<ReplayOperation[]>([])
  const operationSessions = ref<BatchDayReplaySession[]>([])
  const loadingOperationSessions = ref(false)
  let operationSessionsSequence = 0
  const loadingOperations = ref(false)
  const loadingSessions = ref(false)
  const loadingDetail = ref(false)
  const historyUnavailable = ref(false)
  const rangeDrawerOpen = ref(false)
  const rangeDates = ref<[string, string] | null>(null)
  const rangePreview = ref<ReplayOperationPreview | null>(null)
  const rangePreviewRequestKey = ref<string | null>(null)
  const rangePreviewDraftKey = ref<string | null>(null)
  const rangePreviewing = ref(false)
  let rangePreviewSequence = 0
  const rangeSubmitting = ref(false)
  const selectedRangeJobCodes = ref<string[]>([])
  const rangeVersionIdsText = ref('')
  const rangeForm = reactive<
    Omit<BatchDayReplayRangeRequest, 'fromDate' | 'throughDate' | 'operationKey' | 'previewToken'>
  >({
    tenantId: tenant.tenantId,
    calendarCode: 'default',
    scope: 'ALL_FAILED',
    resultPolicy: 'CREATE_NEW_VERSION',
    configVersionPolicy: 'USE_ORIGINAL_CONFIG',
    reason: '',
    requestedBy: auth.userInfo?.username ?? '',
    autoApprove: false,
    executionMode: 'REPLAY',
    candidateSource: 'EXISTING_INSTANCES',
  })
  const rangeDraftKey = computed(() =>
    JSON.stringify({
      tenantId: tenant.tenantId,
      dates: rangeDates.value,
      form: { ...rangeForm },
      jobCodes: [...selectedRangeJobCodes.value],
      versionIdsText: rangeVersionIdsText.value,
    }),
  )
  const isCurrentRangePreview = computed(
    () => rangePreviewDraftKey.value !== null && rangePreviewDraftKey.value === rangeDraftKey.value,
  )
  const operationDrawerOpen = ref(false)
  const currentOperation = ref<ReplayOperation | null>(null)
  const operationActing = ref(false)
  const canApproveOperation = computed(
    () => currentOperation.value?.status === 'PENDING_APPROVAL' && isPlatformAdmin.value,
  )
  const canCancelOperation = computed(() => {
    const operation = currentOperation.value
    if (!operation) return false
    const operationStatusIsNotCancellable =
      operation.status !== 'RUNNING' && operation.status !== 'PENDING_APPROVAL'
    if (operationStatusIsNotCancellable) return false
    return isPlatformAdmin.value || operation.requestedBy === auth.userInfo?.username
  })

  watch(
    () => [
      rangeForm.calendarCode,
      rangeDates.value?.[0],
      rangeDates.value?.[1],
      rangeForm.scope,
      rangeForm.executionMode,
      rangeForm.candidateSource,
      rangeForm.resultPolicy,
      rangeForm.configVersionPolicy,
      rangeForm.configVersion,
      rangeForm.reason,
      rangeForm.autoApprove,
      tenant.tenantId,
      selectedRangeJobCodes.value.join(','),
      rangeVersionIdsText.value,
    ],
    () => {
      rangePreviewSequence += 1
      rangePreview.value = null
      rangePreviewRequestKey.value = null
      rangePreviewDraftKey.value = null
      rangePreviewing.value = false
      rangeSubmitting.value = false
    },
    { flush: 'sync' },
  )

  watch(
    () => rangeForm.executionMode,
    (mode) => {
      if (mode === 'DRY_RUN') {
        rangeForm.resultPolicy = 'DRY_RUN_ONLY'
        if (rangeForm.scope === 'OUTPUTS_ONLY') rangeForm.scope = 'ALL'
      } else {
        rangeForm.candidateSource = 'EXISTING_INSTANCES'
        rangeForm.resultPolicy = 'CREATE_NEW_VERSION'
      }
    },
  )

  watch(
    () => rangeForm.candidateSource,
    (source) => {
      if (source === 'SCHEDULE_PLAN' && rangeForm.scope === 'ALL_FAILED') {
        rangeForm.scope = 'ALL'
      }
    },
  )

  const submitDrawerOpen = ref(false)
  const submitting = ref(false)
  const submissionOutcomeUnknown = ref<BatchDayReplaySubmitRequest | null>(null)
  const submitForm = reactive<BatchDayReplaySubmitRequest>({
    tenantId: tenant.tenantId,
    calendarCode: 'default',
    bizDate: todayBusinessDate(),
    scope: 'ALL',
    executionMode: 'REPLAY',
    candidateSource: 'EXISTING_INSTANCES',
    resultPolicy: 'CREATE_NEW_VERSION',
    configVersionPolicy: 'USE_ORIGINAL_CONFIG',
    reason: '',
    requestedBy: auth.userInfo?.username ?? '',
    autoApprove: false,
  })
  const selectedJobCodes = ref<string[]>([])
  const selectedOutputJobCodes = ref<string[]>([])
  const selectedVersionIds = ref<number[]>([])
  const jobCodeOptions = ref<string[]>([])
  const loadingJobCodes = ref(false)
  const loadingOutputVersions = ref(false)
  const outputVersionOptions = ref<Array<{ id: number; label: string }>>([])
  let versionLookupGeneration = 0
  const versionIdsText = ref('')
  const preview = ref<BatchDayReplayPreview | null>(null)
  const previewing = ref(false)
  const previewRequestKey = ref<string | null>(null)
  const previewPage = ref(1)
  const previewPageSize = 20
  const replayScopeLabel = (scope: string) => {
    const labels: Record<string, string> = {
      ALL: t('batchDayReplay.scopeAll'),
      ALL_FAILED: t('batchDayReplay.scopeAllFailed'),
      SUBSET_JOB_CODES: t('batchDayReplay.scopeSubsetJobCodes'),
      OUTPUTS_ONLY: t('batchDayReplay.scopeOutputsOnly'),
    }
    return labels[scope] ?? scope
  }
  const replayActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      RERUN_INSTANCE: t('batchDayReplay.previewActionRerun'),
      LAUNCH_SCHEDULE_PLAN: t('batchDayReplay.previewActionLaunch'),
      PROMOTE_RESULT_VERSION: t('batchDayReplay.previewActionPromote'),
    }
    return labels[action] ?? action
  }
  const previewPageEntries = computed(() => {
    const start = (previewPage.value - 1) * previewPageSize
    return preview.value?.entries.slice(start, start + previewPageSize) ?? []
  })

  watch(
    () => [
      submitForm.calendarCode,
      submitForm.bizDate,
      submitForm.scope,
      submitForm.executionMode,
      submitForm.candidateSource,
      submitForm.resultPolicy,
      submitForm.configVersionPolicy,
      submitForm.configVersion,
      submitForm.reason,
      submitForm.autoApprove,
      selectedJobCodes.value.join(','),
      selectedOutputJobCodes.value.join(','),
      normalizedVersionIdsText(),
    ],
    () => {
      preview.value = null
      previewRequestKey.value = null
      previewPage.value = 1
    },
  )

  watch(
    () => submitForm.executionMode,
    (mode) => {
      if (mode === 'DRY_RUN') {
        submitForm.resultPolicy = 'DRY_RUN_ONLY'
        if (submitForm.scope === 'OUTPUTS_ONLY') {
          submitForm.scope = 'ALL'
        }
      } else {
        submitForm.candidateSource = 'EXISTING_INSTANCES'
        submitForm.resultPolicy = 'CREATE_NEW_VERSION'
      }
    },
  )

  watch(
    () => submitForm.candidateSource,
    (source) => {
      if (source === 'SCHEDULE_PLAN' && submitForm.scope === 'ALL_FAILED') {
        submitForm.scope = 'ALL'
      }
    },
  )

  watch(
    () => [submitForm.scope, submitForm.bizDate, tenant.tenantId, ...selectedOutputJobCodes.value],
    async ([scope, bizDate, tenantId]) => {
      const generation = ++versionLookupGeneration
      loadingOutputVersions.value = false
      selectedVersionIds.value = []
      outputVersionOptions.value = []
      const outputVersionLookupIsApplicable =
        scope === 'OUTPUTS_ONLY' && Boolean(bizDate) && selectedOutputJobCodes.value.length > 0
      if (!outputVersionLookupIsApplicable) return

      loadingOutputVersions.value = true
      try {
        const versionsByJob = await Promise.all(
          selectedOutputJobCodes.value.map(async (jobCode) => {
            const versions = await batchDayReplayApi.resultVersions(
              tenantId,
              `job:${jobCode}:${bizDate}`,
            )
            return versions
              .filter((version) => version.status === 'PENDING')
              .map((version) => ({
                id: version.id,
                label: `${jobCode} · v${version.versionNo} · ${version.status} · #${version.id}`,
              }))
          }),
        )
        if (generation === versionLookupGeneration)
          outputVersionOptions.value = versionsByJob.flat()
      } catch (error) {
        if (generation === versionLookupGeneration) {
          ElMessage.error(userErrorMessage(error))
        }
      } finally {
        if (generation === versionLookupGeneration) loadingOutputVersions.value = false
      }
    },
  )

  const detailDrawerOpen = ref(false)
  const currentSession = ref<BatchDayReplaySession | null>(null)
  const entries = ref<BatchDayReplayEntry[]>([])
  const retryingEntryId = ref<number | null>(null)
  const loadingEntries = ref(false)
  const entriesStatusFilter = ref<'' | 'PENDING' | 'SUCCEEDED' | 'FAILED'>('')
  const entriesStatusItems = computed<StatusSegmentItem[]>(() => [
    { value: '', label: t('batchDayReplay.allEntries'), tone: 'neutral' },
    {
      value: 'PENDING',
      label: t('batchDayReplay.entryStatusPending'),
      tone: 'warning',
    },
    {
      value: 'SUCCEEDED',
      label: t('batchDayReplay.entryStatusSucceeded'),
      tone: 'success',
    },
    {
      value: 'FAILED',
      label: t('batchDayReplay.entryStatusFailed'),
      tone: 'danger',
    },
  ])
  const approving = ref(false)
  const cancelling = ref(false)

  const isPlatformAdmin = computed(() => auth.hasPermission('ROLE_ADMIN'))

  /** 仅 PENDING_APPROVAL 状态 + ADMIN 角色可以审批 */
  const canApprove = computed(
    () =>
      !writesFrozen.value &&
      currentSession.value?.status === 'PENDING_APPROVAL' &&
      isPlatformAdmin.value,
  )
  /** RUNNING / PENDING_APPROVAL 都可取消;ADMIN 或 提交人本人 */
  const canCancel = computed(() => {
    const s = currentSession.value
    if (!s || writesFrozen.value) return false
    if (s.status !== 'RUNNING' && s.status !== 'PENDING_APPROVAL') return false
    return isPlatformAdmin.value || s.requestedBy === auth.userInfo?.username
  })

  function scopeTagType(scope: string): 'primary' | 'warning' | 'success' | 'info' {
    if (scope === 'ALL') return 'primary'
    if (scope === 'ALL_FAILED') return 'warning'
    if (scope === 'OUTPUTS_ONLY') return 'success'
    return 'info'
  }
  function statusTagType(s: string): 'primary' | 'success' | 'danger' | 'warning' | 'info' {
    if (s === 'RUNNING') return 'primary'
    if (s === 'SUCCEEDED') return 'success'
    if (s === 'FAILED' || s === 'PARTIAL_FAILED') return 'danger'
    if (s === 'PENDING_APPROVAL') return 'warning'
    return 'info'
  }
  function operationProgressPct(operation: ReplayOperation): number {
    if (!operation.totalCount) return 0
    return Math.round(
      ((operation.succeededCount + operation.failedCount) / operation.totalCount) * 100,
    )
  }
  function entryStatusTagType(s: string): 'success' | 'danger' | 'info' {
    if (s === 'SUCCEEDED') return 'success'
    if (s === 'FAILED') return 'danger'
    return 'info'
  }
  function progressPct(s: BatchDayReplaySession): number {
    const total = s.totalCount ?? 0
    if (total === 0) return 0
    const done = (s.succeededCount ?? 0) + (s.failedCount ?? 0)
    return Math.round((done / total) * 100)
  }
  function progressStatus(s: BatchDayReplaySession): 'success' | 'exception' | undefined {
    if (s.status === 'SUCCEEDED') return 'success'
    if (s.status === 'FAILED') return 'exception'
    return undefined
  }

  function normalizedVersionIdsText(): string {
    const selectedVersionIdsText = selectedVersionIds.value.map(String)
    const versionIdCandidates = [...selectedVersionIdsText, versionIdsText.value]
    const nonEmptyVersionIds = versionIdCandidates.filter(Boolean)
    return nonEmptyVersionIds.join(',')
  }

  function openRangeDrawer() {
    if (!ensureWriteAvailable()) return
    rangeDrawerOpen.value = true
    rangeDates.value = [todayBusinessDate(), todayBusinessDate()]
    rangeForm.tenantId = tenant.tenantId
    rangeForm.requestedBy = auth.userInfo?.username ?? ''
    rangeForm.executionMode = 'REPLAY'
    rangeForm.candidateSource = 'EXISTING_INSTANCES'
    rangeForm.scope = 'ALL_FAILED'
    rangeForm.resultPolicy = 'CREATE_NEW_VERSION'
    selectedRangeJobCodes.value = []
    rangeVersionIdsText.value = ''
    rangePreview.value = null
    rangePreviewRequestKey.value = null
    rangePreviewDraftKey.value = null
    if (!jobCodeOptions.value.length) void loadJobCodeOptions()
  }

  function buildRangeRequest(): BatchDayReplayRangeRequest | null {
    const dates = rangeDates.value
    if (!dates || !rangeForm.calendarCode.trim() || !rangeForm.reason.trim()) {
      ElMessage.warning(t('batchDayReplay.rangeMissingRequired'))
      return null
    }
    const [fromDate, throughDate] = dates
    if (fromDate > throughDate) {
      ElMessage.warning(t('batchDayReplay.invalidRange'))
      return null
    }
    if (rangeForm.scope === 'SUBSET_JOB_CODES' && selectedRangeJobCodes.value.length === 0) {
      ElMessage.warning(t('batchDayReplay.missingJobCodes'))
      return null
    }
    const splitVersionIdTokens = rangeVersionIdsText.value.split(/[\s,]+/)
    const versionIdTokens = splitVersionIdTokens.filter(Boolean)
    const versionIds = versionIdTokens.map(Number)
    const outputVersionIdsAreInvalid =
      rangeForm.scope === 'OUTPUTS_ONLY' &&
      (versionIds.length === 0 || versionIds.some((id) => !Number.isSafeInteger(id) || id <= 0))
    if (outputVersionIdsAreInvalid) {
      ElMessage.warning(t('batchDayReplay.missingVersionIds'))
      return null
    }
    return {
      ...rangeForm,
      tenantId: tenant.tenantId,
      fromDate,
      throughDate,
      jobCodes:
        rangeForm.scope === 'SUBSET_JOB_CODES' ? [...selectedRangeJobCodes.value] : undefined,
      versionIds: rangeForm.scope === 'OUTPUTS_ONLY' ? versionIds : undefined,
    }
  }

  async function previewRange() {
    if (rangeSubmitting.value) return
    const request = buildRangeRequest()
    if (!request) return
    const requestKey = batchDayReplayRangeRequestKey(request)
    const draftKey = rangeDraftKey.value
    const sequence = ++rangePreviewSequence
    rangePreview.value = null
    rangePreviewRequestKey.value = null
    rangePreviewDraftKey.value = null
    rangePreviewing.value = true
    try {
      const preview = await batchDayReplayApi.previewRange(request)
      if (sequence === rangePreviewSequence && draftKey === rangeDraftKey.value) {
        rangePreview.value = preview
        rangePreviewRequestKey.value = requestKey
        rangePreviewDraftKey.value = draftKey
      }
    } catch (error) {
      if (sequence === rangePreviewSequence && draftKey === rangeDraftKey.value) {
        ElMessage.error(userErrorMessage(error))
      }
    } finally {
      if (sequence === rangePreviewSequence) rangePreviewing.value = false
    }
  }

  async function submitRange() {
    if (rangeSubmitting.value || !ensureWriteAvailable()) return
    const request = buildRangeRequest()
    const currentPreview = rangePreview.value
    if (!request || !currentPreview) return
    if (!isReplayRangePreviewCurrent(request, rangePreviewRequestKey.value)) {
      rangePreview.value = null
      rangePreviewRequestKey.value = null
      rangePreviewDraftKey.value = null
      ElMessage.warning(t('batchDayReplay.previewRequired'))
      return
    }
    if (isPreviewExpired(currentPreview.expiresAt)) {
      rangePreview.value = null
      rangePreviewRequestKey.value = null
      rangePreviewDraftKey.value = null
      ElMessage.warning(t('batchDayReplay.previewExpired'))
      return
    }
    const submission = {
      ...request,
      operationKey: currentPreview.operationKey,
      previewToken: currentPreview.previewToken,
    }
    const sequence = rangePreviewSequence
    const draftKey = rangeDraftKey.value
    rangeSubmitting.value = true
    try {
      const operation = await batchDayReplayApi.submitRange(submission)
      if (sequence !== rangePreviewSequence || draftKey !== rangeDraftKey.value) return
      await showOperation(operation)
    } catch (error) {
      if (sequence !== rangePreviewSequence || draftKey !== rangeDraftKey.value) return
      if (isUnknownNetworkOutcome(error)) {
        ElMessage.warning(t('batchDayReplay.submitOutcomeUnknownTitle'))
      } else {
        ElMessage.error(userErrorMessage(error))
      }
    } finally {
      if (sequence === rangePreviewSequence) rangeSubmitting.value = false
    }
  }

  async function showOperation(operation: ReplayOperation) {
    const tenantId = tenant.tenantId
    upsertOperation(operation)
    rangeDrawerOpen.value = false
    operationDrawerOpen.value = true
    currentOperation.value = operation
    operationSessions.value = []
    await loadOperationSessions(operation.id)
    if (tenantId !== tenant.tenantId || currentOperation.value?.id !== operation.id) return
    ElMessage.success(t('batchDayReplay.submitOk'))
    await loadOperations()
  }

  function upsertOperation(operation: ReplayOperation) {
    const index = operations.value.findIndex((item) => item.id === operation.id)
    if (index >= 0) operations.value.splice(index, 1, operation)
    else operations.value.unshift(operation)
  }

  async function openOperation(operation: ReplayOperation) {
    operationDrawerOpen.value = true
    currentOperation.value = operation
    operationSessions.value = []
    await refreshOperation()
  }

  async function loadOperationSessions(operationId: number) {
    const sequence = ++operationSessionsSequence
    const tenantId = tenant.tenantId
    const isCurrentOperation = () =>
      sequence === operationSessionsSequence &&
      tenantId === tenant.tenantId &&
      currentOperation.value?.id === operationId
    loadingOperationSessions.value = true
    try {
      const children = await batchDayReplayApi.operationSessions(operationId, tenantId)
      if (isCurrentOperation()) operationSessions.value = children
    } catch (error) {
      if (!isCurrentOperation()) return
      operationSessions.value = []
      ElMessage.error(userErrorMessage(error))
    } finally {
      if (isCurrentOperation()) loadingOperationSessions.value = false
    }
  }

  async function refreshOperation() {
    if (!currentOperation.value) return
    try {
      const fresh = await batchDayReplayApi.operationDetail(
        currentOperation.value.id,
        tenant.tenantId,
      )
      currentOperation.value = fresh
      upsertOperation(fresh)
      await loadOperationSessions(fresh.id)
    } catch (error) {
      ElMessage.error(userErrorMessage(error))
    }
  }

  async function approveOperation() {
    if (!ensureWriteAvailable()) return
    if (!currentOperation.value) return
    try {
      await confirmDanger({
        verb: t('batchDayReplay.approveBtn'),
        target: `${currentOperation.value.fromDate ?? ''} – ${currentOperation.value.throughDate ?? ''}`,
        consequence: t('batchDayReplay.approveConfirmHint'),
        irreversible: true,
      })
    } catch {
      return
    }
    operationActing.value = true
    try {
      const approved = await batchDayReplayApi.approveOperation(
        currentOperation.value.id,
        auth.userInfo?.username ?? 'unknown',
        tenant.tenantId,
      )
      currentOperation.value = approved
      upsertOperation(approved)
      await loadOperations()
      ElMessage.success(t('batchDayReplay.approveOk'))
    } catch (error) {
      ElMessage.error(userErrorMessage(error))
    } finally {
      operationActing.value = false
    }
  }

  async function cancelOperation() {
    if (!ensureWriteAvailable()) return
    if (!currentOperation.value) return
    try {
      await confirmDanger({
        verb: t('batchDayReplay.cancelBtn'),
        target: '',
        consequence: t('batchDayReplay.cancelConfirmHint'),
      })
    } catch {
      return
    }
    operationActing.value = true
    try {
      const cancelled = await batchDayReplayApi.cancelOperation(
        currentOperation.value.id,
        tenant.tenantId,
      )
      currentOperation.value = cancelled
      upsertOperation(cancelled)
      await loadOperations()
      ElMessage.success(t('batchDayReplay.cancelOk'))
    } catch (error) {
      ElMessage.error(userErrorMessage(error))
    } finally {
      operationActing.value = false
    }
  }

  function buildSubmitRequest(): BatchDayReplaySubmitRequest | null {
    const form = submitForm
    const tenantId = tenant.tenantId
    const jobCodesText = selectedJobCodes.value.join(',')
    const versionIdsText = normalizedVersionIdsText()
    const result = buildBatchDayReplayRequest(form, tenantId, jobCodesText, versionIdsText)
    if (result.error) {
      ElMessage.warning(t(`batchDayReplay.${result.error}`))
      return null
    }
    return result.request
  }

  async function doPreview() {
    const req = buildSubmitRequest()
    if (!req) return
    preview.value = null
    previewRequestKey.value = null
    previewing.value = true
    try {
      preview.value = await batchDayReplayApi.preview(req)
      previewRequestKey.value = batchDayReplayRequestKey(req)
      previewPage.value = 1
      ElMessage.success(t('batchDayReplay.previewOk'))
    } catch (err) {
      ElMessage.error(userErrorMessage(err))
    } finally {
      previewing.value = false
    }
  }

  async function doSubmit() {
    if (!ensureWriteAvailable()) return
    if (submissionOutcomeUnknown.value) {
      await resolveUnknownSubmitOutcome()
      return
    }
    const req = buildSubmitRequest()
    if (!req) return
    const currentPreview = preview.value
    if (!currentPreview || !isReplayPreviewCurrent(req, previewRequestKey.value)) {
      preview.value = null
      previewRequestKey.value = null
      ElMessage.warning(t('batchDayReplay.previewRequired'))
      return
    }
    if (!currentPreview.previewToken || isPreviewExpired(currentPreview.expiresAt)) {
      preview.value = null
      previewRequestKey.value = null
      ElMessage.warning(t('batchDayReplay.previewExpired'))
      return
    }
    const submissionRequest = {
      ...req,
      previewToken: currentPreview.previewToken,
    }
    submitting.value = true
    try {
      const submittedSession = await batchDayReplayApi.submit(submissionRequest)
      await showSubmittedSession(submittedSession)
    } catch (err) {
      if (isUnknownNetworkOutcome(err)) {
        submissionOutcomeUnknown.value = submissionRequest
        ElMessage.warning(t('batchDayReplay.submitOutcomeUnknownTitle'))
      } else {
        // 内层业务错误不会触发 Axios 全局 envelope toast，需在此展示。
        ElMessage.error(userErrorMessage(err))
      }
    } finally {
      submitting.value = false
    }
  }

  async function resolveUnknownSubmitOutcome() {
    const request = submissionOutcomeUnknown.value
    if (!request) return
    submitting.value = true
    try {
      const session = await batchDayReplayApi.resolveSubmitOutcome(request)
      submissionOutcomeUnknown.value = null
      await showSubmittedSession(session)
    } catch (err) {
      if (isUnknownNetworkOutcome(err)) {
        ElMessage.warning(t('batchDayReplay.submitOutcomeStillUnknown'))
      } else {
        ElMessage.error(userErrorMessage(err))
      }
    } finally {
      submitting.value = false
    }
  }

  async function showSubmittedSession(session: BatchDayReplaySession) {
    upsertSession(session)
    ElMessage.success(t('batchDayReplay.submitOk'))
    submitDrawerOpen.value = false
    currentSession.value = session
    detailDrawerOpen.value = true
    try {
      await loadEntries()
    } catch (err) {
      ElMessage.error(userErrorMessage(err))
    }
  }

  function isUnknownNetworkOutcome(error: unknown): boolean {
    if (!(error instanceof Error) || !('isAxiosError' in error) || error.isAxiosError !== true) {
      return false
    }
    return !('response' in error) || error.response == null
  }

  function onSubmitClose(done: () => void) {
    if (submissionOutcomeUnknown.value) return
    submitDrawerOpen.value = false
    preview.value = null
    previewRequestKey.value = null
    done()
  }

  async function openSubmitDrawer() {
    if (!ensureWriteAvailable()) return
    submitDrawerOpen.value = true
    if (!jobCodeOptions.value.length) await loadJobCodeOptions()
  }

  async function loadJobCodeOptions() {
    loadingJobCodes.value = true
    try {
      const jobCodes = await jobApi.listCodes(tenant.tenantId)
      const optionCodes = jobCodes.map((option) => option.code)
      jobCodeOptions.value = optionCodes.filter(
        (code): code is string => typeof code === 'string' && code.length > 0,
      )
    } catch (error) {
      jobCodeOptions.value = []
      ElMessage.error(userErrorMessage(error))
    } finally {
      loadingJobCodes.value = false
    }
  }

  async function openDetail(row: BatchDayReplaySession) {
    detailDrawerOpen.value = true
    currentSession.value = row
    entries.value = []
    entriesStatusFilter.value = ''
    await Promise.all([reloadCurrent(), loadEntries()])
  }

  async function openChildSession(session: BatchDayReplaySession) {
    operationDrawerOpen.value = false
    await openDetail(session)
  }

  async function reloadCurrent() {
    if (!currentSession.value) return
    loadingDetail.value = true
    try {
      const fresh = await batchDayReplayApi.detail(currentSession.value.id, tenant.tenantId)
      currentSession.value = fresh
      upsertSession(fresh)
    } finally {
      loadingDetail.value = false
    }
  }

  async function loadEntries() {
    if (!currentSession.value) return
    loadingEntries.value = true
    try {
      entries.value = await batchDayReplayApi.entries(currentSession.value.id, {
        status: entriesStatusFilter.value || undefined,
        tenantId: tenant.tenantId,
      })
    } finally {
      loadingEntries.value = false
    }
  }

  async function retryFailedSubmission(entry: BatchDayReplayEntry) {
    const session = currentSession.value
    if (!session || !ensureWriteAvailable()) return
    try {
      const { value: reason } = await ElMessageBox.prompt(
        t('batchDayReplay.retrySubmissionReason'),
        t('batchDayReplay.retrySubmission'),
        {
          inputPattern: /\\S/,
          inputErrorMessage: t('batchDayReplay.retrySubmissionReasonRequired'),
        },
      )
      retryingEntryId.value = entry.id
      await batchDayReplayApi.retryFailedSubmission(
        session.id,
        entry.id,
        tenant.tenantId,
        reason.trim(),
      )
      ElMessage.success(t('batchDayReplay.retrySubmissionAccepted'))
      await Promise.all([reloadCurrent(), loadEntries(), loadSessions()])
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(userErrorMessage(error))
    } finally {
      retryingEntryId.value = null
    }
  }

  async function doApprove() {
    if (!ensureWriteAvailable()) return
    if (!currentSession.value) return
    try {
      await confirmDanger({
        verb: t('batchDayReplay.approveBtn'),
        target: '',
        consequence: t('batchDayReplay.approveConfirmHint'),
        irreversible: true,
      })
    } catch {
      // 用户点取消 → early return,不执行高危 ops
      return
    }
    approving.value = true
    try {
      const fresh = await batchDayReplayApi.approve(
        currentSession.value.id,
        auth.userInfo?.username ?? 'unknown',
        tenant.tenantId,
      )
      currentSession.value = fresh
      upsertSession(fresh)
      ElMessage.success(t('batchDayReplay.approveOk'))
    } catch (err) {
      ElMessage.error(userErrorMessage(err))
    } finally {
      approving.value = false
    }
  }

  async function doCancel() {
    if (!ensureWriteAvailable()) return
    if (!currentSession.value) return
    try {
      await confirmDanger({
        verb: t('batchDayReplay.cancelBtn'),
        target: '',
        consequence: t('batchDayReplay.cancelConfirmHint'),
      })
    } catch {
      // 用户点取消 → early return,不执行高危 ops
      return
    }
    cancelling.value = true
    try {
      const fresh = await batchDayReplayApi.cancel(currentSession.value.id, tenant.tenantId)
      currentSession.value = fresh
      upsertSession(fresh)
      ElMessage.success(t('batchDayReplay.cancelOk'))
    } catch (err) {
      ElMessage.error(userErrorMessage(err))
    } finally {
      cancelling.value = false
    }
  }

  function upsertSession(session: BatchDayReplaySession) {
    const idx = sessions.value.findIndex((s) => s.id === session.id)
    if (idx >= 0) sessions.value.splice(idx, 1, session)
    else sessions.value.unshift(session)
  }

  async function loadSessions() {
    loadingSessions.value = true
    try {
      sessions.value = await batchDayReplayApi.list({
        tenantId: tenant.tenantId,
        limit: 50,
      })
      historyUnavailable.value = false
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      historyUnavailable.value = status === 404 || status === 405
      sessions.value = []
    } finally {
      loadingSessions.value = false
    }
  }

  async function loadOperations() {
    loadingOperations.value = true
    try {
      operations.value = await batchDayReplayApi.operations({
        tenantId: tenant.tenantId,
        limit: 50,
      })
    } catch (error) {
      operations.value = []
      ElMessage.error(userErrorMessage(error))
    } finally {
      loadingOperations.value = false
    }
  }

  useTenantReload(() => {
    submitForm.tenantId = tenant.tenantId
    jobCodeOptions.value = []
    selectedJobCodes.value = []
    selectedOutputJobCodes.value = []
    selectedVersionIds.value = []
    sessions.value = []
    currentSession.value = null
    entries.value = []
    operations.value = []
    currentOperation.value = null
    operationSessions.value = []
    operationSessionsSequence += 1
    loadingOperationSessions.value = false
    operationDrawerOpen.value = false
    historyUnavailable.value = false
    return Promise.all([loadSessions(), loadOperations()]).then(() => undefined)
  })

  return {
    t,
    writesFrozen,
    sessions,
    operations,
    operationSessions,
    loadingOperationSessions,
    loadingOperations,
    loadingSessions,
    loadingDetail,
    historyUnavailable,
    rangeDrawerOpen,
    rangeDates,
    rangePreview,
    rangePreviewing,
    rangeSubmitting,
    selectedRangeJobCodes,
    rangeVersionIdsText,
    rangeForm,
    isCurrentRangePreview,
    operationDrawerOpen,
    currentOperation,
    operationActing,
    canApproveOperation,
    canCancelOperation,
    submitDrawerOpen,
    submitting,
    submissionOutcomeUnknown,
    submitForm,
    selectedJobCodes,
    selectedOutputJobCodes,
    selectedVersionIds,
    jobCodeOptions,
    loadingJobCodes,
    loadingOutputVersions,
    outputVersionOptions,
    versionIdsText,
    preview,
    previewing,
    previewPage,
    previewPageSize,
    replayScopeLabel,
    replayActionLabel,
    previewPageEntries,
    detailDrawerOpen,
    currentSession,
    entries,
    retryingEntryId,
    loadingEntries,
    entriesStatusFilter,
    entriesStatusItems,
    approving,
    cancelling,
    canApprove,
    canCancel,
    scopeTagType,
    statusTagType,
    operationProgressPct,
    entryStatusTagType,
    progressPct,
    progressStatus,
    openRangeDrawer,
    previewRange,
    submitRange,
    openOperation,
    refreshOperation,
    approveOperation,
    cancelOperation,
    doPreview,
    doSubmit,
    onSubmitClose,
    openSubmitDrawer,
    openDetail,
    openChildSession,
    reloadCurrent,
    loadEntries,
    retryFailedSubmission,
    doApprove,
    doCancel,
  }
}
