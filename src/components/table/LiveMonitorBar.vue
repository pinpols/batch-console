<template>
  <div class="live-monitor-bar">
    <span class="live-monitor-bar__dot" :class="{ 'is-off': !live }" aria-hidden="true" />
    <span class="live-monitor-bar__title">{{ title }}</span>
    <span v-if="subtitle" class="live-monitor-bar__subtitle">{{ subtitle }}</span>
    <span v-if="lastLabel || lastValue" class="live-monitor-bar__divider" aria-hidden="true" />
    <span v-if="lastLabel || lastValue" class="live-monitor-bar__time">
      {{ lastLabel }}<template v-if="lastLabel && lastValue"> </template>{{ lastValue }}
    </span>
    <div class="live-monitor-bar__content"><slot /></div>
    <div v-if="$slots.actions" class="live-monitor-bar__actions"><slot name="actions" /></div>
  </div>
</template>

<script setup lang="ts">
  withDefaults(
    defineProps<{
      live?: boolean
      title: string
      subtitle?: string
      lastLabel?: string
      lastValue?: string
    }>(),
    {
      live: true,
      subtitle: '',
      lastLabel: '',
      lastValue: '',
    },
  )
</script>

<style scoped>
  .live-monitor-bar {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 36px;
    padding: 7px 12px;
    border-top: 1px solid var(--color-border-light);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .live-monitor-bar__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-success);
    flex: 0 0 auto;
  }

  .live-monitor-bar__dot.is-off {
    background: var(--color-text-tertiary);
  }

  .live-monitor-bar__title {
    color: var(--color-text-primary);
    font-weight: 600;
    white-space: nowrap;
  }

  .live-monitor-bar__subtitle,
  .live-monitor-bar__time {
    color: var(--color-text-tertiary);
    white-space: nowrap;
  }

  .live-monitor-bar__time {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .live-monitor-bar__divider {
    width: 1px;
    height: 12px;
    background: var(--color-border);
  }

  .live-monitor-bar__content {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    margin-left: auto;
  }

  .live-monitor-bar__actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  @media (max-width: 720px) {
    .live-monitor-bar {
      flex-wrap: wrap;
    }

    .live-monitor-bar__subtitle,
    .live-monitor-bar__time,
    .live-monitor-bar__divider {
      display: none;
    }

    .live-monitor-bar__content {
      margin-left: 0;
    }

    .live-monitor-bar__actions {
      margin-left: auto;
    }
  }
</style>
