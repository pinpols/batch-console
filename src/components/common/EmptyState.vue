<template>
  <div class="empty-state">
    <div v-if="title" class="title">{{ title }}</div>
    <el-empty :description="description">
    </el-empty>
    <div v-if="$slots.action" class="action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    title?: string
    description: string
  }>()
</script>

<style scoped>
  .empty-state {
    padding: 8px 0;
  }

  .title {
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .action {
    margin-top: 12px;
    display: flex;
    justify-content: center;
  }
</style>
