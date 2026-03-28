<template>
  <el-card class="metric-card" shadow="never">
    <div class="metric-card__label">{{ label }}</div>
    <div class="metric-card__value">{{ value }}</div>
    <div v-if="description" class="metric-card__description">{{ description }}</div>
  </el-card>
</template>

<script setup lang="ts">
  defineProps<{
    label: string
    value: string | number
    description?: string
  }>()
</script>

<style scoped>
  .metric-card {
    border: 1px solid var(--color-border-light);
  }

  .metric-card__label {
    margin-bottom: 10px;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .metric-card__value {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.1;
  }

  .metric-card__description {
    margin-top: 8px;
    color: var(--color-text-tertiary);
    font-size: 12px;
  }
</style>
