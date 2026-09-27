<template>
  <button
    :id="tabId"
    type="button"
    role="tab"
    :tabindex="active ? 0 : -1"
    :aria-selected="active"
    :aria-controls="panelId"
    class="kpi"
    :class="[`kpi--${variant}`, { 'kpi--active': active }]"
    @click="emit('select')"
  >
    <div class="kpi__label">{{ label }}</div>
    <div class="kpi__value">{{ value }}</div>
  </button>
</template>

<script setup lang="ts">
  defineProps<{
    label: string
    value: number | string
    variant: 'primary' | 'success' | 'warning' | 'info'
    active: boolean
    tabId: string
    panelId: string
  }>()

  const emit = defineEmits<{
    (e: 'select'): void
  }>()
</script>

<style scoped>
  .kpi {
    position: relative;
    padding: 14px 14px 12px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-card-lg);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    overflow: hidden;
    cursor: pointer;
    outline: none;
    width: 100%;
    font-family: inherit;
    text-align: left;
    transition:
      border-color var(--motion-duration-sm) var(--motion-ease-standard),
      box-shadow var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .kpi:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 40%, transparent);
  }

  .kpi::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--color-primary);
  }

  .kpi--success::before {
    background: var(--color-success);
  }
  .kpi--warning::before {
    background: var(--color-warning);
  }
  .kpi--info::before {
    background: var(--color-text-tertiary);
  }

  .kpi--active {
    border-color: color-mix(in srgb, var(--color-primary) 38%, var(--color-border-light));
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-primary) 22%, transparent),
      var(--shadow-surface);
  }

  .kpi--success.kpi--active {
    border-color: color-mix(in srgb, var(--color-success) 42%, var(--color-border-light));
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-success) 24%, transparent),
      var(--shadow-surface);
  }

  .kpi--warning.kpi--active {
    border-color: color-mix(in srgb, var(--color-warning) 42%, var(--color-border-light));
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-warning) 24%, transparent),
      var(--shadow-surface);
  }

  .kpi--info.kpi--active {
    border-color: color-mix(in srgb, var(--color-text-tertiary) 35%, var(--color-border-light));
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-text-tertiary) 20%, transparent),
      var(--shadow-surface);
  }

  .kpi__label {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .kpi__value {
    margin-top: 4px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0;
    color: var(--color-text-primary);
  }
</style>
