<template>
  <section class="page-header app-surface">
    <div>
      <h1 class="title">{{ title }}</h1>
      <p v-if="description" class="description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<script setup lang="ts">
  defineProps<{
    title: string
    description?: string
  }>()
</script>

<style scoped>
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    padding: 20px 24px;
    background: var(--color-bg-hero);
  }

  .title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    line-height: 1.4;
  }

  .description {
    margin: 8px 0 0;
    color: var(--color-text-secondary);
    font-size: 13px;
    line-height: 1.6;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }
</style>
