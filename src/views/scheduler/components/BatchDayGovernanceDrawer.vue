<template>
  <el-drawer v-model="visible" :title="t('batchDayGovernance.title')" size="min(960px, 100vw)">
    <el-alert
      :title="t('batchDayGovernance.scope', { tenant: tenant.tenantId, calendar: calendarCode })"
      type="info"
      :closable="false"
    />
    <el-alert
      v-if="loadError"
      :title="t('batchDayGovernance.loadError')"
      type="error"
      :closable="false"
    />
    <el-button :loading="loading" @click="load">{{ t('common.refresh') }}</el-button>
    <SectionCard>
      <template #header>{{ t('batchDayGovernance.catchup') }}</template>
      <DataState :loading="loading" :has-data="Boolean(preview)">
        <template v-if="preview">
          <el-descriptions :column="2" border>
            <el-descriptions-item :label="t('batchDayGovernance.currentDate')">{{
              preview.currentBizDate
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('batchDayGovernance.cursor')"
              >{{ preview.lastScannedBizDate }} ·
              {{
                t(`batchDayGovernance.cursorSources.${preview.cursorSource}`)
              }}</el-descriptions-item
            >
            <el-descriptions-item :label="t('batchDayGovernance.remaining')">{{
              preview.remainingRawDateCount
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('batchDayGovernance.nextDates')">{{
              preview.nextScanRawBizDates.join(', ') || '—'
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('batchDayGovernance.catchupStatus')">{{
              t(preview.catchupPaused ? 'batchDayGovernance.paused' : 'batchDayGovernance.active')
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('batchDayGovernance.reason')">{{
              preview.catchupPauseReason || '—'
            }}</el-descriptions-item>
          </el-descriptions>
          <p>{{ t('batchDayGovernance.anchorHint') }}</p>
          <el-button
            v-if="canManageSystem"
            :disabled="!canWrite || writing || Boolean(pending)"
            @click="choose('catchup', preview.catchupPaused ? 'RESUME' : 'PAUSE')"
            >{{
              t(preview.catchupPaused ? 'batchDayGovernance.resume' : 'batchDayGovernance.pause')
            }}</el-button
          >
        </template>
      </DataState>
    </SectionCard>
    <SectionCard>
      <template #header>{{ t('batchDayGovernance.gaps') }}</template>
      <el-form inline>
        <el-form-item :label="t('batchDayGovernance.from')"
          ><el-date-picker v-model="fromDate" type="date" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item :label="t('batchDayGovernance.through')"
          ><el-date-picker v-model="throughDate" type="date" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-button
          :loading="gapsLoading"
          :disabled="!preview || !validGapRange(fromDate, throughDate, preview.currentBizDate)"
          @click="loadGaps"
          >{{ t('batchDayGovernance.inspect') }}</el-button
        >
      </el-form>
      <p>{{ t('batchDayGovernance.gapHint') }}</p>
      <el-alert
        v-if="gapsError"
        :title="t('batchDayGovernance.loadError')"
        type="error"
        :closable="false"
      />
      <p v-if="gaps">
        {{
          t('batchDayGovernance.gapSummary', {
            inspected: gaps.inspectedDateCount,
            missing: gaps.missingRecordCandidates.length,
          })
        }}
      </p>
      <el-table
        v-if="gaps"
        :data="gaps.missingRecordCandidates.map((date) => ({ date }))"
        :empty-text="t('common.noData')"
      >
        <el-table-column prop="date" :label="t('batchDayGovernance.date')" />
        <el-table-column :label="t('common.actions')"
          ><template #default="{ row }"
            ><router-link
              class="cell-link"
              :to="{ path: `/scheduler/batch-days/${row.date}`, query: { calendarCode } }"
              @click="visible = false"
              >{{ t('batchDayGovernance.openWindow') }}</router-link
            ></template
          ></el-table-column
        >
      </el-table>
    </SectionCard>
    <SectionCard>
      <template #header>{{ t('batchDayGovernance.day') }}</template>
      <el-form inline
        ><el-form-item :label="t('batchDayGovernance.date')"
          ><el-date-picker
            v-model="selectedDate"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled="writing || Boolean(pending)" /></el-form-item
      ></el-form>
      <template v-if="day">
        <p>
          {{
            t('batchDayGovernance.dayState', {
              status: day.dayStatus || t('batchDayGovernance.unknown'),
              frozen:
                day.frozen == null
                  ? t('batchDayGovernance.unknown')
                  : t(day.frozen ? 'common.yes' : 'common.no'),
            })
          }}
        </p>
        <p>{{ t('batchDayGovernance.operationHint') }}</p>
        <el-space v-if="canManageSystem" wrap
          ><el-button
            v-for="action in actions"
            :key="action"
            :disabled="!canWrite || writing || Boolean(pending)"
            @click="choose('day', action)"
            >{{ t(`batchDayGovernance.actions.${action}`) }}</el-button
          ></el-space
        >
      </template>
      <el-alert
        v-if="readbackRequired"
        :title="t('batchDayGovernance.readbackRequired')"
        type="warning"
        :closable="false"
      />
    </SectionCard>
    <el-alert
      v-if="recoveryBlocked"
      :title="t('batchDayGovernance.recoveryBlocked')"
      type="error"
      :closable="false"
    />
    <el-alert
      v-if="pending"
      :title="t('batchDayGovernance.unknownOutcome')"
      type="warning"
      :closable="false"
    />
    <el-button
      v-if="pending && canManageSystem"
      :loading="writing"
      :disabled="!canWrite"
      @click="execute(pending)"
      >{{ t('batchDayGovernance.retryOriginal') }}</el-button
    >
    <el-dialog v-model="confirmation" :title="t('batchDayGovernance.confirmTitle')" append-to-body>
      <p>
        {{
          t('batchDayGovernance.confirmScope', {
            tenant: tenant.tenantId,
            calendar: calendarCode,
            date: choice?.kind === 'day' ? selectedDate : '—',
            action: choiceLabel,
          })
        }}
      </p>
      <el-form
        ><el-form-item :label="t('batchDayGovernance.reason')" required
          ><el-input
            v-model="reason"
            type="textarea"
            maxlength="1024"
            show-word-limit
            :disabled="writing" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button :disabled="writing" @click="confirmation = false">{{
          t('common.cancel')
        }}</el-button
        ><el-button
          type="primary"
          :loading="writing"
          :disabled="!reason.trim() || !canWrite"
          @click="submit"
          >{{ t('common.confirm') }}</el-button
        ></template
      >
    </el-dialog>
  </el-drawer>
</template>
<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, shallowReactive, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import {
    previewBatchDayCatchup,
    queryHistoricalBatchDayGaps,
    queryBatchDayWindow,
    operateBatchDay,
    controlBatchDayCatchup,
    type BatchDayCatchupPreview,
    type BatchDayHistoricalGaps,
  } from '@/api/batchDays'
  import {
    restoreBatchDayCommand,
    saveBatchDayCommand,
    clearBatchDayCommand,
    type BatchDayCommand as Command,
  } from '../batchDayCommandRecovery'
  import type { ConsoleBatchDayWindowResponse } from '@/types/console-api'
  import { usePermission } from '@/composables/usePermission'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { createIdempotencyKey } from '@/utils/idempotency'
  import { todayBusinessDate } from '@/utils/datetime'
  import DataState from '@/components/common/DataState.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import {
    availableBatchDayActions,
    validGapRange,
    type BatchDayAction,
  } from '../batchDayGovernance'

  const props = defineProps<{ calendarCode: string; bizDate?: string }>()
  const visible = defineModel<boolean>({ default: false })
  const emit = defineEmits<{ changed: [] }>()
  const { t } = useI18n()
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const actor = computed(() => auth.userInfo?.username || '')
  const { canManageSystem, canWriteSystem, hasPermission } = usePermission()
  const recoveryBlocked = ref(false)
  const canWrite = computed(
    () => canWriteSystem.value && !recoveryBlocked.value && Boolean(actor.value),
  )
  const canRead = computed(() =>
    ['ROLE_ADMIN', 'ROLE_AUDITOR', 'ROLE_TENANT_ADMIN'].some(hasPermission),
  )
  const selectedDate = ref(props.bizDate || todayBusinessDate())
  const fromDate = ref('')
  const throughDate = ref('')
  const preview = ref<BatchDayCatchupPreview | null>(null)
  const day = ref<ConsoleBatchDayWindowResponse | null>(null)
  const gaps = ref<BatchDayHistoricalGaps | null>(null)
  const loading = ref(false)
  const loadError = ref(false)
  const gapsLoading = ref(false)
  const gapsError = ref(false)
  const writing = ref(false)
  const readbackRequired = ref(false)
  const actions = computed(() => availableBatchDayActions(day.value))
  const scope = computed(() => `${actor.value}\0${tenant.tenantId}\0${props.calendarCode.trim()}`)
  type Choice =
    { kind: 'day'; action: BatchDayAction } | { kind: 'catchup'; action: 'PAUSE' | 'RESUME' }
  const unresolved = shallowReactive(new Map<string, Command>())
  const pending = computed(() => unresolved.get(scope.value))
  const confirmation = ref(false)
  const reason = ref('')
  const choice = ref<Choice | null>(null)
  const choiceLabel = computed(() =>
    choice.value
      ? t(
          choice.value.kind === 'day'
            ? `batchDayGovernance.actions.${choice.value.action}`
            : choice.value.action === 'PAUSE'
              ? 'batchDayGovernance.pause'
              : 'batchDayGovernance.resume',
        )
      : '',
  )
  let sequence = 0
  let gapSequence = 0
  let disposed = false
  async function load() {
    const version = ++sequence
    const expectedScope = scope.value
    const date = selectedDate.value
    preview.value = null
    day.value = null
    loadError.value = false
    if (!visible.value || !canRead.value || !tenant.tenantId || !props.calendarCode.trim()) {
      loading.value = false
      return
    }
    loading.value = true
    const results = await Promise.allSettled([
      previewBatchDayCatchup(tenant.tenantId, props.calendarCode.trim()),
      queryBatchDayWindow(tenant.tenantId, props.calendarCode.trim(), date),
    ])
    if (disposed || version !== sequence || expectedScope !== scope.value) return
    if (results[0].status === 'fulfilled') {
      preview.value = results[0].value
      if (!fromDate.value) fromDate.value = results[0].value.currentBizDate
      if (!throughDate.value) throughDate.value = results[0].value.currentBizDate
    }
    if (results[1].status === 'fulfilled') day.value = results[1].value
    loadError.value = results.some((result) => result.status === 'rejected')
    readbackRequired.value = loadError.value
    loading.value = false
  }
  async function loadGaps() {
    if (
      !canRead.value ||
      !tenant.tenantId ||
      !props.calendarCode.trim() ||
      !preview.value ||
      !validGapRange(fromDate.value, throughDate.value, preview.value.currentBizDate)
    )
      return
    const version = ++gapSequence
    const expectedScope = scope.value
    gaps.value = null
    gapsError.value = false
    gapsLoading.value = true
    try {
      const result = await queryHistoricalBatchDayGaps(
        tenant.tenantId,
        props.calendarCode.trim(),
        fromDate.value,
        throughDate.value,
      )
      if (!disposed && version === gapSequence && expectedScope === scope.value) gaps.value = result
    } catch {
      if (version === gapSequence) gapsError.value = true
    } finally {
      if (version === gapSequence) gapsLoading.value = false
    }
  }
  function choose(kind: 'day' | 'catchup', action: BatchDayAction | 'PAUSE' | 'RESUME') {
    if (!canWrite.value || writing.value || pending.value) return
    choice.value =
      kind === 'day'
        ? { kind, action: action as BatchDayAction }
        : { kind, action: action as 'PAUSE' | 'RESUME' }
    reason.value = ''
    confirmation.value = true
  }
  async function submit() {
    if (!choice.value || !reason.value.trim() || !canWrite.value || writing.value || pending.value)
      return
    if (choice.value.kind === 'day' && !actions.value.includes(choice.value.action)) return
    const identity = {
      tenantId: tenant.tenantId,
      calendarCode: props.calendarCode.trim(),
      reason: reason.value.trim(),
    }
    const command: Command =
      choice.value.kind === 'day'
        ? {
            kind: 'day',
            body: { ...identity, bizDate: selectedDate.value, action: choice.value.action },
            key: createIdempotencyKey(),
            createdAt: Date.now(),
            actor: actor.value,
            scope: scope.value,
          }
        : {
            kind: 'catchup',
            body: { ...identity, action: choice.value.action },
            key: createIdempotencyKey(),
            createdAt: Date.now(),
            actor: actor.value,
            scope: scope.value,
          }
    await execute(command)
  }
  async function execute(command: Command) {
    if (!canWrite.value || writing.value || command.scope !== scope.value) return
    if (!saveBatchDayCommand(command)) {
      recoveryBlocked.value = true
      return
    }
    if (restoreBatchDayCommand(command.scope).blocked) {
      recoveryBlocked.value = true
      return
    }
    writing.value = true
    unresolved.set(command.scope, command)
    try {
      if (command.kind === 'day') await operateBatchDay(command.body, command.key)
      else await controlBatchDayCatchup(command.body, command.key)
      if (!clearBatchDayCommand(command)) recoveryBlocked.value = true
      unresolved.delete(command.scope)
      if (disposed || command.scope !== scope.value) return
      confirmation.value = false
      readbackRequired.value = true
      await load()
      if (!readbackRequired.value) ElMessage.success(t('batchDayGovernance.confirmed'))
      emit('changed')
    } catch (error) {
      // 仅明确业务拒绝或确定的4xx可解除未知状态；网络/5xx保留原命令与幂等键。
      const failure = error as { response?: { status: number } }
      const status = failure.response?.status
      if (status && status >= 400 && status < 500 && status !== 408) {
        if (!clearBatchDayCommand(command)) recoveryBlocked.value = true
        unresolved.delete(command.scope)
      }
      if (!disposed && command.scope === scope.value) {
        confirmation.value = false
        readbackRequired.value = true
        await load()
      }
    } finally {
      writing.value = false
    }
  }
  function resetScope() {
    recoveryBlocked.value = false
    if (tenant.tenantId && props.calendarCode.trim() && canRead.value && visible.value) {
      const restored = restoreBatchDayCommand(scope.value)
      recoveryBlocked.value = restored.blocked
      if (restored.command) unresolved.set(scope.value, restored.command)
    }
    fromDate.value = ''
    throughDate.value = ''
    ++sequence
    ++gapSequence
    confirmation.value = false
    preview.value = null
    day.value = null
    gaps.value = null
    gapsLoading.value = false
    gapsError.value = false
    void load()
  }
  useTenantReload(resetScope)
  watch(
    () => tenant.tenantId,
    (value) => {
      if (!value) resetScope()
    },
  )
  watch([visible, () => props.calendarCode, actor], resetScope)
  watch(selectedDate, () => {
    void load()
  })
  watch(
    () => props.bizDate,
    (date) => {
      if (date) selectedDate.value = date
    },
  )
  watch([fromDate, throughDate], () => {
    ++gapSequence
    gaps.value = null
    gapsLoading.value = false
  })
  onBeforeUnmount(() => {
    disposed = true
    ++sequence
    ++gapSequence
  })
</script>
