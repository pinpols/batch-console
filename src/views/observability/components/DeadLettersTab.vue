<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingDL"
      @search="applyFilter"
      @reset="resetFilter"
      @refresh="() => runRefresh(loadDeadLetters)"
    >
      <el-form-item :label="t('observability.dlqSourceTypeLabel')">
        <el-select
          class="query-w-180"
          v-model="dlDraft.sourceType"
          clearable
          filterable
          :placeholder="t('observability.dlqSourceTypePlaceholder')"
        >
          <el-option v-for="opt in dlSourceTypeOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('observability.dlqSourceIdLabel')">
        <el-input
          class="query-w-200"
          v-model="dlDraft.sourceId"
          clearable
          :placeholder="t('observability.dlqSourceIdPlaceholder')"
          @keyup.enter="applyFilter"
        />
      </el-form-item>
      <el-form-item :label="t('observability.dlqKeywordLabel')">
        <el-input
          class="query-w-220"
          v-model="dlDraft.keyword"
          clearable
          :placeholder="t('observability.dlqKeywordPlaceholder')"
          @keyup.enter="applyFilter"
        />
      </el-form-item>
    </ListPageQueryBar>
    <DataState
      :loading="loadingDL"
      :error="loadDLError"
      :has-data="pagedDL.records.length > 0"
      :on-retry="loadDeadLetters"
    >
      <BulkActionBar
        v-if="canManageSystem && bulk.count.value > 0"
        :count="bulk.count.value"
        :running="bulk.running.value"
        @clear="bulk.clear"
      >
        <template #default="{ running }">
          <el-button
            size="small"
            type="primary"
            plain
            :loading="running"
            :disabled="writesFrozen"
            @click="onBulkReplay"
          >
            {{ t('observability.dlqBulkReplay') }}
          </el-button>
        </template>
      </BulkActionBar>
      <el-table
        ref="dlTableRef"
        v-loading="loadingDL"
        :data="pagedDL.records"
        stripe
        border
        :empty-text="t('common.noData')"
        size="small"
        class="console-table"
        @selection-change="bulk.onSelectionChange"
      >
        <el-table-column
          v-if="canManageSystem"
          type="selection"
          width="44"
          :selectable="() => true"
        />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column
          prop="sourceType"
          :label="t('observability.dlqColSourceType')"
          width="120"
        />
        <el-table-column prop="sourceId" :label="t('observability.dlqColSourceId')" width="100" />
        <el-table-column
          prop="deadLetterReason"
          :label="t('observability.dlqColReason')"
          min-width="250"
          show-overflow-tooltip
        />
        <DatetimeColumn prop="createdAt" :label="t('observability.dlqColFailedAt')" width="180" />
        <el-table-column
          prop="replayCount"
          :label="t('observability.dlqColRetryCount')"
          width="90"
        />
        <el-table-column prop="replayStatus" :label="t('observability.dlqColStatus')" width="100" />
        <el-table-column :label="t('observability.dlqColActions')" width="180" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <RowActions
                :actions="deadLetterRowActions(row as ConsoleDeadLetterTaskResponse)"
                :inline-limit="1"
              />
            </div>
          </template>
        </el-table-column>
      </el-table>
    </DataState>
    <TablePagerBar
      :page="dlPage"
      :page-size="dlPageSize"
      :total="pagedDL.total"
      @update:page="(p: number) => (dlPage = p)"
      @update:page-size="onPageSizeChange"
    />

    <DetailDrawer
      v-model:visible="detailVisible"
      :title="t('observability.dlqDetailTitle')"
      :raw="detailRow"
      :meta-rows="detailMetaRows"
    />
    <el-dialog v-model="replayDialogVisible" :title="t('observability.dlqReplay')" width="520px">
      <p>{{ t('observability.dlqExternalOutcomeHelp') }}</p>
      <el-checkbox v-model="externalActionVerifiedNotExecuted">
        {{ t('observability.dlqExternalOutcomeVerified') }}
      </el-checkbox>
      <el-form-item :label="t('observability.dlqReplayReason')">
        <el-input v-model="replayReason" type="textarea" maxlength="512" show-word-limit />
      </el-form-item>
      <el-form-item
        v-if="externalActionVerifiedNotExecuted"
        :label="t('observability.dlqEvidenceReference')"
      >
        <el-input v-model="externalOutcomeEvidenceReference" maxlength="512" show-word-limit />
      </el-form-item>
      <template #footer>
        <el-button @click="replayDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="replaySubmitting"
          :disabled="!canWriteSystem"
          @click="submitReplay"
        >
          {{ t('observability.dlqReplay') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
  import { usePermission } from '@/composables/usePermission'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { queryDeadLetters, replayDeadLetter } from '@/api/observabilityQueries'
  import { toPageResult } from '@/api/adapters'
  import BulkActionBar from '@/components/table/BulkActionBar.vue'
  import { useBulkSelection } from '@/composables/useBulkSelection'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import DetailDrawer from '@/components/common/DetailDrawer.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import DataState from '@/components/common/DataState.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import type { ConsoleDeadLetterTaskResponse } from '@/types/console-api'
  import { uniqueDisplayFieldValues } from '@/utils/queryFormOptions'

  const { t } = useI18n({ useScope: 'global' })
  const { writesFrozen, ensureWriteAvailable } = useWriteAvailability()
  const { canManageSystem, canWriteSystem } = usePermission()

  const tenant = useTenantStore()
  const auth = useAuthStore()
  const loadingDL = ref(false)
  const loadDLError = ref<unknown>(null)
  let dlLoadSequence = 0
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingDL)
  const dlRows = ref<ConsoleDeadLetterTaskResponse[]>([])
  const dlPage = ref(1)
  const dlPageSize = ref(15)
  const dlDraft = reactive({ sourceType: '', sourceId: '', keyword: '' })
  const dlApplied = reactive({ sourceType: '', sourceId: '', keyword: '' })

  const detailVisible = ref(false)
  const detailRow = ref<ConsoleDeadLetterTaskResponse | null>(null)
  const replayDialogVisible = ref(false)
  const replaySubmitting = ref(false)
  const replayTarget = ref<ConsoleDeadLetterTaskResponse | null>(null)
  const replayReason = ref('')
  const externalActionVerifiedNotExecuted = ref(false)
  const externalOutcomeEvidenceReference = ref('')
  const replayTenantId = ref('')
  const replayOperator = ref('')

  // ── 批量重放:多选 + 单项重放 / 批量重放 ──────────────────────────────
  // 可重放 = replayStatus 为 NEW / FAILED;SUCCESS(已成功)与 GIVE_UP(已放弃)不再重放
  const REPLAYABLE_STATUSES = ['NEW', 'FAILED']
  function isReplayable(row: ConsoleDeadLetterTaskResponse): boolean {
    const replayStatusText = String(row.replayStatus ?? '')
    const replayStatus = replayStatusText.toUpperCase()
    return REPLAYABLE_STATUSES.includes(replayStatus)
  }
  const dlTableRef = ref<{ clearSelection?: () => void } | null>(null)
  const bulk = useBulkSelection<ConsoleDeadLetterTaskResponse>()
  onMounted(() => bulk.bindTable(dlTableRef.value))

  async function onReplay(row: ConsoleDeadLetterTaskResponse) {
    const tenantId = tenant.tenantId
    const operator = auth.userInfo?.username ?? ''
    if (!canReplayInScope(tenantId, operator) || !isReplayable(row)) return
    try {
      await confirmDanger({
        verb: t('observability.dlqReplay'),
        target: `#${row.id}`,
        consequence: t('observability.dlqReplayConfirm', { id: row.id }),
      })
    } catch {
      return
    }
    if (!canReplayInScope(tenantId, operator)) return
    replayTenantId.value = tenantId
    replayOperator.value = operator
    replayTarget.value = row
    replayReason.value = ''
    externalActionVerifiedNotExecuted.value = false
    externalOutcomeEvidenceReference.value = ''
    replayDialogVisible.value = true
  }

  async function submitReplay() {
    const row = replayTarget.value
    if (!row || replaySubmitting.value) return
    if (!canReplayInScope(replayTenantId.value, replayOperator.value)) return
    const current = dlRows.value.find((item) => item.id === row.id)
    if (!current || !isReplayable(current)) return
    const tenantId = replayTenantId.value
    const evidence = externalOutcomeEvidenceReference.value.trim()
    const reason = replayReason.value.trim()
    if (externalActionVerifiedNotExecuted.value) {
      if (!reason) {
        ElMessage.warning(t('observability.dlqReasonRequired'))
        return
      }
      if (!evidence) {
        ElMessage.warning(t('observability.dlqEvidenceRequired'))
        return
      }
      if (!auth.userInfo?.username) {
        ElMessage.warning(t('observability.dlqOperatorMissing'))
        return
      }
    }
    replaySubmitting.value = true
    try {
      await replayDeadLetter(
        tenantId,
        row.id,
        reason || undefined,
        {
          externalActionVerifiedNotExecuted: externalActionVerifiedNotExecuted.value,
          ...(externalActionVerifiedNotExecuted.value
            ? { externalOutcomeEvidenceReference: evidence }
            : {}),
        },
        auth.userInfo?.username,
      )
      ElMessage.success(t('observability.dlqReplaySuccess'))
      replayDialogVisible.value = false
    } catch {
      ElMessage.error(t('observability.dlqReplayFailed'))
    } finally {
      replaySubmitting.value = false
    }
    void loadDeadLetters()
  }

  async function onBulkReplay() {
    const tenantId = tenant.tenantId
    const operator = auth.userInfo?.username ?? ''
    if (!canReplayInScope(tenantId, operator)) return
    const eligible = bulk.selected.value.filter(isReplayable)
    if (!eligible.length) {
      ElMessage.warning(t('observability.dlqBulkReplayNone'))
      return
    }
    const label = t('observability.dlqBulkReplay')
    try {
      await confirmDanger({
        verb: label,
        target: '',
        consequence: t('bulk.confirmBody', { label, n: eligible.length }),
      })
    } catch {
      return
    }
    if (!canReplayInScope(tenantId, operator)) return
    await bulk.runBulk(
      eligible,
      (r) => {
        const current = dlRows.value.find((item) => item.id === r.id)
        if (!canReplayInScope(tenantId, operator) || !current || !isReplayable(current)) {
          const message = t('common.cancel')
          const cancelled = new Error(message)
          return Promise.reject(cancelled)
        }
        return replayDeadLetter(tenantId, r.id)
      },
      {
        actionLabel: label,
      },
    )
    void loadDeadLetters()
  }

  const dlSourceTypeOptions = computed(() =>
    uniqueDisplayFieldValues(dlRows.value, (row) => row.sourceType),
  )

  const filteredDL = computed(() => {
    let rows = dlRows.value
    const st = dlApplied.sourceType.trim()
    if (st) rows = rows.filter((x) => String(x.sourceType ?? '') === st)
    const sid = dlApplied.sourceId.trim()
    if (sid) rows = rows.filter((x) => String(x.sourceId ?? '') === sid)
    const trimmedKeyword = dlApplied.keyword.trim()
    const k = trimmedKeyword.toLowerCase()
    if (k) {
      rows = rows.filter((x) => {
        const hay = `${x.deadLetterReason ?? ''} ${x.replayStatus ?? ''}`.toLowerCase()
        return hay.includes(k)
      })
    }
    return rows
  })

  const pagedDL = computed(() => toPageResult(filteredDL.value, dlPage.value, dlPageSize.value))

  const detailMetaRows = computed(() => {
    const r = detailRow.value
    if (!r) return []
    return [
      { label: t('observability.dlqMetaSourceType'), value: r.sourceType ?? '' },
      { label: t('observability.dlqMetaSourceId'), value: String(r.sourceId ?? '') },
      { label: t('observability.dlqColErrorClass'), value: r.errorClass ?? '' },
      { label: t('observability.dlqMetaStatus'), value: r.replayStatus ?? '' },
    ]
  })

  async function loadDeadLetters() {
    const tenantId = tenant.tenantId
    const sequence = ++dlLoadSequence
    if (!tenantId) return
    const isCurrent = () => sequence === dlLoadSequence && tenantId === tenant.tenantId
    loadingDL.value = true
    loadDLError.value = null
    try {
      const rows = await queryDeadLetters(tenantId)
      if (isCurrent()) dlRows.value = rows
    } catch (error) {
      if (isCurrent()) {
        dlRows.value = []
        loadDLError.value = error
      }
    } finally {
      if (isCurrent()) loadingDL.value = false
    }
  }

  function applyFilter() {
    return runSearch(() => {
      dlApplied.sourceType = dlDraft.sourceType.trim()
      dlApplied.sourceId = dlDraft.sourceId.trim()
      dlApplied.keyword = dlDraft.keyword.trim()
      dlPage.value = 1
    })
  }

  function resetFilter() {
    return runReset(() => {
      dlDraft.sourceType = ''
      dlDraft.sourceId = ''
      dlDraft.keyword = ''
      dlApplied.sourceType = ''
      dlApplied.sourceId = ''
      dlApplied.keyword = ''
      dlPage.value = 1
    })
  }

  function onPageSizeChange(s: number) {
    dlPageSize.value = s
    dlPage.value = 1
  }

  function openDetail(row: ConsoleDeadLetterTaskResponse) {
    detailRow.value = row
    detailVisible.value = true
  }

  function deadLetterRowActions(row: ConsoleDeadLetterTaskResponse): RowAction[] {
    return [
      {
        key: 'detail',
        label: t('observability.dlqActionDetail'),
        primary: true,
        onClick: () => openDetail(row),
      },
      ...(canManageSystem.value && isReplayable(row)
        ? [
            {
              key: 'replay',
              label: t('observability.dlqReplay'),
              warning: true,
              disabled: !canWriteSystem.value,
              divided: true,
              onClick: () => onReplay(row),
            } satisfies RowAction,
          ]
        : []),
    ]
  }

  // 先同步撤销旧租户的读取与详情，再由统一租户入口加载新数据。
  watch(
    () => tenant.tenantId,
    () => {
      dlLoadSequence++
      dlRows.value = []
      loadingDL.value = false
      loadDLError.value = null
      detailVisible.value = false
      detailRow.value = null
    },
    { flush: 'sync' },
  )
  onUnmounted(() => dlLoadSequence++)

  useTenantReload(() => {
    dlPage.value = 1
    void loadDeadLetters()
  })

  function canReplayInScope(tenantId: string, operator: string) {
    return (
      canWriteSystem.value &&
      ensureWriteAvailable() &&
      tenantId === tenant.tenantId &&
      !!tenantId &&
      !!operator &&
      operator === auth.userInfo?.username
    )
  }

  watch([() => tenant.tenantId, () => canWriteSystem.value], () => {
    replayDialogVisible.value = false
    replayTarget.value = null
    bulk.clear()
  })
</script>
