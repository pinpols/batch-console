<template>
          <el-table
            v-loading="props.loading"
            :data="props.waits"
            row-key="requestId"
            :empty-text="t('dependencyWaits.noJobWaits')"
            :aria-label="t('dependencyWaits.jobTab')"
          >
            <el-table-column prop="jobCode" :label="t('dependencyWaits.jobCode')" min-width="150" />
            <el-table-column
              prop="bizDate"
              :label="t('dependencyWaits.businessDate')"
              width="125"
            />
            <el-table-column :label="t('dependencyWaits.status')" width="125">
              <template #default="{ row }">
                <el-tag :type="waitStatusTone(row.waitStatus)">
                  {{ t(`dependencyWaits.states.${row.waitStatus}`) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('dependencyWaits.dependencies')"
              min-width="180"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{
                dependencySnapshotText(row.dependencySnapshot)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="lastNotReadyReason"
              :label="t('dependencyWaits.blockedReason')"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column :label="t('dependencyWaits.lastCheckedAt')" width="170">
              <template #default="{ row }">{{ fmtDatetime(row.lastCheckedAt) }}</template>
            </el-table-column>
            <el-table-column :label="t('dependencyWaits.timeoutAlertedAt')" width="170">
              <template #default="{ row }">{{ fmtDatetime(row.timeoutAlertedAt) }}</template>
            </el-table-column>
            <el-table-column
              prop="attemptCount"
              :label="t('dependencyWaits.attempts')"
              width="90"
              align="right"
            />
            <el-table-column
              prop="requestId"
              :label="t('dependencyWaits.requestId')"
              min-width="180"
              show-overflow-tooltip
            />
          </el-table>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { JobDependencyWait } from '@/api/dependencyWaits'
  import { fmtDatetime } from '@/utils/datetime'
  import { dependencySnapshotText, waitStatusTone } from '../../dependencyWaitsPresentation'

  const props = defineProps<{ waits: JobDependencyWait[]; loading: boolean }>()
  const { t } = useI18n({ useScope: 'global' })
</script>
