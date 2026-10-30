<template>
          <el-table
            v-loading="props.loading"
            :data="props.waits"
            row-key="id"
            :empty-text="t('dependencyWaits.noCalendarWaits')"
            :aria-label="t('dependencyWaits.calendarTab')"
          >
            <el-table-column
              prop="calendarCode"
              :label="t('dependencyWaits.calendarCode')"
              min-width="145"
            />
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
              prop="blockedReason"
              :label="t('dependencyWaits.blockedReason')"
              min-width="170"
              show-overflow-tooltip
            />
            <el-table-column
              :label="t('dependencyWaits.dependencies')"
              min-width="180"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{
                dependencySnapshotText(row.dependencySnapshot)
              }}</template>
            </el-table-column>
            <el-table-column :label="t('dependencyWaits.lastCheckedAt')" width="170">
              <template #default="{ row }">{{ fmtDatetime(row.lastCheckedAt) }}</template>
            </el-table-column>
            <el-table-column :label="t('dependencyWaits.slaDeadlineAt')" width="170">
              <template #default="{ row }">{{ fmtDatetime(row.slaDeadlineAt) }}</template>
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
            <el-table-column :label="t('dependencyWaits.manualDecision')" min-width="190">
              <template #default="{ row }">
                <div v-if="row.manualAction" class="dependency-waits__decision">
                  <el-tag type="warning">{{
                    t('dependencyWaits.actionPending', {
                      action: t(`dependencyWaits.actions.${row.manualAction}`),
                    })
                  }}</el-tag>
                  <span>{{ fmtDatetime(row.manualRequestedAt) }}</span>
                  <el-tooltip v-if="row.manualReason" :content="row.manualReason">
                    <span class="dependency-waits__reason">{{ row.manualReason }}</span>
                  </el-tooltip>
                </div>
                <div
                  v-else-if="
                    canRequestCalendarDependencyAction(
                      row as CalendarDependencyWait,
                      props.canWriteSystem,
                    )
                  "
                  class="dependency-waits__actions"
                >
                  <el-button
                    text
                    type="primary"
                    :loading="props.pendingActionId === `${row.id}:RELEASE`"
                    :disabled="Boolean(props.pendingActionId)"
                    @click="requestAction(row as CalendarDependencyWait, 'RELEASE')"
                    >{{ t('dependencyWaits.actions.RELEASE') }}</el-button
                  >
                  <el-button
                    text
                    type="warning"
                    :loading="props.pendingActionId === `${row.id}:SKIP`"
                    :disabled="Boolean(props.pendingActionId)"
                    @click="requestAction(row as CalendarDependencyWait, 'SKIP')"
                    >{{ t('dependencyWaits.actions.SKIP') }}</el-button
                  >
                </div>
                <span v-else>—</span>
              </template>
            </el-table-column>
          </el-table>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { CalendarDependencyWait } from '@/api/dependencyWaits'
  import { fmtDatetime } from '@/utils/datetime'
  import {
    canRequestCalendarDependencyAction,
    dependencySnapshotText,
    waitStatusTone,
  } from '../../dependencyWaitsPresentation'

  const props = defineProps<{
    waits: CalendarDependencyWait[]
    loading: boolean
    canWriteSystem: boolean
    pendingActionId: string
  }>()
  const emit = defineEmits<{
    'request-action': [wait: CalendarDependencyWait, action: 'RELEASE' | 'SKIP']
  }>()
  const { t } = useI18n({ useScope: 'global' })
  const requestAction = (wait: CalendarDependencyWait, action: 'RELEASE' | 'SKIP') =>
    emit('request-action', wait, action)
</script>

<style scoped>
  .dependency-waits__actions,
  .dependency-waits__decision {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .dependency-waits__decision {
    align-items: flex-start;
    flex-direction: column;
  }

  .dependency-waits__decision > span {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .dependency-waits__reason {
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
