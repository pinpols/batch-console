<template>
  <StatusSegment
    :model-value="value"
    :items="items"
    :aria-label="ariaLabel"
    @update:model-value="onChange"
  />
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import StatusSegment from './StatusSegment.vue'

  const props = defineProps<{
    modelValue: boolean | undefined
    ariaLabel: string
  }>()
  const emit = defineEmits<{
    'update:modelValue': [value: boolean | undefined]
  }>()

  const { t } = useI18n({ useScope: 'global' })
  const value = computed(() =>
    props.modelValue === true ? 'ENABLED' : props.modelValue === false ? 'DISABLED' : 'ALL',
  )
  const items = computed(() => [
    { value: 'ALL', label: t('dateRangePicker.all'), accent: 'var(--color-primary)' },
    { value: 'ENABLED', label: t('common.enabled'), accent: 'var(--color-success)' },
    { value: 'DISABLED', label: t('common.disabled'), accent: 'var(--color-text-tertiary)' },
  ])

  function onChange(next: string) {
    emit('update:modelValue', next === 'ENABLED' ? true : next === 'DISABLED' ? false : undefined)
  }
</script>
