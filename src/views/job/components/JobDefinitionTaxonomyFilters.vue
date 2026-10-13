<template>
  <el-form-item>
    <template #label>
      <HelpLabel :tip="t('jobDefinitionList.triggerModeTip')">
        {{ t('jobDefinitionList.triggerModeLabel') }}
      </HelpLabel>
    </template>
    <MetaSelect
      class="query-w-160"
      :model-value="triggerMode"
      clearable
      enum-key="triggerMode"
      :placeholder="t('jobDefinitionList.triggerModePlaceholder')"
      :options="triggerModeOptions"
      @update:model-value="emit('update:triggerMode', $event)"
    />
  </el-form-item>
  <el-form-item>
    <template #label>
      <HelpLabel :tip="t('jobDefinitionList.dependencyTip')">
        {{ t('jobDefinitionList.dependencyLabel') }}
      </HelpLabel>
    </template>
    <el-select
      :model-value="dependency"
      clearable
      class="query-w-160"
      :placeholder="t('common.all')"
      @update:model-value="emit('update:dependency', $event)"
    >
      <el-option
        v-for="option in dependencyOptions"
        :key="option.value"
        :label="option.label"
        :value="option.value"
      />
    </el-select>
  </el-form-item>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { MetaOption } from '@/api/meta'

  defineProps<{
    triggerMode: string
    dependency: string
    triggerModeOptions: MetaOption[]
  }>()

  const emit = defineEmits<{
    'update:triggerMode': [value: string]
    'update:dependency': [value: string]
  }>()
  const { t } = useI18n()
  const dependencyOptions = computed<MetaOption[]>(() => [
    { value: 'HAS_DEPENDENCY', label: t('jobDefinitionList.hasDependency') },
    { value: 'NO_DEPENDENCY', label: t('jobDefinitionList.noDependency') },
  ])
</script>
