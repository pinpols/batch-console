<template>
  <div v-if="supportsStartDeadline" class="scheduled-policy">
    <div class="scheduled-policy__row">
      <span class="scheduled-policy__label">
        <CalendarClock :size="14" aria-hidden="true" />
        {{ t('jobMonitoringPolicy.startGrace') }}
      </span>
      <PolicyValue :seconds="job.startGraceSeconds" :severity="job.startGraceSeverity" />
    </div>
    <div class="scheduled-policy__row">
      <span class="scheduled-policy__label">
        <Clock3 :size="14" aria-hidden="true" />
        {{ t('jobMonitoringPolicy.completionDeadline') }}
      </span>
      <PolicyValue
        v-if="isDependent"
        :seconds="job.dependencyCompletionWindowSeconds"
        :severity="job.completionDeadlineSeverity"
      />
      <span v-else-if="isCron && deadlineLabel" class="scheduled-policy__deadline">
        {{ deadlineLabel }}
        <el-tag effect="plain" size="small" :type="severityType">
          {{ job.completionDeadlineSeverity ?? 'WARN' }}
        </el-tag>
      </span>
      <span v-else class="scheduled-policy__disabled">
        {{ t('jobMonitoringPolicy.disabled') }}
      </span>
    </div>
  </div>
  <span v-else class="scheduled-policy__manual">
    {{ t('jobMonitoringPolicy.manualScheduleHintShort') }}
  </span>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { CalendarClock, Clock3 } from '@lucide/vue'
  import type { ConsoleJobDefinitionResponse } from '@/types/console-api'
  import PolicyValue from './JobMonitoringPolicyValue.vue'

  const props = defineProps<{ job: ConsoleJobDefinitionResponse }>()
  const { t } = useI18n({ useScope: 'global' })

  const isDependent = computed(() => Boolean(props.job.dependsOnJobCode?.trim()))
  const supportsStartDeadline = computed(
    () => props.job.scheduleType === 'CRON' || isDependent.value,
  )
  const isCron = computed(() => props.job.scheduleType === 'CRON' && !isDependent.value)
  const deadlineLabel = computed(() => {
    if (!isCron.value || !props.job.completionDeadlineLocalTime) return ''
    const localTime = props.job.completionDeadlineLocalTime.slice(0, 5)
    const dayLabel =
      props.job.completionDeadlineDayOffset === 1
        ? t('jobMonitoringPolicy.nextDay')
        : t('jobMonitoringPolicy.sameDay')
    return `${dayLabel} ${localTime}`
  })
  const severityType = computed(() => {
    switch (props.job.completionDeadlineSeverity) {
      case 'CRITICAL':
        return 'danger'
      case 'ERROR':
        return 'warning'
      default:
        return 'info'
    }
  })
</script>

<style scoped>
  .scheduled-policy {
    display: grid;
    gap: 7px;
    min-width: 0;
  }

  .scheduled-policy__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
  }

  .scheduled-policy__label {
    display: inline-flex;
    flex: 0 0 82px;
    align-items: center;
    gap: 5px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .scheduled-policy__label :deep(svg) {
    flex: 0 0 auto;
  }

  .scheduled-policy__deadline {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .scheduled-policy__disabled,
  .scheduled-policy__manual {
    color: var(--el-text-color-secondary);
  }
</style>
