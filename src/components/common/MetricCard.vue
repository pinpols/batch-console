<template>
  <el-card
    class="metric-card"
    :class="[toneClass, { 'metric-card--clickable': clickable, 'metric-card--active': active }]"
    shadow="never"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="clickable && emit('click')"
    @keydown.enter.prevent="clickable && emit('click')"
    @keydown.space.prevent="clickable && emit('click')"
  >
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
      /** 点击联动:true 时卡片变可点击,激活态可控 */
      clickable?: boolean
      /** 当前是否为「激活」筛选项,边框 + 左侧色条加重 */
      active?: boolean
    }>(),
    { tone: 'neutral', clickable: false, active: false },
  )

  const emit = defineEmits<{ click: [] }>()

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

  .metric-card--clickable {
    cursor: pointer;
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease;
  }

  .metric-card--clickable:hover {
    border-color: color-mix(in srgb, var(--metric-tone) 60%, var(--color-border-light));
    box-shadow: 0 4px 14px color-mix(in srgb, var(--metric-tone) 12%, transparent);
  }

  .metric-card--clickable::before {
    opacity: 0.3;
  }

  .metric-card--clickable:hover::before {
    opacity: 1;
  }

  .metric-card--clickable.metric-card--active {
    border-color: var(--metric-tone);
    background: color-mix(in srgb, var(--metric-tone) 6%, var(--color-bg-card));
  }

  .metric-card--clickable.metric-card--active::before {
    opacity: 1;
    width: 4px;
  }

  .metric-card--clickable:focus-visible {
    outline: 2px solid var(--metric-tone);
    outline-offset: 2px;
  }
</style>
