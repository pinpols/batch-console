<template>
  <div class="ops-toolbar">
    <div class="ops-toolbar__main">
      <slot />
    </div>
    <LiveStatusBadge
      class="ops-toolbar__live"
      :status="status"
      :last-refreshed-at="lastRefreshedAt"
    />
  </div>
</template>

<script setup lang="ts">
  import LiveStatusBadge from '@/components/common/LiveStatusBadge.vue'
  import type { SseConnectionStatus } from '@/composables/useSseAutoReload'

  defineProps<{
    status: SseConnectionStatus
    lastRefreshedAt?: number | null
  }>()
</script>

<style scoped>
  .ops-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-md, 12px);
    min-width: 0;
  }

  /* 批量栏 / 其它工具内容占据剩余宽度;为空时 main 收缩,badge 由 margin-left 顶到右侧 */
  .ops-toolbar__main {
    flex: 1 1 auto;
    min-width: 0;
  }

  .ops-toolbar__live {
    flex: 0 0 auto;
    margin-left: auto;
  }
</style>
