<template>
  <el-card class="metric-card" shadow="never">
    <div class="metric-card__label">{{ label }}</div>
    <div class="metric-card__value" :class="{ 'metric-card__value--long': isLong }">
      {{ value }}
    </div>
    <div v-if="description" class="metric-card__description">{{ description }}</div>
  </el-card>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    label: string
    value: string | number
    description?: string
  }>()

  const isLong = computed(() => typeof props.value === 'string' && props.value.length >= 14)
</script>

<style scoped>
  .metric-card {
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    overflow: hidden;
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
