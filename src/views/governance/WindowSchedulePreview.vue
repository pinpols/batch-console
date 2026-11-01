<template>
  <div class="window-preview">
    <template v-if="windowSchedule.mode !== 'incomplete'">
      <div class="window-preview__track" role="img" :aria-label="windowPreviewText">
        <span
          v-for="(segment, index) in windowSchedule.segments"
          :key="index"
          class="window-preview__segment"
          :style="{
            left: `${segment.start * 100}%`,
            width: `${(segment.end - segment.start) * 100}%`,
          }"
        />
      </div>
      <div class="window-preview__axis" aria-hidden="true">
        <span>00:00</span><span>12:00</span><span>24:00</span>
      </div>
      <p>{{ windowPreviewText }}</p>
      <p>{{ t('queueConfig.windowPreviewZoneFallback') }}</p>
      <p v-if="windowSchedule.fullDueCrossDay" class="window-preview__warning">
        {{ t('queueConfig.windowPreviewFullCross') }}
      </p>
      <p v-if="windowSchedule.rangeInvalid" class="window-preview__warning">
        {{ t('queueConfig.windowPreviewRangeInvalid') }}
      </p>
    </template>
    <p v-else>{{ t('queueConfig.windowPreviewIncomplete') }}</p>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { windowPreview } from './windowPreview'

  const props = defineProps<{
    startTime: string
    endTime: string
    timezone: string
    allowCrossDay: boolean
  }>()
  const { t } = useI18n({ useScope: 'global' })
  const windowSchedule = computed(() =>
    windowPreview(props.startTime, props.endTime, props.allowCrossDay),
  )
  const windowPreviewText = computed(() => {
    const values = {
      start: props.startTime,
      end: props.endTime,
      timezone: props.timezone,
    }
    if (windowSchedule.value.mode === 'full-day')
      return t('queueConfig.windowPreviewFullDay', values)
    if (windowSchedule.value.mode === 'overnight')
      return t('queueConfig.windowPreviewOvernight', values)
    return t('queueConfig.windowPreviewSameDay', values)
  })
</script>

<style scoped>
  .window-preview {
    width: 100%;
    line-height: 1.5;
  }
  .window-preview__track {
    position: relative;
    height: 12px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
  }
  .window-preview__segment {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--color-primary);
  }
  .window-preview__axis {
    display: flex;
    justify-content: space-between;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .window-preview p {
    margin: var(--space-xs) 0 0;
  }
  .window-preview__warning {
    color: var(--color-warning);
  }
</style>
