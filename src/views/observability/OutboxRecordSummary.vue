<template>
  <div class="outbox-record-summary">
    <p>{{ t('observability.outboxRecordHint') }}</p>
    <el-descriptions :column="1" border size="small">
      <el-descriptions-item :label="t('observability.outboxRecordId')">{{
        row.id ?? '—'
      }}</el-descriptions-item>
      <el-descriptions-item v-if="retry" :label="t('observability.outboxEventId')">{{
        retry.outboxEventId ?? '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('observability.outboxColEventType')">{{
        row.eventType || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('observability.outboxColKey')">{{
        row.eventKey || '—'
      }}</el-descriptions-item>
      <el-descriptions-item :label="t('observability.outboxColStatus')">
        <StatusTag v-if="status" :value="status" category="outboxPublishStatus" />
        <span v-else>—</span>
      </el-descriptions-item>
      <template v-if="retry">
        <el-descriptions-item :label="t('observability.outboxColCount')">{{
          retry.retryCount ?? '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('observability.outboxColPolicy')">{{
          retry.retryPolicy || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('observability.outboxColNextRetry')"
          ><DatetimeText :value="retry.nextRetryAt"
        /></el-descriptions-item>
      </template>
      <template v-if="delivery">
        <el-descriptions-item :label="t('observability.outboxColTopic')">{{
          delivery.targetTopic || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('observability.outboxColAttempt')">{{
          delivery.deliveryAttempt ?? '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('observability.outboxColError')"
          ><span class="outbox-record-summary__error">{{
            delivery.errorMessage || '—'
          }}</span></el-descriptions-item
        >
        <el-descriptions-item :label="t('observability.outboxTrace')">{{
          delivery.traceId || '—'
        }}</el-descriptions-item>
      </template>
      <el-descriptions-item :label="t('common.createdAt')"
        ><DatetimeText :value="row.createdAt"
      /></el-descriptions-item>
      <el-descriptions-item :label="t('observability.outboxColUpdated')"
        ><DatetimeText :value="row.updatedAt"
      /></el-descriptions-item>
    </el-descriptions>
  </div>
</template>
<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type {
    ConsoleOutboxDeliveryLogResponse,
    ConsoleOutboxRetryLogResponse,
  } from '@/types/console-api'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DatetimeText from '@/components/common/DatetimeText.vue'
  const props = defineProps<{
    kind: 'retry' | 'delivery'
    row: ConsoleOutboxRetryLogResponse | ConsoleOutboxDeliveryLogResponse
  }>()
  const { t } = useI18n()
  const retry = computed(() =>
    props.kind === 'retry' ? (props.row as ConsoleOutboxRetryLogResponse) : null,
  )
  const delivery = computed(() =>
    props.kind === 'delivery' ? (props.row as ConsoleOutboxDeliveryLogResponse) : null,
  )
  const status = computed(() => retry.value?.retryStatus || delivery.value?.deliveryStatus || '')
</script>
<style scoped>
  .outbox-record-summary p {
    color: var(--color-text-secondary);
    margin-top: 0;
  }
  .outbox-record-summary__error {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
