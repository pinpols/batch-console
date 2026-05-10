<template>
  <PageContainer>
    <PageHeader
      :title="title"
      :description="t('batchDayWindow.description')"
      back-to="/scheduler/batch-days"
    >
      <template #actions>
        <el-button type="primary" :loading="loading" @click="load">
          {{ t('batchDayWindow.refresh') }}
        </el-button>
        <el-button type="success" :disabled="!calendarCode" @click="openCatchup">
          {{ t('batchDayWindow.catchUp') }}
        </el-button>
      </template>
    </PageHeader>

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
          {{ window.currentSystemTime }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.cutoff')">
          {{ window.cutoffAt ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.slaCutoff')">
          {{ window.slaDeadlineAt ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.secondsToCutoff')">
          {{ window.timeUntilCutoffSeconds ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.lateWindowClosed')">
          {{ window.lateArrivalWindowClosesAt ?? '—' }}
        </el-descriptions-item>
      </el-descriptions>
    </SectionCard>

    <SectionCard v-if="window">
      <template #header>{{ t('batchDayWindow.jobSummary') }}</template>
      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="() => runSearch(() => {})"
        @reset="() => runReset(() => (jobKeyword = ''))"
        @refresh="() => runRefresh(load)"
      >
        <el-form-item label="Job">
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
        <el-table-column prop="jobCode" label="Job" min-width="160" />
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
        <el-table-column prop="catchupCount" label="Catch-up" width="88" />
      </el-table>
    </SectionCard>

    <SectionCard v-else-if="!loading">
      <EmptyState :description="t('batchDayWindow.emptyDescription')" />
    </SectionCard>

    <el-dialog
      v-model="catchupVisible"
      :title="t('batchDayWindow.dialogTitle')"
      width="520px"
      @closed="resetCatchup"
    >
      <el-form label-width="100px">
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
        <el-button @click="catchupVisible = false">{{
          t('batchDayWindow.dialogCancel')
        }}</el-button>
        <el-button type="primary" :loading="catchupLoading" @click="submitCatchup">
          {{ t('batchDayWindow.dialogSubmit') }}
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { launchBatchDayCatchUp, queryBatchDayWindow } from '@/api/batchDays'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleBatchDayWindowResponse } from '@/types/console-api'

  const route = useRoute()

  const tenant = useTenantStore()

  const bizDate = computed(() => (route.params.bizDate as string) || '')
  const calendarCode = computed(() => (route.query.calendarCode as string) || '')

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
    void load()
  })
</script>
