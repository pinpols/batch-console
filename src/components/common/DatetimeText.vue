<template>
  <time :datetime="machineValue">{{ displayValue }}</time>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { displayTimezone } from '@/constants/timezone'
  import { fmtCompact, fmtDate, fmtDatetime, fmtRelative } from '@/utils/datetime'

  const props = withDefaults(
    defineProps<{
      value?: unknown
      mode?: 'datetime' | 'date' | 'compact' | 'relative'
      timezone?: string
    }>(),
    { mode: 'datetime' },
  )

  const zone = computed(() => props.timezone ?? displayTimezone.value)
  const displayValue = computed(() => {
    if (props.mode === 'date') return fmtDate(props.value, zone.value)
    if (props.mode === 'compact') return fmtCompact(props.value, zone.value)
    if (props.mode === 'relative') return fmtRelative(props.value, zone.value)
    return fmtDatetime(props.value, zone.value)
  })
  const machineValue = computed(() => {
    if (props.value === null || props.value === undefined || props.value === '') return undefined
    const value = String(props.value)
    if (props.mode === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const date = typeof props.value === 'number' ? new Date(props.value) : new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  })
</script>

<style scoped>
  time {
    font-variant-numeric: tabular-nums;
  }
</style>
