<template>
  <div class="auto-dismiss-actions">
    <slot />
    <span class="auto-dismiss-actions__countdown">{{ countdownText }}</span>
    <el-button
      text
      circle
      :icon="X"
      :aria-label="closeLabel"
      :title="closeLabel"
      class="auto-dismiss-actions__close"
      @click="emit('dismiss')"
    />
  </div>
</template>

<script setup lang="ts">
  import { X } from '@lucide/vue'

  defineProps<{
    countdownText: string
    closeLabel: string
  }>()

  const emit = defineEmits<{ dismiss: [] }>()
</script>

<style scoped>
  .auto-dismiss-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    flex: none;
    margin-left: auto;
  }

  .auto-dismiss-actions__countdown {
    color: var(--color-text-tertiary);
    font-size: 11px;
    white-space: nowrap;
  }

  .auto-dismiss-actions__close {
    color: var(--color-text-tertiary);
  }

  .auto-dismiss-actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  @media (max-width: 720px) {
    .auto-dismiss-actions {
      width: 100%;
    }
  }
</style>
