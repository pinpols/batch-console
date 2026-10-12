<template>
  <SectionCard class="pipeline-focus">
    <template #header>
      <div class="pipeline-focus__header">
        <span>{{ t('filePipelineObservability.selectedRun', { id: pipeline.id }) }}</span>
        <StatusTag :value="String(pipeline.runStatus ?? '')" category="workflow" />
      </div>
    </template>
    <div class="pipeline-focus__links">
      <span>{{ pipeline.jobCode }}</span>
      <router-link
        v-if="pipeline.fileId"
        class="cell-link"
        :to="`/files/list?fileId=${pipeline.fileId}`"
      >
        {{ t('filePipelineObservability.relatedFile', { id: pipeline.fileId }) }}
      </router-link>
      <router-link
        v-if="pipeline.relatedJobInstanceId"
        class="cell-link"
        :to="`/monitor/job-instances/${pipeline.relatedJobInstanceId}`"
      >
        {{ t('filePipelineObservability.relatedInstance', { id: pipeline.relatedJobInstanceId }) }}
      </router-link>
      <router-link
        v-if="pipeline.traceId"
        class="cell-link"
        :to="`/observability/trace?traceId=${pipeline.traceId}`"
      >
        {{ t('filePipelineObservability.relatedTrace') }}
      </router-link>
    </div>
    <el-alert
      v-if="loadError"
      class="pipeline-stage-error"
      type="error"
      show-icon
      :closable="false"
      :title="t('filePipelineObservability.stageLoadError')"
    >
      <template #default>
        <el-button link type="primary" @click="emit('retry')">
          {{ t('common.retry') }}
        </el-button>
      </template>
    </el-alert>
    <div
      v-else
      v-loading="loading"
      class="pipeline-stages"
      :aria-label="t('filePipelineObservability.stageOverview')"
    >
      <button
        v-for="stage in stages"
        :key="stage.code"
        type="button"
        class="pipeline-stage"
        :class="[
          `pipeline-stage--${stage.tone}`,
          { 'pipeline-stage--selected': selectedCode === stage.code },
        ]"
        :aria-pressed="selectedCode === stage.code"
        @click="emit('stageClick', stage.code)"
      >
        <span class="pipeline-stage__index">{{ stage.index }}</span>
        <span class="pipeline-stage__body">
          <strong>{{ stage.label }}</strong>
          <span class="pipeline-stage__status">{{ stage.status }}</span>
          <span v-if="stage.error" class="pipeline-stage__error" :title="stage.error">
            {{ stage.error }}
          </span>
        </span>
      </button>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { ConsoleFilePipelineResponse } from '@/types/console-api'

  defineProps<{
    pipeline: ConsoleFilePipelineResponse
    stages: Array<{
      code: string
      index: number
      label: string
      status: string
      error: string
      tone: 'success' | 'danger' | 'active' | 'pending'
    }>
    selectedCode: string | null
    loading: boolean
    loadError: boolean
  }>()

  const emit = defineEmits<{
    stageClick: [code: string]
    retry: []
  }>()
  const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
  .pipeline-focus__header,
  .pipeline-focus__links {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .pipeline-focus__links {
    margin-bottom: var(--space-md);
    color: var(--color-text-secondary);
  }

  .pipeline-stages {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-sm);
  }

  .pipeline-stage {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
    width: 100%;
    padding: var(--space-sm) var(--space-xs);
    border: 0;
    border-bottom: 1px solid var(--color-border-light);
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    text-align: left;
  }

  .pipeline-stage:last-child {
    border-bottom: 0;
  }

  .pipeline-stage:hover {
    background: var(--color-bg-subtle);
  }

  .pipeline-stage--selected,
  .pipeline-stage:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .pipeline-stage__index {
    display: inline-grid;
    place-items: center;
    width: var(--space-xl);
    height: var(--space-xl);
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
  }

  .pipeline-stage__body {
    display: grid;
    min-width: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .pipeline-stage__body strong {
    color: var(--color-text-primary);
  }

  .pipeline-stage__error {
    display: -webkit-box;
    overflow: hidden;
    color: var(--color-danger);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .pipeline-stage--success .pipeline-stage__index,
  .pipeline-stage--success .pipeline-stage__status {
    color: var(--color-success);
  }

  .pipeline-stage--success .pipeline-stage__index {
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
  }

  .pipeline-stage--active .pipeline-stage__index,
  .pipeline-stage--active .pipeline-stage__status {
    color: var(--color-primary);
  }

  .pipeline-stage--active .pipeline-stage__index {
    background: var(--color-bg-info);
  }

  .pipeline-stage--danger .pipeline-stage__index,
  .pipeline-stage--danger .pipeline-stage__status {
    color: var(--color-danger);
  }

  .pipeline-stage--danger .pipeline-stage__index {
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  }

  .pipeline-stage--pending .pipeline-stage__status {
    color: var(--color-text-secondary);
  }
</style>
