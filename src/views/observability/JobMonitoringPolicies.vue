<template>
  <PageContainer>
    <PageHeader />

    <ListPageQueryBar
      :cols="3"
      :filter-busy="loading"
      :refresh-busy="loading"
      :disabled="loading"
      @search="search"
      @reset="resetFilters"
      @refresh="load"
    >
      <el-form-item :label="t('jobMonitoringPolicy.jobCode')">
        <el-input
          v-model="filters.jobCode"
          clearable
          :placeholder="t('jobMonitoringPolicy.jobCodePlaceholder')"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item :label="t('jobMonitoringPolicy.jobStatus')">
        <el-select v-model="filters.enabled">
          <el-option :label="t('jobMonitoringPolicy.enabledOnly')" :value="true" />
          <el-option :label="t('jobMonitoringPolicy.disabledOnly')" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('jobMonitoringPolicy.scheduleType')">
        <MetaSelect
          v-model="filters.scheduleType"
          enum-key="scheduleType"
          clearable
          :placeholder="t('jobMonitoringPolicy.allScheduleTypes')"
        />
      </el-form-item>
    </ListPageQueryBar>

    <div class="policy-table-wrap">
      <EmptyState v-if="loadError && rows.length === 0" variant="error" :description="loadError">
        <template #action>
          <el-button type="primary" :icon="Refresh" :loading="loading" @click="load">
            {{ t('common.refresh') }}
          </el-button>
        </template>
      </EmptyState>
      <el-table
        v-else
        v-loading="loading"
        :data="rows"
        row-key="id"
        stripe
        border
        size="small"
        class="console-table"
        :empty-text="t('common.noData')"
      >
        <el-table-column :label="t('jobMonitoringPolicy.jobName')" min-width="230">
          <template #default="{ row }">
            <div class="job-cell">
              <span class="job-cell__name">{{ row.jobName }}</span>
              <code class="job-cell__code">{{ row.jobCode }}</code>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('jobMonitoringPolicy.scheduleType')" width="130">
          <template #default="{ row }">
            <el-tag :type="hasStartDeadline(row) ? 'success' : 'info'" effect="plain">
              {{ scheduleTypeLabel(row.scheduleType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('jobMonitoringPolicy.softRuntime')" min-width="190">
          <template #default="{ row }">
            <PolicyValue :seconds="row.softRuntimeSeconds" :severity="row.softRuntimeSeverity" />
          </template>
        </el-table-column>
        <el-table-column :label="t('jobMonitoringPolicy.scheduledDeadlines')" min-width="250">
          <template #default="{ row }">
            <ScheduledPolicySummary :job="row" />
          </template>
        </el-table-column>
        <el-table-column :label="t('jobMonitoringPolicy.jobStatus')" width="105">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
              {{
                row.enabled ? t('jobMonitoringPolicy.enabled') : t('jobMonitoringPolicy.disabled')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="90" fixed="right">
          <template #default="{ row }">
            <el-tooltip :content="t('common.edit')" placement="top">
              <el-button :icon="Edit" text type="primary" @click="openEdit(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="policy-pagination">
      <el-pagination
        v-model:current-page="pageNo"
        v-model:page-size="pageSize"
        :page-sizes="[15, 30, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="changePageSize"
      />
    </div>

    <el-drawer
      v-model="drawerOpen"
      :title="t('jobMonitoringPolicy.editTitle', { jobCode: editingJob?.jobCode ?? '' })"
      direction="rtl"
      size="min(600px, 96vw)"
      destroy-on-close
    >
      <el-form :model="form" label-position="top" @submit.prevent="save">
        <div class="job-identity">
          <span>{{ editingJob?.jobName }}</span>
          <code>{{ editingJob?.jobCode }}</code>
          <el-tag effect="plain">{{ editingJob?.scheduleType }}</el-tag>
          <span v-if="isScheduled(editingJob?.scheduleType)">
            {{ editingJob?.timezone || 'UTC' }}
          </span>
        </div>
        <JobMonitoringFields
          :schedule-type="editingJob?.scheduleType ?? 'MANUAL'"
          :depends-on-job-code="editingJob?.dependsOnJobCode"
          :timezone="editingJob?.timezone"
          v-model:soft-runtime-seconds="form.softRuntimeSeconds"
          v-model:soft-runtime-severity="form.softRuntimeSeverity"
          v-model:start-grace-seconds="form.startGraceSeconds"
          v-model:start-grace-severity="form.startGraceSeverity"
          v-model:completion-deadline-local-time="form.completionDeadlineLocalTime"
          v-model:completion-deadline-day-offset="form.completionDeadlineDayOffset"
          v-model:dependency-completion-window-seconds="form.dependencyCompletionWindowSeconds"
          v-model:completion-deadline-severity="form.completionDeadlineSeverity"
        />
      </el-form>
      <template #footer>
        <el-button @click="drawerOpen = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Pencil as Edit, RefreshCw as Refresh } from '@lucide/vue'
  import { jobApi } from '@/api/job'
  import type { ConsoleJobDefinitionResponse } from '@/types/console-api'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import JobMonitoringFields from '@/views/job/components/JobMonitoringFields.vue'
  import ScheduledPolicySummary from './components/ScheduledPolicySummary.vue'
  import PolicyValue from './components/JobMonitoringPolicyValue.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'

  type Severity = 'WARN' | 'ERROR' | 'CRITICAL'
  interface PolicyForm {
    softRuntimeSeconds: number
    softRuntimeSeverity: Severity
    startGraceSeconds: number
    startGraceSeverity: Severity
    completionDeadlineLocalTime: string | null
    completionDeadlineDayOffset: number
    dependencyCompletionWindowSeconds: number
    completionDeadlineSeverity: Severity
  }

  const { t, te } = useI18n({ useScope: 'global' })
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const scheduleTypes = computed(() => metaEnums.value?.scheduleType ?? [])
  const tenant = useTenantStore()
  const rows = ref<ConsoleJobDefinitionResponse[]>([])
  const editingJob = ref<ConsoleJobDefinitionResponse | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const drawerOpen = ref(false)
  const loadError = ref('')
  const pageNo = ref(1)
  const pageSize = ref(15)
  const total = ref(0)
  let loadSequence = 0
  const filters = reactive<{
    jobCode: string
    enabled: boolean
    scheduleType: '' | 'CRON' | 'FIXED_RATE' | 'MANUAL'
  }>({ jobCode: '', enabled: true, scheduleType: '' })
  const form = reactive<PolicyForm>(emptyPolicy())

  watch(
    () => tenant.tenantId,
    () => {
      loadSequence += 1
      rows.value = []
      total.value = 0
      pageNo.value = 1
      loadError.value = ''
      loading.value = false
    },
  )

  function emptyPolicy(): PolicyForm {
    return {
      softRuntimeSeconds: 0,
      softRuntimeSeverity: 'WARN',
      startGraceSeconds: 0,
      startGraceSeverity: 'WARN',
      completionDeadlineLocalTime: null,
      completionDeadlineDayOffset: 0,
      dependencyCompletionWindowSeconds: 0,
      completionDeadlineSeverity: 'WARN',
    }
  }

  async function load() {
    if (!tenant.tenantId) return
    const requestSequence = ++loadSequence
    const requestTenantId = tenant.tenantId
    loading.value = true
    loadError.value = ''
    try {
      const result = await jobApi.listDefinitionsPaged({
        tenantId: requestTenantId,
        pageNo: pageNo.value,
        pageSize: pageSize.value,
        jobCode: filters.jobCode.trim() || undefined,
        scheduleType: filters.scheduleType || undefined,
        enabled: filters.enabled,
      })
      if (requestSequence !== loadSequence || tenant.tenantId !== requestTenantId) return
      rows.value = result.records
      total.value = result.total
    } catch (error) {
      if (requestSequence !== loadSequence || tenant.tenantId !== requestTenantId) return
      rows.value = []
      total.value = 0
      loadError.value = error instanceof Error ? error.message : t('jobMonitoringPolicy.loadFailed')
    } finally {
      if (requestSequence === loadSequence) loading.value = false
    }
  }

  function search() {
    pageNo.value = 1
    void load()
  }

  function resetFilters() {
    filters.jobCode = ''
    filters.enabled = true
    filters.scheduleType = ''
    pageNo.value = 1
    void load()
  }

  function changePageSize() {
    pageNo.value = 1
    void load()
  }

  function openEdit(job: ConsoleJobDefinitionResponse) {
    editingJob.value = job
    Object.assign(form, {
      softRuntimeSeconds: job.softRuntimeSeconds ?? 0,
      softRuntimeSeverity: job.softRuntimeSeverity ?? 'WARN',
      startGraceSeconds: job.startGraceSeconds ?? 0,
      startGraceSeverity: job.startGraceSeverity ?? 'WARN',
      completionDeadlineLocalTime: job.completionDeadlineLocalTime?.slice(0, 5) ?? null,
      completionDeadlineDayOffset: job.completionDeadlineDayOffset ?? 0,
      dependencyCompletionWindowSeconds: job.dependencyCompletionWindowSeconds ?? 0,
      completionDeadlineSeverity: job.completionDeadlineSeverity ?? 'WARN',
    })
    drawerOpen.value = true
  }

  async function save() {
    const job = editingJob.value
    if (!job || !tenant.tenantId) return
    saving.value = true
    try {
      await jobApi.updateDefinition(job.id, {
        tenantId: tenant.tenantId,
        ...form,
        completionDeadlineEnabled:
          job.scheduleType === 'CRON' &&
          !job.dependsOnJobCode &&
          Boolean(form.completionDeadlineLocalTime),
      })
      drawerOpen.value = false
      ElMessage.success(t('jobMonitoringPolicy.saveSuccess'))
      await load()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : t('jobMonitoringPolicy.saveFailed'))
    } finally {
      saving.value = false
    }
  }

  function isScheduled(scheduleType?: string | null) {
    return scheduleType === 'CRON' || scheduleType === 'FIXED_RATE'
  }

  function hasStartDeadline(job: ConsoleJobDefinitionResponse) {
    return job.scheduleType === 'CRON' || Boolean(job.dependsOnJobCode?.trim())
  }

  function scheduleTypeLabel(scheduleType?: string | null) {
    if (!scheduleType) return '—'
    const key = `enum.scheduleType.${scheduleType}`
    if (te(key)) return t(key)
    return (
      scheduleTypes.value.find((option) => option.value === scheduleType)?.label ?? scheduleType
    )
  }

  useTenantReload(load)
</script>

<style scoped>
  .policy-table-wrap {
    margin-top: var(--page-block-gap);
  }

  .policy-pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--page-block-gap);
  }

  .job-identity {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: var(--page-block-gap);
    color: var(--el-text-color-primary);
    font-weight: 600;
  }

  .job-identity code {
    color: var(--el-text-color-secondary);
    font-weight: 400;
  }

  .job-cell {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .job-cell__name {
    overflow-wrap: anywhere;
    color: var(--el-text-color-primary);
  }

  .job-cell__code {
    overflow-wrap: anywhere;
    color: var(--el-text-color-secondary);
    font-size: var(--el-font-size-extra-small);
  }
</style>
