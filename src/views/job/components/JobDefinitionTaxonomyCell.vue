<template>
  <span :class="props.muted ? 'jd-cell-sub' : 'jd-cell-mono'">{{ displayValue }}</span>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  const props = defineProps<{
    value?: string | null
    muted?: boolean
    enumGroup?: 'scheduleType' | 'triggerMode'
  }>()
  const { t, te } = useI18n()
  const displayValue = computed(() => {
    const key = `enum.${props.enumGroup ?? 'triggerMode'}.${props.value}`
    return props.value && te(key) ? t(key) : props.value || '—'
  })
</script>
