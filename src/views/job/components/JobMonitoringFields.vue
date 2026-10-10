<template>
  <div class="policy-fields">
    <el-alert :title="t('jobMonitoringPolicy.alertOnlyHint')" type="info" :closable="false" />

    <section class="policy-rule">
      <div class="policy-rule__title">{{ t('jobMonitoringPolicy.softRuntime') }}</div>
      <div class="policy-rule__controls">
        <el-form-item :label="t('jobMonitoringPolicy.thresholdSeconds')">
          <el-input-number v-model="softRuntimeSeconds" :min="0" :max="2147483647" />
        </el-form-item>
        <el-form-item :label="t('jobMonitoringPolicy.severity')">
          <el-select v-model="softRuntimeSeverity">
            <el-option v-for="item in severities" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </div>
      <div class="policy-rule__hint">{{ t('jobMonitoringPolicy.softRuntimeHint') }}</div>
    </section>

    <template v-if="supportsStartDeadline">
      <section class="policy-rule">
        <div class="policy-rule__title">{{ t('jobMonitoringPolicy.startGrace') }}</div>
        <div class="policy-rule__controls">
          <el-form-item :label="t('jobMonitoringPolicy.thresholdSeconds')">
            <el-input-number v-model="startGraceSeconds" :min="0" :max="2147483647" />
          </el-form-item>
          <el-form-item :label="t('jobMonitoringPolicy.severity')">
            <el-select v-model="startGraceSeverity">
              <el-option v-for="item in severities" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </div>
        <div class="policy-rule__hint">
          {{ t('jobMonitoringPolicy.startGraceHint', { timezone: timezone || 'UTC' }) }}
        </div>
      </section>

      <section v-if="isDependent" class="policy-rule">
        <div class="policy-rule__title">{{ t('jobMonitoringPolicy.completionDeadline') }}</div>
        <div class="policy-rule__controls">
          <el-form-item :label="t('jobMonitoringPolicy.thresholdSeconds')">
            <el-input-number
              v-model="dependencyCompletionWindowSeconds"
              :min="0"
              :max="2147483647"
            />
          </el-form-item>
          <el-form-item :label="t('jobMonitoringPolicy.severity')">
            <el-select v-model="completionDeadlineSeverity">
              <el-option v-for="item in severities" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </div>
        <div class="policy-rule__hint">
          {{ t('jobMonitoringPolicy.dependencyCompletionHint') }}
        </div>
      </section>

      <section v-if="isCron && !isDependent" class="policy-rule">
        <div class="policy-rule__title">{{ t('jobMonitoringPolicy.completionDeadline') }}</div>
        <div class="policy-rule__controls policy-rule__controls--deadline">
          <div class="deadline-group">
            <el-form-item :label="t('jobMonitoringPolicy.deadlineTime')">
              <el-time-picker
                v-model="completionDeadlineLocalTime"
                format="HH:mm"
                value-format="HH:mm"
                :clearable="true"
                :placeholder="t('jobMonitoringPolicy.deadlineTimePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('jobMonitoringPolicy.deadlineDay')">
              <el-select
                v-model="completionDeadlineDayOffset"
                :disabled="!completionDeadlineLocalTime"
              >
                <el-option :label="t('jobMonitoringPolicy.sameDay')" :value="0" />
                <el-option :label="t('jobMonitoringPolicy.nextDay')" :value="1" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item :label="t('jobMonitoringPolicy.severity')">
            <el-select v-model="completionDeadlineSeverity">
              <el-option v-for="item in severities" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </div>
        <div class="policy-rule__hint">
          {{ t('jobMonitoringPolicy.completionDeadlineHint', { timezone: timezone || 'UTC' }) }}
        </div>
      </section>
    </template>
    <el-alert
      v-else
      :title="t('jobMonitoringPolicy.manualScheduleHint')"
      type="info"
      :closable="false"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  const props = defineProps<{
    scheduleType: string
    dependsOnJobCode?: string | null
    timezone?: string | null
  }>()
  const softRuntimeSeconds = defineModel<number>('softRuntimeSeconds', { required: true })
  const softRuntimeSeverity = defineModel<'WARN' | 'ERROR' | 'CRITICAL'>('softRuntimeSeverity', {
    required: true,
  })
  const startGraceSeconds = defineModel<number>('startGraceSeconds', { required: true })
  const startGraceSeverity = defineModel<'WARN' | 'ERROR' | 'CRITICAL'>('startGraceSeverity', {
    required: true,
  })
  const completionDeadlineLocalTime = defineModel<string | null>('completionDeadlineLocalTime', {
    required: true,
  })
  const dependencyCompletionWindowSeconds = defineModel<number>(
    'dependencyCompletionWindowSeconds',
    { required: true },
  )
  const completionDeadlineDayOffset = defineModel<number>('completionDeadlineDayOffset', {
    required: true,
  })
  const completionDeadlineSeverity = defineModel<'WARN' | 'ERROR' | 'CRITICAL'>(
    'completionDeadlineSeverity',
    { required: true },
  )
  const { t } = useI18n()
  const severities = ['WARN', 'ERROR', 'CRITICAL'] as const
  const isDependent = computed(() => Boolean(props.dependsOnJobCode?.trim()))
  const supportsStartDeadline = computed(() => props.scheduleType === 'CRON' || isDependent.value)
  const isCron = computed(() => props.scheduleType === 'CRON')
</script>

<style scoped>
  .policy-fields {
    display: grid;
    gap: var(--page-block-gap);
  }

  .policy-rule {
    display: grid;
    gap: 6px;
    padding-block: 10px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .policy-rule__title {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .policy-rule__controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }

  .policy-rule__controls--deadline {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .deadline-group {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    min-width: 0;
  }

  .policy-rule__controls :deep(.el-form-item) {
    margin-bottom: 0;
  }

  .policy-rule__controls :deep(.el-input-number),
  .policy-rule__controls :deep(.el-date-editor.el-input),
  .policy-rule__controls :deep(.el-select) {
    width: 100% !important;
  }

  @media (max-width: 640px) {
    .policy-rule__controls--deadline {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .policy-rule__hint {
    color: var(--el-text-color-secondary);
    font-size: var(--el-font-size-small);
  }
</style>
