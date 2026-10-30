<template>
  <div class="policy-value">
    <span>{{ valueLabel }}</span>
    <el-tag v-if="(seconds ?? 0) > 0" :type="severityType" effect="plain" size="small">
      {{ severity }}
    </el-tag>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  const props = defineProps<{
    seconds: number | null | undefined
    severity: string | null | undefined
  }>()

  const { t, n } = useI18n({ useScope: 'global' })
  const valueLabel = computed(() => {
    if (props.seconds == null || props.seconds <= 0) {
      return t('jobMonitoringPolicy.disabled')
    }
    if (props.seconds % 60 === 0) {
      const minutes = props.seconds / 60
      const formattedMinutes = n(minutes)
      return t('jobMonitoringPolicy.minutesValue', { minutes: formattedMinutes })
    }
    const formattedSeconds = n(props.seconds)
    return t('jobMonitoringPolicy.secondsValue', { seconds: formattedSeconds })
  })
  const severityType = computed(() => {
    switch (props.severity) {
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
  .policy-value {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
</style>
