<template>
  <el-table
    v-loading="loading"
    :data="records"
    stripe
    border
    size="small"
    :empty-text="t('common.noData')"
    class="console-table"
  >
    <el-table-column :label="t('schedulerSnapshot.colQueue')" min-width="280">
      <template #default="{ row }">
        <div class="cell-stack">
          <div class="cell-main">
            <el-tag size="small" effect="plain" type="success">{{ row.queueCode }}</el-tag>
            <el-tag size="small" effect="plain" :type="tagTypeForKey(row.fairShareGroup)">
              {{ row.fairShareGroup }}
            </el-tag>
          </div>
          <div class="cell-sub">
            {{ t('schedulerSnapshot.quotaResetPolicyLabel') }}:
            <el-tag size="small" effect="plain" type="info">{{
              row.quotaResetPolicy
            }}</el-tag>
          </div>
        </div>
      </template>
    </el-table-column>
    <el-table-column
      prop="fairShareWeight"
      :label="t('schedulerSnapshot.colWeight')"
      width="90"
    />
    <el-table-column
      prop="activeJobs"
      :label="t('schedulerSnapshot.colActiveJobs')"
      width="110"
    />
    <el-table-column
      prop="maxRunningJobs"
      :label="t('schedulerSnapshot.colMaxRunningJobs')"
      width="150"
    />
    <el-table-column
      prop="effectiveMaxRunningJobs"
      :label="t('schedulerSnapshot.colEffectiveMaxRunningJobs')"
      width="190"
    />
    <el-table-column :label="t('schedulerSnapshot.partitionCapacity')" min-width="180">
      <template #default="{ row }">
        <template v-if="queuePartitionCapacity(row.activePartitions, row.maxRunningPartitions)">
          <span>{{ row.activePartitions }} / {{ row.maxRunningPartitions }}</span>
          <el-progress :percentage="queuePartitionCapacity(row.activePartitions, row.maxRunningPartitions)!.percent" :show-text="false" />
        </template>
        <span v-else>{{ t('schedulerSnapshot.partitionCapacityUnknown') }}</span>
      </template>
    </el-table-column>
    <el-table-column
      prop="burstLimit"
      :label="t('schedulerSnapshot.colBurstLimit')"
      width="110"
    />
    <el-table-column
      prop="quotaBurstRemaining"
      :label="t('schedulerSnapshot.colQuotaBurstRemaining')"
      width="160"
    />
    <el-table-column
      prop="quotaBurstPeakBorrowed"
      :label="t('schedulerSnapshot.colQuotaBurstPeakBorrowed')"
      width="180"
    />
    <el-table-column
      prop="groupSharedMaxRunningJobs"
      :label="t('schedulerSnapshot.colGroupSharedMax')"
      width="130"
    />
    <DatetimeColumn
      prop="quotaResetWindowExpiresAt"
      :label="t('schedulerSnapshot.colQuotaWindow')"
      width="170"
    />
    <el-table-column :label="t('schedulerSnapshot.colActions')" width="140" fixed="right">
      <template #default="{ row }">
        <CopyableText :text="String(row.queueCode ?? '')" class="snapshot-copy-action">
          <el-button type="primary" plain size="small" :icon="DocumentCopy">
            {{ t('schedulerSnapshot.actionCopyCode') }}
          </el-button>
        </CopyableText>
      </template>
    </el-table-column>
  </el-table>
  <TablePagerBar
    :page="page"
    :page-size="pageSize"
    :total="total"
    @update:page="emit('update:page', $event)"
    @update:page-size="emit('update:pageSize', $event)"
  />
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { Copy as DocumentCopy } from '@lucide/vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import type { ConsoleSchedulerQueueSnapshot } from '@/types/console-api'
  import { queuePartitionCapacity, tagTypeForKey } from '../schedulerSnapshotPresentation'

  defineProps<{
    records: ConsoleSchedulerQueueSnapshot[]
    loading: boolean
    page: number
    pageSize: number
    total: number
  }>()
  const emit = defineEmits<{
    'update:page': [page: number]
    'update:pageSize': [pageSize: number]
  }>()
  const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
  .cell-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cell-main {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }
  .cell-sub {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }
</style>
