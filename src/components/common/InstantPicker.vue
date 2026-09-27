<template>
  <el-date-picker
    :model-value="pickerValue"
    type="datetime"
    value-format="YYYY-MM-DD HH:mm:ss"
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
  const props = defineProps<{ modelValue: string | null | undefined }>()
  const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

  const pickerValue = computed(() =>
    props.modelValue ? apiInstantToWallTime(props.modelValue, displayTimezone.value) : null,
  )

  function onChange(value: unknown) {
    if (!value) {
      emit('update:modelValue', '')
      return
    }
    const instant = wallTimeToApiInstant(String(value), displayTimezone.value)
    if (!instant) {
      ElMessage.error(t('dateRangePicker.invalidLocalTime'))
      return
    }
    emit('update:modelValue', instant)
  }
</script>
