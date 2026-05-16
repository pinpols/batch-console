<template>
  <el-card class="metric-card" :class="toneClass" shadow="never">
    <div class="metric-card__label">{{ label }}</div>
    <div class="metric-card__value" :class="{ 'metric-card__value--long': isLong }">
      {{ value }}
    </div>
    <div v-if="description" class="metric-card__description">{{ description }}</div>
  </el-card>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  export type MetricTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

  const props = withDefaults(
    defineProps<{
      label: string
      value: string | number
      description?: string
      tone?: MetricTone
    }>(),
    { tone: 'neutral' },
  )

  const isLong = computed(() => typeof props.value === 'string' && props.value.length >= 14)

  const isZero = computed(() => {
    const v = props.value
    if (typeof v === 'number') return v === 0
    return v === '0' || v === '' || v == null
  })

  const toneClass = computed(() => {
    const tone = isZero.value ? 'neutral' : props.tone
    return `metric-card--${tone}`
  })
</script>

<style scoped>
  .metric-card {
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    overflow: hidden;
    position: relative;
    --metric-tone: var(--color-text-primary);
  }

  .metric-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--metric-tone);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .metric-card--neutral {
    --metric-tone: var(--color-text-secondary);
  }
  .metric-card--info {
    --metric-tone: var(--el-color-primary);
  }
  .metric-card--success {
    --metric-tone: var(--el-color-success);
  }
  .metric-card--warning {
    --metric-tone: var(--el-color-warning);
  }
  .metric-card--danger {
    --metric-tone: var(--el-color-danger);
  }

  .metric-card:not(.metric-card--neutral)::before {
    opacity: 1;
  }

  .metric-card:not(.metric-card--neutral) .metric-card__value {
    color: var(--metric-tone);
  }

  .metric-card__label {
    margin-bottom: 10px;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .metric-card__value {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    line-height: var(--line-height-tight);
    letter-spacing: -0.02em;
  }

  .metric-card__value--long {
    font-size: 18px;
    line-height: 1.2;
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    word-break: break-word;
  }

  .metric-card__description {
    margin-top: 8px;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
  }
</style>
