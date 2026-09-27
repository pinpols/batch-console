<template>
  <el-date-picker
    :model-value="pickerValue"
    type="datetimerange"
    value-format="YYYY-MM-DD HH:mm:ss"
    :range-separator="rangeSeparator"
    :start-placeholder="startPlaceholder"
    :end-placeholder="endPlaceholder"
    @update:model-value="onChange"
  />
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { ElMessage } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { displayTimezone } from '@/constants/timezone'
  import { apiInstantToWallTime, wallTimeToApiInstant } from '@/utils/datetime'

  const { t } = useI18n({ useScope: 'global' })
  const props = defineProps<{
    modelValue: [string, string] | null | undefined
    rangeSeparator?: string
    startPlaceholder?: string
    endPlaceholder?: string
  }>()
  const emit = defineEmits<{ (e: 'update:modelValue', value: [string, string] | null): void }>()

  const pickerValue = computed(() => {
    if (!props.modelValue) return null
    return [
      apiInstantToWallTime(props.modelValue[0], displayTimezone.value),
      apiInstantToWallTime(props.modelValue[1], displayTimezone.value),
    ] as [string, string]
  })

  function onChange(value: unknown) {
    if (!Array.isArray(value) || value.length < 2) {
      emit('update:modelValue', null)
      return
    }
    const start = wallTimeToApiInstant(String(value[0]), displayTimezone.value)
    const end = wallTimeToApiInstant(String(value[1]), displayTimezone.value)
    if (!start || !end) {
      ElMessage.error(t('dateRangePicker.invalidLocalTime'))
      return
    }
    emit('update:modelValue', [start, end])
  }
</script>
