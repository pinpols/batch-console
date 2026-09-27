<template>
  <PageContainer>
    <PageHeader
      :title="title"
      :description="t('batchDayWindow.description')"
      back-to="/scheduler/batch-days"
    >
      <template #actions>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading || refresh.loading.value"
          @click="refresh.run(load)"
        >
          {{ t('batchDayWindow.refresh') }}
        </el-button>
        <el-button
          v-if="canManageSystem"
          type="success"
          :disabled="!calendarCode"
          @click="openCatchup"
        >
          {{ t('batchDayWindow.catchUp') }}
        </el-button>
      </template>
    </PageHeader>

    <div class="batch-day-context" role="search">
      <div class="batch-day-context__field">
        <span>{{ t('batchDayWindow.queryBizDate') }}</span>
        <el-date-picker
          v-model="bizDateDraft"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="t('batchDayWindow.queryBizDatePlaceholder')"
        />
      </div>
      <div class="batch-day-context__field">
        <span>{{ t('batchDayWindow.queryCalendar') }}</span>
        <el-select
          v-model="calendarDraft"
          filterable
          allow-create
          default-first-option
          :placeholder="t('batchDayWindow.selectCalendarPlaceholder')"
        >
          <el-option label="DEFAULT" value="DEFAULT" />
        </el-select>
      </div>
      <el-button type="primary" :loading="loading" @click="applyWindowQuery">
        {{ t('batchDayWindow.loadCalendar') }}
      </el-button>
    </div>

    <SectionCard v-if="window">
      <template #header>{{ t('batchDayWindow.windowStatus') }}</template>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item :label="t('batchDayWindow.bizDate')">
          {{ window.bizDate }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.dayStatus')">
          {{ window.dayStatus }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.currentTime')">
          <DatetimeText :value="window.currentSystemTime" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.cutoff')">
          <DatetimeText :value="window.cutoffAt" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.slaCutoff')">
          <DatetimeText :value="window.slaDeadlineAt" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.secondsToCutoff')">
          {{ window.timeUntilCutoffSeconds ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.lateWindowClosed')">
          <DatetimeText :value="window.lateArrivalWindowClosesAt" />
        </el-descriptions-item>
      </el-descriptions>
    </SectionCard>

    <SectionCard v-if="window">
      <template #header>{{ t('batchDayWindow.jobSummary') }}</template>
      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="() => runSearch(() => {})"
        @reset="
          () =>
            runReset(() => {
              jobKeyword = ''
            })
        "
        @refresh="() => runRefresh(load)"
      >
        <el-form-item :label="t('batchDayWindow.colJob')">
          <el-input
            class="query-w-240"
            v-model="jobKeyword"
            clearable
            :placeholder="t('batchDayWindow.jobSearchPlaceholder')"
          />
        </el-form-item>
      </ListPageQueryBar>
      <el-table
        :data="filteredJobs"
        stripe
        border
        :empty-text="t('common.noData')"
        class="console-table"
      >
        <el-table-column prop="jobCode" :label="t('batchDayWindow.colJob')" min-width="160">
          <template #default="{ row }">
            <router-link
              v-if="row.jobCode"
              class="cell-link"
              :to="`/monitor/job-instances?jobCode=${row.jobCode}&startDate=${bizDate}&endDate=${bizDate}`"
            >
              {{ row.jobCode }}
            </router-link>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column prop="totalJobCount" :label="t('batchDayWindow.colTotalJob')" width="72" />
        <el-table-column
          prop="successJobCount"
          :label="t('batchDayWindow.colSuccessJob')"
          width="72"
        />
        <el-table-column
          prop="failedJobCount"
          :label="t('batchDayWindow.colFailedJob')"
          width="72"
        />
        <el-table-column
          prop="inFlightJobCount"
          :label="t('batchDayWindow.colInFlightJob')"
          width="88"
        />
        <el-table-column
          prop="catchupCount"
          :label="t('batchDayWindow.colCatchupJob')"
          width="88"
        />
      </el-table>
    </SectionCard>

    <SectionCard v-else-if="!loading && !calendarCode">
      <EmptyState
        :title="t('batchDayWindow.selectCalendarTitle')"
        :description="t('batchDayWindow.selectCalendarDescription')"
      />
    </SectionCard>

    <SectionCard v-else-if="!loading">
      <EmptyState :description="t('batchDayWindow.emptyDescription')" />
    </SectionCard>

    <el-drawer
      :append-to-body="true"
      v-model="catchupVisible"
      :title="t('batchDayWindow.dialogTitle')"
      direction="rtl"
      size="480px"
      @closed="resetCatchup"
    >
      <el-form label-width="88px">
        <el-form-item :label="t('batchDayWindow.fieldCalendar')">
          <el-input v-model="catchupForm.calendarCode" disabled />
        </el-form-item>
        <el-form-item :label="t('batchDayWindow.fieldJobCodes')">
          <el-input
            v-model="catchupJobCodesText"
            type="textarea"
            :rows="2"
            :placeholder="t('batchDayWindow.fieldJobCodesPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('batchDayWindow.fieldReason')">
          <el-input
            v-model="catchupForm.reason"
            type="textarea"
            :rows="2"
            :placeholder="t('batchDayWindow.fieldReasonPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="catchupVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="catchupLoading" @click="submitCatchup">
          {{ t('batchDayWindow.dialogSubmit') }}
        </el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { RefreshCw as Refresh } from '@lucide/vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'
  import { usePermission } from '@/composables/usePermission'

  const refresh = useRefreshAction()
  const { canManageSystem } = usePermission()

  const { t } = useI18n({ useScope: 'global' })
  import { launchBatchDayCatchUp, queryBatchDayWindow } from '@/api/batchDays'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import DatetimeText from '@/components/common/DatetimeText.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleBatchDayWindowResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()

  const tenant = useTenantStore()

  const bizDate = computed(() => (route.params.bizDate as string) || '')
  const calendarCode = computed(() => (route.query.calendarCode as string) || '')
  const bizDateDraft = ref(bizDate.value)
  const calendarDraft = ref(calendarCode.value || 'DEFAULT')

  const title = computed(() =>
    bizDate.value
      ? t('batchDayWindow.titleWithDate', { date: bizDate.value })
      : t('batchDayWindow.titleDefault'),
  )

  const loading = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loading)
  const window = ref<ConsoleBatchDayWindowResponse | null>(null)
  const jobKeyword = ref('')

  const filteredJobs = computed(() => {
    const list = window.value?.jobs ?? []
    const k = jobKeyword.value.trim().toLowerCase()
    if (!k) return list
    return list.filter((x) =>
      String(x.jobCode ?? '')
        .toLowerCase()
        .includes(k),
    )
  })

  const catchupVisible = ref(false)
  const catchupLoading = ref(false)
  const catchupJobCodesText = ref('')
  const catchupForm = ref({
    calendarCode: '',
    reason: '',
  })

  async function load() {
    const bd = bizDate.value
    const cal = calendarCode.value.trim()
    if (!bd || !cal) {
      window.value = null
      return
    }
    loading.value = true
    try {
      window.value = await queryBatchDayWindow(tenant.tenantId, cal, bd)
    } catch {
      window.value = null
    } finally {
      loading.value = false
    }
  }

  function applyWindowQuery() {
    const date = bizDateDraft.value
    const value = calendarDraft.value.trim()
    if (!date || !value) {
      ElMessage.warning(t('batchDayWindow.missingQuery'))
      return
    }
    void router.replace({
      path: `/scheduler/batch-days/${date}`,
      query: { ...route.query, calendarCode: value },
    })
  }

  function openCatchup() {
    if (!calendarCode.value.trim()) {
      ElMessage.warning(t('batchDayWindow.missingCalendar'))
      return
    }
    catchupForm.value = {
      calendarCode: calendarCode.value.trim(),
      reason: '',
    }
    catchupJobCodesText.value = ''
    catchupVisible.value = true
  }

  function resetCatchup() {
    catchupJobCodesText.value = ''
    catchupForm.value.reason = ''
  }

  async function submitCatchup() {
    const bd = bizDate.value
    if (!bd) return
    const raw = catchupJobCodesText.value.trim()
    const jobCodes = raw
      ? raw
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined

    catchupLoading.value = true
    try {
      const res = await launchBatchDayCatchUp(bd, {
        tenantId: tenant.tenantId,
        calendarCode: catchupForm.value.calendarCode,
        jobCodes,
        reason: catchupForm.value.reason || undefined,
      })
      const n = res.items?.length ?? 0
      ElMessage.success(t('batchDayWindow.submitSuccess', { n }))
      catchupVisible.value = false
      await load()
    } finally {
      catchupLoading.value = false
    }
  }

  useTenantReload(load)

  watch([bizDate, calendarCode], () => {
    bizDateDraft.value = bizDate.value
    calendarDraft.value = calendarCode.value || 'DEFAULT'
    void load()
  })
</script>

<style scoped>
  .batch-day-context {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
  }

  .batch-day-context__field {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .batch-day-context__field :deep(.el-date-editor),
  .batch-day-context__field :deep(.el-select) {
    width: 12rem;
  }

  @media (max-width: 56.25rem) {
    .batch-day-context {
      align-items: stretch;
      flex-direction: column;
    }

    .batch-day-context__field :deep(.el-date-editor),
    .batch-day-context__field :deep(.el-select) {
      width: 100%;
    }
  }
</style>
