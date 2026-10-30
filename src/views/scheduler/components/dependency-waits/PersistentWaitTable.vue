<template>
          <el-table
            v-loading="props.loading"
            :data="props.waits"
            :row-key="persistentWaitRowKey"
            :empty-text="t('dependencyWaits.noPersistentWaits')"
            :aria-label="t('dependencyWaits.persistentTab')"
          >
            <el-table-column :label="t('dependencyWaits.waitType')" width="155">
              <template #default="{ row }">{{
                t(`dependencyWaits.waitTypes.${row.waitType}`)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="workflowCode"
              :label="t('dependencyWaits.workflowCode')"
              min-width="150"
            />
            <el-table-column
              prop="calendarCode"
              :label="t('dependencyWaits.calendarCode')"
              min-width="140"
            />
            <el-table-column
              prop="bizDate"
              :label="t('dependencyWaits.businessDate')"
              width="125"
            />
            <el-table-column :label="t('dependencyWaits.status')" width="135">
              <template #default="{ row }">
                <el-tag :type="persistentWaitStatusTone(row.waitStatus)">
                  {{ t(`dependencyWaits.states.${row.waitStatus}`) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('dependencyWaits.blockedReason')"
              min-width="155"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{
                row.reasonCode || row.lastErrorCode || '—'
              }}</template>
            </el-table-column>
            <el-table-column
              prop="dependencyJobCodes"
              :label="t('dependencyWaits.dependencies')"
              min-width="175"
              show-overflow-tooltip
            />
            <el-table-column :label="t('dependencyWaits.waitStartedAt')" width="170">
              <template #default="{ row }">{{ fmtDatetime(row.deferredSince) }}</template>
            </el-table-column>
            <el-table-column :label="t('dependencyWaits.scheduledFireTime')" width="170">
              <template #default="{ row }">{{ fmtDatetime(row.scheduledFireTime) }}</template>
            </el-table-column>
            <el-table-column :label="t('dependencyWaits.deadline')" width="170">
              <template #default="{ row }">{{
                fmtDatetime(row.deadline || row.nextAttemptAt)
              }}</template>
            </el-table-column>
            <el-table-column :label="t('dependencyWaits.attempts')" width="95" align="right">
              <template #default="{ row }">{{ row.attemptCount ?? '—' }}</template>
            </el-table-column>
            <el-table-column
              prop="requestId"
              :label="t('dependencyWaits.requestId')"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column
              prop="traceId"
              :label="t('dependencyWaits.traceId')"
              min-width="180"
              show-overflow-tooltip
            />
          </el-table>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { PersistentWait } from '@/api/persistentWaits'
  import { fmtDatetime } from '@/utils/datetime'
  import {
    persistentWaitRowKey,
    persistentWaitStatusTone,
  } from '../../dependencyWaitsPresentation'

  const props = defineProps<{ waits: PersistentWait[]; loading: boolean }>()
  const { t } = useI18n({ useScope: 'global' })
</script>
