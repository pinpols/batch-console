<template>
  <el-form-item :label="t('jobConfigBasic.fieldTriggerMode')" prop="triggerMode">
    <MetaSelect
      class="query-w-full"
      :model-value="modelValue"
      enum-key="triggerMode"
      :placeholder="t('jobConfigBasic.placeholderTriggerMode')"
      @update:model-value="onUpdateModelValue"
    />
  </el-form-item>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  defineProps<{ modelValue: string }>()
  const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
  const { t } = useI18n()

  function onUpdateModelValue(value: unknown) {
    if (typeof value === 'string') emit('update:modelValue', value)
  }
</script>
