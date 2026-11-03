<template>
  <section
    v-if="timeline.bars.length"
    class="step-strip"
    :aria-label="t('jobInstanceDetail.stepStripTitle')"
  >
    <header class="step-strip__head">
      <h3>{{ t('jobInstanceDetail.stepStripTitle') }}</h3>
      <span>
        {{ t('jobInstanceDetail.stepStripSpan', { duration: fmtDuration(timeline.spanMs) }) }}
        <template v-if="timeline.notStarted">
          · {{ t('jobInstanceDetail.stepStripNotStarted', { n: timeline.notStarted }) }}
        </template>
      </span>
    </header>
    <ol class="step-strip__rows">
      <li v-for="bar in timeline.bars" :key="bar.id" class="step-strip__row">
        <span class="step-strip__code" :title="bar.stepCode">{{ bar.stepCode }}</span>
        <span class="step-strip__track">
          <span
            class="step-strip__bar"
            :class="[`tone-${bar.tone}`, { 'is-open': bar.open }]"
            :style="{ left: `${bar.left}%`, width: `${bar.width}%` }"
            :title="barLabel(bar)"
          />
        </span>
        <span class="step-strip__duration">{{ fmtDuration(bar.durationMs) }}</span>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { fmtDuration } from '@/utils/datetime'
  import { buildStepTimeline, type StepTimelineBar, type StepTimelineInput } from '../stepTimeline'

  /**
   * 步骤耗时条：所有步骤共用一条时间轴，补足下方逐条时间线看不出“耗时集中在哪一步”的问题。
   * 色调与首页业务日时刻轨道同源。
   */
  const props = defineProps<{ steps: readonly StepTimelineInput[]; nowMs: number }>()
  const { t } = useI18n({ useScope: 'global' })

  const timeline = computed(() => buildStepTimeline(props.steps, props.nowMs))

  function barLabel(bar: StepTimelineBar): string {
    return `${bar.stepCode} · ${bar.status} · ${fmtDuration(bar.durationMs)}`
  }
</script>

<style scoped>
  .step-strip {
    margin-bottom: 16px;
    padding: 14px 16px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
  }

  .step-strip__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
    margin-bottom: 10px;
  }

  .step-strip__head h3 {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .step-strip__head span {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .step-strip__rows {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .step-strip__row {
    display: grid;
    grid-template-columns: minmax(96px, 180px) minmax(0, 1fr) 72px;
    align-items: center;
    gap: 12px;
  }

  .step-strip__code {
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .step-strip__track {
    position: relative;
    height: 10px;
    border-radius: 999px;
    background: var(--color-bg-canvas);
  }

  .step-strip__bar {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 999px;
  }

  /* 未结束的步骤右端做渐隐，表示仍在进行 */
  .step-strip__bar.is-open {
    mask-image: linear-gradient(to right, #000 80%, transparent);
  }

  .step-strip__duration {
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .tone-success {
    background: var(--color-success);
  }

  .tone-danger {
    background: var(--color-danger);
  }

  .tone-running {
    background: var(--color-primary);
  }

  .tone-warning {
    background: var(--color-warning);
  }

  .tone-idle {
    background: var(--color-text-tertiary);
    opacity: 0.6;
  }

  @media (max-width: 640px) {
    .step-strip__row {
      grid-template-columns: minmax(72px, 110px) minmax(0, 1fr) 56px;
      gap: 8px;
    }
  }
</style>
