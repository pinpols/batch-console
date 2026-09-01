<template>
  <PageContainer>
    <PageHeader :title="t('batchDayReplay.title')" :description="t('batchDayReplay.description')">
      <template #actions>
        <el-button :icon="Refresh" :loading="loadingDetail" @click="reloadCurrent">
          {{ t('common.refresh') }}
        </el-button>
        <el-button type="primary" :icon="Plus" @click="submitDrawerOpen = true">
          {{ t('batchDayReplay.submitBtn') }}
        </el-button>
      </template>
    </PageHeader>

    <!-- Sessions 列表 -->
    <SectionCard>
      <template #header>
        <span>{{ t('batchDayReplay.sessionsHeader') }}</span>
      </template>
      <el-table
        class="replay-sessions-table"
        :data="sessions"
        v-loading="loadingSessions"
        :empty-text="t('batchDayReplay.noSessions')"
        row-key="id"
        @row-click="openDetail"
        table-layout="fixed"
      >
        <el-table-column :label="t('batchDayReplay.colId')" prop="id" width="80" />
        <el-table-column :label="t('batchDayReplay.colBizDate')" prop="bizDate" width="120" />
        <el-table-column :label="t('batchDayReplay.colScope')" width="160">
          <template #default="{ row }">
            <el-tag size="small" :type="scopeTagType(row.scope)" effect="plain">
              {{ row.scope }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colStatus')" width="160">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colProgress')" width="200">
          <template #default="{ row }">
            <el-progress :percentage="progressPct(row)" :status="progressStatus(row)" />
            <span class="cell-mute">
              {{ row.succeededCount ?? 0 }} / {{ row.totalCount ?? 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colRequestedBy')" prop="requestedBy" />
        <el-table-column :label="t('batchDayReplay.colCreatedAt')" prop="createdAt" width="180" />
      </el-table>
    </SectionCard>

    <!-- Submit drawer -->
    <el-drawer
      v-model="submitDrawerOpen"
      :title="t('batchDayReplay.submitTitle')"
      direction="rtl"
      size="640px"
      :before-close="onSubmitClose"
    >
      <el-form
        class="replay-submit-form"
        ref="submitFormRef"
        :model="submitForm"
        label-width="120px"
        @submit.prevent="doSubmit"
      >
        <el-form-item :label="t('batchDayReplay.fieldCalendar')" required>
          <el-input v-model="submitForm.calendarCode" placeholder="default" />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldBizDate')" required>
          <el-date-picker v-model="submitForm.bizDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldScope')" required>
          <el-radio-group v-model="submitForm.scope" class="replay-scope-group">
            <el-radio value="ALL">ALL</el-radio>
            <el-radio value="ALL_FAILED">ALL_FAILED</el-radio>
            <el-radio value="SUBSET_JOB_CODES">SUBSET_JOB_CODES</el-radio>
            <el-radio value="OUTPUTS_ONLY">OUTPUTS_ONLY</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          v-if="submitForm.scope === 'SUBSET_JOB_CODES'"
          :label="t('batchDayReplay.fieldJobCodes')"
          required
        >
          <el-input
            v-model="jobCodesText"
            type="textarea"
            :rows="3"
            :placeholder="t('batchDayReplay.fieldJobCodesPlaceholder')"
          />
        </el-form-item>
        <el-form-item
          v-if="submitForm.scope === 'OUTPUTS_ONLY'"
          :label="t('batchDayReplay.fieldVersionIds')"
          required
        >
          <el-input
            v-model="versionIdsText"
            type="textarea"
            :rows="3"
            :placeholder="t('batchDayReplay.fieldVersionIdsPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldResultPolicy')">
          <el-select v-model="submitForm.resultPolicy" class="query-w-full">
            <el-option label="CREATE_NEW_VERSION" value="CREATE_NEW_VERSION" />
            <el-option label="KEEP_BOTH" value="KEEP_BOTH" />
            <el-option label="MANUAL_CONFIRM_EFFECTIVE" value="MANUAL_CONFIRM_EFFECTIVE" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldConfigPolicy')">
          <el-select v-model="submitForm.configVersionPolicy" class="query-w-full">
            <el-option label="USE_ORIGINAL_CONFIG" value="USE_ORIGINAL_CONFIG" />
            <el-option label="USE_CURRENT_CONFIG" value="USE_CURRENT_CONFIG" />
            <el-option label="USE_SPECIFIC_VERSION" value="USE_SPECIFIC_VERSION" />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="submitForm.configVersionPolicy === 'USE_SPECIFIC_VERSION'"
          :label="t('batchDayReplay.fieldConfigVersion')"
        >
          <el-input-number v-model="submitForm.configVersion" :min="1" />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldReason')" required>
          <el-input
            v-model="submitForm.reason"
            type="textarea"
            :rows="2"
            :placeholder="t('batchDayReplay.fieldReasonPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldAutoApprove')">
          <el-switch v-model="submitForm.autoApprove" />
          <span class="cell-mute">
            {{
              submitForm.autoApprove
                ? t('batchDayReplay.autoApproveOnHint')
                : t('batchDayReplay.autoApproveOffHint')
            }}
          </span>
        </el-form-item>
      </el-form>

      <div v-if="preview" class="preview-panel">
        <div class="preview-panel__head">
          <div>
            <div class="preview-panel__title">{{ t('batchDayReplay.previewTitle') }}</div>
            <div class="preview-panel__sub">
              {{
                t('batchDayReplay.previewSummary', {
                  total: preview.totalCount,
                  result: preview.resultVersionImpacts.length,
                  asset: preview.assetPartitionImpacts.length,
                  dispatch: preview.dispatchImpacts.length,
                })
              }}
            </div>
          </div>
          <el-tag size="small" effect="plain">{{ preview.scope }}</el-tag>
        </div>
        <el-alert
          v-if="preview.warnings.length"
          type="warning"
          show-icon
          :closable="false"
          class="preview-warning"
        >
          <template #default>
            <div v-for="w in preview.warnings" :key="w">{{ w }}</div>
          </template>
        </el-alert>
        <el-table
          class="replay-preview-table"
          :data="preview.entries.slice(0, 8)"
          size="small"
          border
          :empty-text="t('common.noData')"
        >
          <el-table-column prop="jobCode" :label="t('batchDayReplay.colJobCode')" min-width="160" />
          <el-table-column
            prop="action"
            :label="t('batchDayReplay.previewColAction')"
            width="180"
          />
          <el-table-column
            prop="businessKey"
            :label="t('batchDayReplay.previewColBusinessKey')"
            min-width="220"
            show-overflow-tooltip
          />
          <el-table-column
            prop="sourceInstanceId"
            :label="t('batchDayReplay.previewColSourceInstance')"
            width="140"
          />
          <el-table-column
            prop="resultVersionId"
            :label="t('batchDayReplay.previewColResultVersion')"
            width="140"
          />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="submitDrawerOpen = false">{{ t('common.cancel') }}</el-button>
        <el-button :loading="previewing" @click="doPreview">
          {{ t('batchDayReplay.previewBtn') }}
        </el-button>
        <el-button type="primary" :loading="submitting" @click="doSubmit">
          {{ t('batchDayReplay.submitConfirm') }}
        </el-button>
      </template>
    </el-drawer>

    <!-- Detail drawer -->
    <el-drawer
      v-model="detailDrawerOpen"
      :title="
        currentSession
          ? t('batchDayReplay.detailTitle', { id: currentSession.id })
          : t('batchDayReplay.detailTitleEmpty')
      "
      direction="rtl"
      size="720px"
    >
      <div v-if="currentSession">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item :label="t('batchDayReplay.colStatus')">
            <el-tag :type="statusTagType(currentSession.status)">{{
              currentSession.status
            }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('batchDayReplay.colScope')">
            {{ currentSession.scope }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('batchDayReplay.colBizDate')">
            {{ currentSession.bizDate }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('batchDayReplay.fieldCalendar')">
            {{ currentSession.calendarCode }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('batchDayReplay.colRequestedBy')">
            {{ currentSession.requestedBy }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="currentSession.approvedBy"
            :label="t('batchDayReplay.fieldApprovedBy')"
          >
            {{ currentSession.approvedBy }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('batchDayReplay.fieldReason')" :span="2">
            {{ currentSession.reason }}
          </el-descriptions-item>
        </el-descriptions>

        <el-progress
          :percentage="progressPct(currentSession)"
          :status="progressStatus(currentSession)"
          class="detail-progress"
        />
        <div class="cell-mute">
          {{
            t('batchDayReplay.entriesSummary', {
              ok: currentSession.succeededCount ?? 0,
              fail: currentSession.failedCount ?? 0,
              pending: currentSession.inFlightCount ?? 0,
              total: currentSession.totalCount ?? 0,
            })
          }}
        </div>

        <el-divider />
        <div class="entries-toolbar">
          <el-radio-group v-model="entriesStatusFilter" size="small" @change="loadEntries">
            <el-radio-button value="">{{ t('batchDayReplay.allEntries') }}</el-radio-button>
            <el-radio-button value="PENDING">PENDING</el-radio-button>
            <el-radio-button value="SUCCEEDED">SUCCEEDED</el-radio-button>
            <el-radio-button value="FAILED">FAILED</el-radio-button>
          </el-radio-group>
        </div>
        <el-table
          class="replay-entries-table"
          :data="entries"
          v-loading="loadingEntries"
          :empty-text="t('batchDayReplay.noEntries')"
          size="small"
        >
          <el-table-column :label="t('batchDayReplay.colId')" prop="id" width="80" />
          <el-table-column :label="t('batchDayReplay.colJobCode')" prop="jobCode" />
          <el-table-column :label="t('batchDayReplay.colStatus')" width="120">
            <template #default="{ row }">
              <el-tag size="small" :type="entryStatusTagType(row.status)">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="t('batchDayReplay.colFailureReason')"
            prop="failureReason"
            show-overflow-tooltip
          />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="detailDrawerOpen = false">{{ t('common.close') }}</el-button>
        <el-button v-if="canApprove" type="success" :loading="approving" @click="doApprove">
          {{ t('batchDayReplay.approveBtn') }}
        </el-button>
        <el-button v-if="canCancel" type="danger" :loading="cancelling" @click="doCancel">
          {{ t('batchDayReplay.cancelBtn') }}
        </el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { RefreshCw as Refresh, Plus } from 'lucide-vue-next'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import {
    batchDayReplayApi,
    type BatchDayReplaySession,
    type BatchDayReplayEntry,
    type BatchDayReplaySubmitRequest,
    type BatchDayReplayPreview,
  } from '@/api/batchDayReplay'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const auth = useAuthStore()

  /**
   * Session 列表本地维护(BE 暂无 list 端点,本组件 detail 出来后塞回前面;新建后直接 push 到顶部)。
   * 若 BE 后续补 list 端点,迁到 useTenantReload 自动拉。
   */
  const sessions = ref<BatchDayReplaySession[]>([])
  const loadingSessions = ref(false)
  const loadingDetail = ref(false)

  const submitDrawerOpen = ref(false)
  const submitting = ref(false)
  const submitForm = reactive<BatchDayReplaySubmitRequest>({
    tenantId: tenant.tenantId,
    calendarCode: 'default',
    bizDate: new Date().toISOString().slice(0, 10),
    scope: 'ALL',
    resultPolicy: 'CREATE_NEW_VERSION',
    configVersionPolicy: 'USE_ORIGINAL_CONFIG',
    reason: '',
    requestedBy: auth.userInfo?.username ?? '',
    autoApprove: false,
  })
  const jobCodesText = ref('')
  const versionIdsText = ref('')
  const preview = ref<BatchDayReplayPreview | null>(null)
  const previewing = ref(false)

  watch(
    () => [
      submitForm.calendarCode,
      submitForm.bizDate,
      submitForm.scope,
      submitForm.resultPolicy,
      submitForm.configVersionPolicy,
      submitForm.configVersion,
      submitForm.reason,
      submitForm.autoApprove,
      jobCodesText.value,
      versionIdsText.value,
    ],
    () => {
      preview.value = null
    },
  )

  const detailDrawerOpen = ref(false)
  const currentSession = ref<BatchDayReplaySession | null>(null)
  const entries = ref<BatchDayReplayEntry[]>([])
  const loadingEntries = ref(false)
  const entriesStatusFilter = ref<'' | 'PENDING' | 'SUCCEEDED' | 'FAILED'>('')
  const approving = ref(false)
  const cancelling = ref(false)

  const isPlatformAdmin = computed(() => auth.hasPermission('ROLE_ADMIN'))

  /** 仅 PENDING_APPROVAL 状态 + ADMIN 角色可以审批 */
  const canApprove = computed(
    () => currentSession.value?.status === 'PENDING_APPROVAL' && isPlatformAdmin.value,
  )
  /** RUNNING / PENDING_APPROVAL 都可取消;ADMIN 或 提交人本人 */
  const canCancel = computed(() => {
    const s = currentSession.value
    if (!s) return false
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
    if (s === 'FAILED') return 'danger'
    if (s === 'PENDING_APPROVAL') return 'warning'
    return 'info'
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

  function buildSubmitRequest(): BatchDayReplaySubmitRequest | null {
    if (!submitForm.bizDate || !submitForm.reason.trim()) {
      ElMessage.warning(t('batchDayReplay.missingRequired'))
      return null
    }
    const req: BatchDayReplaySubmitRequest = { ...submitForm, tenantId: tenant.tenantId }
    if (submitForm.scope === 'SUBSET_JOB_CODES') {
      req.jobCodes = jobCodesText.value
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (req.jobCodes.length === 0) {
        ElMessage.warning(t('batchDayReplay.missingJobCodes'))
        return null
      }
    } else {
      req.jobCodes = undefined
    }
    if (submitForm.scope === 'OUTPUTS_ONLY') {
      req.versionIds = versionIdsText.value
        .split(/[\s,]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n) && n > 0)
      if (req.versionIds.length === 0) {
        ElMessage.warning(t('batchDayReplay.missingVersionIds'))
        return null
      }
    } else {
      req.versionIds = undefined
    }
    return req
  }

  async function doPreview() {
    const req = buildSubmitRequest()
    if (!req) return
    previewing.value = true
    try {
      preview.value = await batchDayReplayApi.preview(req)
      ElMessage.success(t('batchDayReplay.previewOk'))
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
      previewing.value = false
    }
  }

  async function doSubmit() {
    const req = buildSubmitRequest()
    if (!req) return
    submitting.value = true
    try {
      const session = await batchDayReplayApi.submit(req)
      sessions.value = [session, ...sessions.value]
      ElMessage.success(t('batchDayReplay.submitOk'))
      submitDrawerOpen.value = false
      // 自动打开新建的 session detail 看进度
      currentSession.value = session
      detailDrawerOpen.value = true
      await loadEntries()
    } catch (err) {
      // BE 返业务 4xx(e.g. NOT_FOUND「未找到可重放候选」)时 batchDayReplayApi 内层 unwrap throws,
      // 显式 toast 让用户看到原因;axios 全局 toast 仅覆盖外层 envelope 失败,内层不会触发。
      ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
      submitting.value = false
    }
  }

  function onSubmitClose() {
    submitDrawerOpen.value = false
    preview.value = null
  }

  async function openDetail(row: BatchDayReplaySession) {
    detailDrawerOpen.value = true
    currentSession.value = row
    entries.value = []
    entriesStatusFilter.value = ''
    await Promise.all([reloadCurrent(), loadEntries()])
  }

  async function reloadCurrent() {
    if (!currentSession.value) return
    loadingDetail.value = true
    try {
      const fresh = await batchDayReplayApi.detail(currentSession.value.id, tenant.tenantId)
      currentSession.value = fresh
      const idx = sessions.value.findIndex((s) => s.id === fresh.id)
      if (idx >= 0) sessions.value.splice(idx, 1, fresh)
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

  async function doApprove() {
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
      const idx = sessions.value.findIndex((s) => s.id === fresh.id)
      if (idx >= 0) sessions.value.splice(idx, 1, fresh)
      ElMessage.success(t('batchDayReplay.approveOk'))
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
      approving.value = false
    }
  }

  async function doCancel() {
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
      const idx = sessions.value.findIndex((s) => s.id === fresh.id)
      if (idx >= 0) sessions.value.splice(idx, 1, fresh)
      ElMessage.success(t('batchDayReplay.cancelOk'))
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
      cancelling.value = false
    }
  }

  onMounted(() => {
    // BE 暂无 list 端点(本 PR 范围),保持空列表;后续若新增按 useTenantReload 接入
  })
</script>

<style scoped>
  .detail-progress {
    margin: 14px 0 6px;
  }
  .entries-toolbar {
    margin: 8px 0;
  }
  .cell-mute {
    color: var(--color-text-secondary);
    font-size: 12px;
    margin-left: 8px;
  }

  .preview-panel {
    margin-top: 16px;
    padding: 12px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-subtle);
  }

  .replay-sessions-table :deep(.el-table__cell .cell),
  .replay-preview-table :deep(.el-table__cell .cell),
  .replay-entries-table :deep(.el-table__cell .cell) {
    min-width: 0;
  }

  .replay-submit-form :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  .replay-scope-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .replay-scope-group :deep(.el-radio) {
    margin-right: 0;
    min-width: 0;
  }

  .preview-panel__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .preview-panel__title {
    font-size: 14px;
    font-weight: 650;
    color: var(--color-text-primary);
  }

  .preview-panel__sub {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .preview-warning {
    margin-bottom: 10px;
  }

  @media (max-width: 720px) {
    .replay-scope-group {
      grid-template-columns: 1fr;
    }

    .preview-panel__head {
      flex-direction: column;
    }
  }
</style>
