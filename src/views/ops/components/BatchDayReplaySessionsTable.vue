<template>
      <el-table
        class="replay-sessions-table"
        :data="props.sessions"
        v-loading="props.loading"
        :empty-text="t('batchDayReplay.noSessions')"
        row-key="id"
        @row-click="emit('open-detail', $event as BatchDayReplaySession)"
        table-layout="fixed"
      >
        <template #empty>
          <EmptyState
            variant="empty"
            :title="t('batchDayReplay.emptyTitle')"
            :description="
              props.historyUnavailable
                ? t('batchDayReplay.emptyLegacyDesc')
                : t('batchDayReplay.emptyDesc')
            "
          >
            <template #action>
              <el-button
                type="primary"
                :icon="Plus"
                :disabled="props.writesFrozen"
                @click.stop="emit('submit')"
              >
                {{ t('batchDayReplay.submitBtn') }}
              </el-button>
            </template>
          </EmptyState>
        </template>
        <el-table-column :label="t('batchDayReplay.colId')" prop="id" width="80" />
        <el-table-column :label="t('batchDayReplay.colBizDate')" prop="bizDate" width="120" />
        <el-table-column :label="t('batchDayReplay.colMode')" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.executionMode === 'DRY_RUN' ? 'warning' : 'info'">
              {{ row.executionMode }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colScope')" width="160">
          <template #default="{ row }">
            <el-tag size="small" :type="props.scopeTagType(row.scope)" effect="plain">
              {{ row.scope }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colStatus')" width="160">
          <template #default="{ row }">
            <el-tag :type="props.statusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colProgress')" width="200">
          <template #default="{ row }">
            <el-progress :percentage="props.progressPct(row as BatchDayReplaySession)" :status="props.progressStatus(row as BatchDayReplaySession)" />
            <span class="cell-mute">
              {{ row.succeededCount ?? 0 }} / {{ row.totalCount ?? 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colRequestedBy')" prop="requestedBy" />
        <DatetimeColumn :label="t('batchDayReplay.colCreatedAt')" prop="createdAt" width="180" />
      </el-table>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { Plus } from '@lucide/vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import type { BatchDayReplaySession } from '@/api/batchDayReplay'

  const props = defineProps<{
    sessions: BatchDayReplaySession[]
    loading: boolean
    historyUnavailable: boolean
    writesFrozen: boolean
    scopeTagType: (scope: string) => 'primary' | 'warning' | 'success' | 'info'
    statusTagType: (status: string) => 'primary' | 'success' | 'danger' | 'warning' | 'info'
    progressPct: (session: BatchDayReplaySession) => number
    progressStatus: (session: BatchDayReplaySession) => 'success' | 'exception' | undefined
  }>()
  const emit = defineEmits<{
    'open-detail': [session: BatchDayReplaySession]
    submit: []
  }>()
  const { t } = useI18n({ useScope: 'global' })
</script>
