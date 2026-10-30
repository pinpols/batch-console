<template>
  <template v-if="stages.length">
    <div class="system-pipeline-summary">
      <el-tag size="small" effect="plain">{{ code }}</el-tag>
      <span>{{ t('jobDefinitionList.systemPipelineReadonly') }}</span>
    </div>
    <div class="system-pipeline-stages" aria-label="System Pipeline stages">
      <template v-for="(stage, index) in stages" :key="stage">
        <el-tag size="small" effect="plain">{{ stage }}</el-tag>
        <span v-if="index < stages.length - 1" class="system-pipeline-arrow">→</span>
      </template>
    </div>
  </template>
  <div v-else class="system-pipeline-empty">
    {{ t('jobDefinitionList.systemPipelineNotApplicable') }}
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  defineProps<{
    code: string
    stages: string[]
  }>()

  const { t } = useI18n()
</script>

<style scoped>
  .system-pipeline-summary,
  .system-pipeline-stages {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .system-pipeline-summary {
    margin-bottom: 10px;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .system-pipeline-arrow {
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .system-pipeline-empty {
    margin-top: 5px;
    font-size: 13px;
    color: var(--color-text-primary);
  }
</style>
