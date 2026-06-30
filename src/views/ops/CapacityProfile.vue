<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Refresh" :loading="loading" @click="load">
          {{ t('capacityProfile.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ListPageQueryBar
        :filter-busy="loading"
        :refresh-busy="loading"
        :disabled="loading"
        @search="load"
        @reset="resetFilters"
        @refresh="load"
      >
        <el-form-item :label="t('capacityProfile.groupByLabel')">
          <el-segmented v-model="query.groupBy" :options="groupByOptions" />
        </el-form-item>
        <el-form-item :label="t('capacityProfile.limitLabel')">
          <el-input-number v-model="query.limit" :min="1" :max="200" controls-position="right" />
        </el-form-item>
        <el-form-item :label="t('capacityProfile.windowLabel')">
          <el-date-picker
            v-model="range"
            type="datetimerange"
            unlink-panels
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            :start-placeholder="t('capacityProfile.fromPlaceholder')"
            :end-placeholder="t('capacityProfile.toPlaceholder')"
          />
        </el-form-item>
      </ListPageQueryBar>
    </SectionCard>

    <SectionCard v-if="!report && !loading" class="mt">
      <EmptyState
        :variant="loadError ? 'error' : 'empty'"
        :description="loadError || t('capacityProfile.emptyHint')"
      >
        <template v-if="loadError" #action>
          <el-button type="primary" :icon="Refresh" :loading="loading" @click="load">
            {{ t('capacityProfile.refresh') }}
          </el-button>
        </template>
      </EmptyState>
    </SectionCard>

    <div v-if="report" class="profile-grid">
      <MetricCard
        :label="t('capacityProfile.metricInstances')"
        :value="formatNumber(report.totals?.instanceCount)"
        :description="t('capacityProfile.metricInstancesDesc')"
      />
      <MetricCard
        :label="t('capacityProfile.metricTasks')"
        :value="formatNumber(report.totals?.taskCount)"
        :description="t('capacityProfile.metricTasksDesc')"
      />
      <MetricCard
        :label="t('capacityProfile.metricDuration')"
        :value="formatDuration(report.totals?.totalDurationMs)"
        :description="t('capacityProfile.metricDurationDesc')"
      />
      <MetricCard
        :label="t('capacityProfile.metricBytes')"
        :value="formatBytes(report.totals?.totalFileBytes)"
        :description="t('capacityProfile.metricBytesDesc')"
      />
    </div>

    <SectionCard v-if="report" class="mt">
      <template #header>
        <div class="profile-header">
          <span>{{ t('capacityProfile.resultTitle') }}</span>
          <div class="profile-header__meta">
            <el-tag size="small" effect="plain">{{ report.groupBy || query.groupBy }}</el-tag>
            <el-tag v-if="report.scope" size="small" effect="plain" type="info">
              {{ report.scope }}
            </el-tag>
            <el-tag v-if="report.generatedAt" size="small" effect="plain" type="info">
              {{ report.generatedAt }}
            </el-tag>
          </div>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="report.rows ?? []"
        stripe
        border
        size="small"
        :empty-text="t('common.noData')"
        class="console-table"
      >
        <el-table-column :label="dimensionLabel" min-width="220">
          <template #default="{ row }">
            <div class="cell-stack">
              <div class="cell-main">{{ dimensionValue(row) }}</div>
              <div class="cell-sub">{{ secondaryDimensionValue(row) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="instanceCount"
          :label="t('capacityProfile.colInstances')"
          width="110"
          align="right"
        />
        <el-table-column
          prop="taskCount"
          :label="t('capacityProfile.colTasks')"
          width="100"
          align="right"
        />
        <el-table-column
          prop="successCount"
          :label="t('capacityProfile.colSuccess')"
          width="100"
          align="right"
        />
        <el-table-column
          prop="failureCount"
          :label="t('capacityProfile.colFailure')"
          width="100"
          align="right"
        />
        <el-table-column :label="t('capacityProfile.colAvg')" width="120" align="right">
          <template #default="{ row }">{{ formatDuration(row.avgDurationMs) }}</template>
        </el-table-column>
        <el-table-column :label="t('capacityProfile.colP95')" width="120" align="right">
          <template #default="{ row }">{{ formatDuration(row.p95DurationMs) }}</template>
        </el-table-column>
        <el-table-column :label="t('capacityProfile.colBytes')" width="130" align="right">
          <template #default="{ row }">{{ formatBytes(row.totalFileBytes) }}</template>
        </el-table-column>
        <el-table-column
          prop="processedRecords"
          :label="t('capacityProfile.colRecords')"
          width="130"
          align="right"
        />
        <el-table-column
          prop="recordsPerSecond"
          :label="t('capacityProfile.colRecordsRate')"
          width="130"
          align="right"
        />
        <el-table-column
          prop="mbPerSecond"
          :label="t('capacityProfile.colMbRate')"
          width="110"
          align="right"
        />
      </el-table>
    </SectionCard>

    <SectionCard v-if="report?.coverage" class="mt">
      <template #header>{{ t('capacityProfile.coverageTitle') }}</template>
      <JsonPreview :data="report.coverage" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Refresh } from '@element-plus/icons-vue'
  import {
    getCapacityProfile,
    type CapacityProfileGroupBy,
    type CapacityProfileReport,
    type CapacityProfileRow,
  } from '@/api/capacityProfile'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref('')
  const report = ref<CapacityProfileReport | null>(null)
  const range = ref<[string, string] | null>(null)
  const query = reactive<{ groupBy: CapacityProfileGroupBy; limit: number }>({
    groupBy: 'TENANT',
    limit: 50,
  })

  const groupByOptions = computed(() => [
    { label: t('capacityProfile.groupByTenant'), value: 'TENANT' },
    { label: t('capacityProfile.groupByJob'), value: 'JOB' },
    { label: t('capacityProfile.groupByWorker'), value: 'WORKER' },
  ])

  const dimensionLabel = computed(() => {
    if (query.groupBy === 'JOB') return t('capacityProfile.dimensionJob')
    if (query.groupBy === 'WORKER') return t('capacityProfile.dimensionWorker')
    return t('capacityProfile.dimensionTenant')
  })

  function dimensionValue(row: CapacityProfileRow): string {
    if (query.groupBy === 'JOB') return row.jobCode || '—'
    if (query.groupBy === 'WORKER') return row.workerCode || '—'
    return row.tenantId || tenant.tenantId || '—'
  }

  function secondaryDimensionValue(row: CapacityProfileRow): string {
    if (query.groupBy === 'WORKER') return row.workerGroup || row.tenantId || '—'
    if (query.groupBy === 'JOB') return row.tenantId || tenant.tenantId || '—'
    return report.value?.window?.from && report.value?.window?.to
      ? `${report.value.window.from} ~ ${report.value.window.to}`
      : '—'
  }

  function formatNumber(value: unknown): string {
    const n = Number(value)
    return Number.isFinite(n) ? n.toLocaleString() : '0'
  }

  function formatDuration(value: unknown): string {
    const ms = Number(value)
    if (!Number.isFinite(ms) || ms <= 0) return '0 ms'
    if (ms < 1000) return `${Math.round(ms)} ms`
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(1)} s`
    return `${(seconds / 60).toFixed(1)} min`
  }

  function formatBytes(value: unknown): string {
    const bytes = Number(value)
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let n = bytes
    let i = 0
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024
      i += 1
    }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
  }

  async function load() {
    loading.value = true
    loadError.value = ''
    try {
      report.value = await getCapacityProfile({
        tenantId: tenant.tenantId,
        groupBy: query.groupBy,
        limit: query.limit,
        from: range.value?.[0],
        to: range.value?.[1],
      })
      ElMessage.success(t('capacityProfile.loadOk'))
    } catch (error) {
      report.value = null
      loadError.value = error instanceof Error ? error.message : t('capacityProfile.loadFailed')
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    query.groupBy = 'TENANT'
    query.limit = 50
    range.value = null
    void load()
  }

  useTenantReload(load)
</script>

<style scoped>
  .profile-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-md);
    margin-top: var(--page-block-gap);
  }

  .profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .profile-header__meta,
  .cell-main {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .cell-stack {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .cell-sub {
    color: var(--color-text-tertiary);
    font-size: 12px;
  }

  .mt {
    margin-top: var(--page-block-gap);
  }

  @media (max-width: 1080px) {
    .profile-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
