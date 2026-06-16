<template>
  <span
    class="live-status-badge"
    :class="`live-status-badge--${status}`"
    role="status"
    :aria-label="`${statusLabel}${freshnessText ? '，' + freshnessText : ''}`"
  >
    <span class="live-status-badge__dot" aria-hidden="true" />
    <span class="live-status-badge__label">{{ statusLabel }}</span>
    <span v-if="freshnessText" class="live-status-badge__sep" aria-hidden="true">·</span>
    <span v-if="freshnessText" class="live-status-badge__fresh">{{ freshnessText }}</span>
  </span>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { SseConnectionStatus } from '@/composables/useSseAutoReload'

  const props = defineProps<{
    status: SseConnectionStatus
    /** 最近一次数据刷新时间戳(epoch ms),null 表示尚未刷新。 */
    lastRefreshedAt?: number | null
  }>()

  const { t } = useI18n({ useScope: 'global' })

  // 每 10s 自走的“当前时间”信号,驱动相对时间文案重算。
  const now = ref(Date.now())
  const ticker = setInterval(() => {
    now.value = Date.now()
  }, 10_000)
  onUnmounted(() => clearInterval(ticker))

  const statusLabel = computed(() => t(`liveStatus.${props.status}`))

  const freshnessText = computed(() => {
    if (props.lastRefreshedAt == null) return ''
    const diffSec = Math.max(0, Math.floor((now.value - props.lastRefreshedAt) / 1000))
    if (diffSec < 5) return t('liveStatus.updatedJustNow')
    if (diffSec < 60) return t('liveStatus.updatedSecondsAgo', { n: diffSec })
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return t('liveStatus.updatedMinutesAgo', { n: diffMin })
    const diffHr = Math.floor(diffMin / 60)
    return t('liveStatus.updatedHoursAgo', { n: diffHr })
  })
</script>

<style scoped>
  .live-status-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs, 4px);
    font-size: var(--font-size-sm, 13px);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .live-status-badge__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-placeholder, #c0c4cc);
    flex-shrink: 0;
  }

  .live-status-badge__label {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .live-status-badge__sep {
    color: var(--color-text-placeholder);
  }

  .live-status-badge--live .live-status-badge__dot {
    background: var(--color-success, #67c23a);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-success) 18%, transparent);
  }

  .live-status-badge--connecting .live-status-badge__dot {
    background: var(--color-primary, #409eff);
    animation: live-status-pulse 1.4s ease-in-out infinite;
  }

  .live-status-badge--reconnecting .live-status-badge__dot {
    background: var(--color-warning, #e6a23c);
    animation: live-status-pulse 1s ease-in-out infinite;
  }

  .live-status-badge--polling .live-status-badge__dot {
    background: var(--color-info, #909399);
  }

  @keyframes live-status-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .live-status-badge__dot {
      animation: none !important;
    }
  }
</style>
