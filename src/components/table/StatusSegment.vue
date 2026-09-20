<template>
  <div class="status-segment" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="status-segment__item"
      :class="{ 'is-active': modelValue === item.value }"
      :style="item.accent ? { '--status-segment-accent': item.accent } : undefined"
      role="radio"
      :aria-checked="modelValue === item.value"
      @click="emit('update:modelValue', item.value)"
    >
      <span v-if="item.accent" class="status-segment__dot" aria-hidden="true" />
      <span class="status-segment__label">{{ item.label }}</span>
      <span v-if="item.count !== undefined && item.count !== null" class="status-segment__count">
        {{ item.count }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
  export interface StatusSegmentItem {
    value: string
    label: string
    count?: number | null
    accent?: string
  }

  defineProps<{
    modelValue: string
    items: readonly StatusSegmentItem[]
    ariaLabel?: string
  }>()

  const emit = defineEmits<{
    (event: 'update:modelValue', value: string): void
  }>()
</script>

<style scoped>
  .status-segment {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding: 3px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-input);
    background: color-mix(in srgb, var(--color-bg-canvas) 68%, var(--color-bg-card) 32%);
  }

  .status-segment__item {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: calc(var(--radius-input) - 2px);
    background: transparent;
    color: var(--color-text-secondary);
    font: inherit;
    font-size: var(--font-size-sm);
    white-space: nowrap;
    cursor: pointer;
    transition:
      border-color 120ms ease,
      background-color 120ms ease,
      color 120ms ease;
  }

  .status-segment__item:hover {
    background: color-mix(in srgb, var(--color-bg-elevated) 82%, transparent);
    color: var(--color-text-primary);
  }

  .status-segment__item.is-active {
    border-color: color-mix(
      in srgb,
      var(--status-segment-accent, var(--color-text-secondary)) 40%,
      var(--color-border) 60%
    );
    background: var(--color-bg-card);
    color: var(--status-segment-accent, var(--color-text-primary));
    box-shadow: var(--shadow-card);
    font-weight: 600;
  }

  .status-segment__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--status-segment-accent);
    flex: 0 0 auto;
  }

  .status-segment__count {
    color: var(--color-text-tertiary);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-variant-numeric: tabular-nums;
  }

  .status-segment__item.is-active .status-segment__count {
    color: inherit;
  }

  @media (max-width: 720px) {
    .status-segment {
      width: 100%;
      overflow-x: auto;
    }

    .status-segment__item {
      flex: 0 0 auto;
    }
  }
</style>
