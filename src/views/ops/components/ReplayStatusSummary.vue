<template>
  <section class="replay-status-summary" :aria-label="t('batchDayReplay.statusSummaryTitle')">
    <h3>{{ t('batchDayReplay.statusSummaryTitle') }}</h3>
    <p class="replay-status-summary__hint">{{ t('batchDayReplay.statusPreviewUnavailable') }}</p>
    <p class="replay-status-summary__guidance" role="status">{{ statusGuidance }}</p>
    <dl>
      <div>
        <dt>{{ t('batchDayReplay.colStatus') }}</dt>
        <dd>
          {{ statusLabel }}
          <span v-if="statusLabel !== record.status" class="replay-status-summary__code">{{
            record.status
          }}</span>
        </dd>
      </div>
      <div v-if="record.approvedBy">
        <dt>{{ t('batchDayReplay.fieldApprovedBy') }}</dt>
        <dd>{{ record.approvedBy }}</dd>
      </div>
      <div v-if="'approvalId' in record && record.approvalId != null">
        <dt>{{ t('batchDayReplay.statusApprovalId') }}</dt>
        <dd>{{ record.approvalId }}</dd>
      </div>
      <div v-if="record.startedAt">
        <dt>{{ t('batchDayReplay.statusStartedAt') }}</dt>
        <dd>{{ fmtDatetime(record.startedAt) }}</dd>
      </div>
      <div v-if="record.completedAt">
        <dt>{{ t('batchDayReplay.statusCompletedAt') }}</dt>
        <dd>{{ fmtDatetime(record.completedAt) }}</dd>
      </div>
      <div v-if="hasCounts" class="replay-status-summary__counts">
        <dt>{{ t('batchDayReplay.colProgress') }}</dt>
        <dd>
          {{
            t('batchDayReplay.entriesSummary', {
              ok: record.succeededCount ?? '—',
              fail: record.failedCount ?? '—',
              pending: record.inFlightCount ?? '—',
              total: record.totalCount ?? '—',
            })
          }}
        </dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { fmtDatetime } from '@/utils/datetime'
  import type { BatchDayReplaySession, ReplayOperation } from '@/api/batchDayReplay'

  const props = defineProps<{ record: BatchDayReplaySession | ReplayOperation }>()
  const { t, te } = useI18n()
  const statusLabel = computed(() => {
    const key = `batchDayReplay.statusLabels.${props.record.status}`
    return te(key) ? t(key) : props.record.status
  })
  const statusGuidance = computed(() => {
    const key = `batchDayReplay.statusGuidance.${props.record.status}`
    return te(key) ? t(key) : t('batchDayReplay.statusGuidanceUnknown')
  })
  const hasCounts = computed(() =>
    [
      props.record.succeededCount,
      props.record.failedCount,
      props.record.inFlightCount,
      props.record.totalCount,
    ].some((value) => value != null),
  )
</script>

<style scoped>
  .replay-status-summary {
    margin-bottom: var(--space-md);
    padding: var(--space-md);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-subtle);
  }
  h3 {
    margin: 0;
    font-size: var(--font-size-base);
  }
  .replay-status-summary__hint {
    margin: var(--space-xs) 0 var(--space-md);
    color: var(--color-text-secondary);
  }
  .replay-status-summary__guidance {
    margin: 0 0 var(--space-md);
    font-weight: 500;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-sm) var(--space-md);
    margin: 0;
  }
  dt {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  dd {
    margin: var(--space-xs) 0 0;
    overflow-wrap: anywhere;
  }
  .replay-status-summary__code {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
  }
  .replay-status-summary__counts {
    grid-column: 1 / -1;
  }
</style>
