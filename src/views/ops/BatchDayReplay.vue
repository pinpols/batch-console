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
        :data="sessions"
        v-loading="loadingSessions"
        :empty-text="t('batchDayReplay.noSessions')"
        row-key="id"
        @row-click="openDetail"
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
              {{ row.succeededEntries ?? 0 }} / {{ row.totalEntries ?? 0 }}
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
          <el-radio-group v-model="submitForm.scope">
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
      <template #footer>
        <el-button @click="submitDrawerOpen = false">{{ t('common.cancel') }}</el-button>
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
              ok: currentSession.succeededEntries ?? 0,
              fail: currentSession.failedEntries ?? 0,
              pending: currentSession.pendingEntries ?? 0,
              total: currentSession.totalEntries ?? 0,
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
  import { ref, reactive, computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Refresh, Plus } from '@element-plus/icons-vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import {
    batchDayReplayApi,
    type BatchDayReplaySession,
    type BatchDayReplayEntry,
    type BatchDayReplaySubmitRequest,
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
    const total = s.totalEntries ?? 0
    if (total === 0) return 0
    const done = (s.succeededEntries ?? 0) + (s.failedEntries ?? 0)
    return Math.round((done / total) * 100)
  }
  function progressStatus(s: BatchDayReplaySession): 'success' | 'exception' | undefined {
    if (s.status === 'SUCCEEDED') return 'success'
    if (s.status === 'FAILED') return 'exception'
    return undefined
  }

  async function doSubmit() {
    if (!submitForm.bizDate || !submitForm.reason.trim()) {
      ElMessage.warning(t('batchDayReplay.missingRequired'))
      return
    }
    if (submitForm.scope === 'SUBSET_JOB_CODES') {
      submitForm.jobCodes = jobCodesText.value
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (submitForm.jobCodes.length === 0) {
        ElMessage.warning(t('batchDayReplay.missingJobCodes'))
        return
      }
    } else {
      submitForm.jobCodes = undefined
    }
    if (submitForm.scope === 'OUTPUTS_ONLY') {
      submitForm.versionIds = versionIdsText.value
        .split(/[\s,]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n) && n > 0)
      if (submitForm.versionIds.length === 0) {
        ElMessage.warning(t('batchDayReplay.missingVersionIds'))
        return
      }
    } else {
      submitForm.versionIds = undefined
    }
    submitting.value = true
    try {
      const session = await batchDayReplayApi.submit({ ...submitForm, tenantId: tenant.tenantId })
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
      await ElMessageBox.confirm(
        t('batchDayReplay.approveConfirmHint'),
        t('batchDayReplay.approveBtn'),
        { type: 'warning' },
      )
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
      await ElMessageBox.confirm(
        t('batchDayReplay.cancelConfirmHint'),
        t('batchDayReplay.cancelBtn'),
        {
          type: 'warning',
        },
      )
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
    margin: 16px 0 8px;
  }
  .entries-toolbar {
    margin: 8px 0;
  }
  .cell-mute {
    color: var(--color-text-secondary);
    font-size: 12px;
    margin-left: 8px;
  }
</style>
